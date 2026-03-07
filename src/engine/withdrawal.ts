import { Account, FilingStatus } from '../types';
import { calculateTotalTax, TaxSituation } from './tax';
import { getStandardDeduction, getFederalBrackets } from '../data/federalTax';

export interface WithdrawalPlan {
  withdrawals: Record<string, number>; // accountId -> amount
  rothConversions: Record<string, number>; // accountId -> amount converted to Roth
  ordinaryIncome: number;
  capitalGains: number;
  rothWithdrawals: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
}

interface AccountState {
  account: Account;
  balance: number;
  costBasis: number;
  ownerAge: number;
  canAccessPenaltyFree: boolean; // age >= 59.5 or SEPP
  rmdAmount: number;
  seppAmount: number;
}

// Optimize withdrawals to minimize taxes while meeting spending needs
export function optimizeWithdrawals(
  accountStates: AccountState[],
  netSpendingNeeded: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string
): WithdrawalPlan {
  const plan: WithdrawalPlan = {
    withdrawals: {},
    rothConversions: {},
    ordinaryIncome: 0,
    capitalGains: 0,
    rothWithdrawals: 0,
    totalGross: 0,
    totalTax: 0,
    totalNet: 0,
  };

  // Initialize withdrawals
  for (const as of accountStates) {
    plan.withdrawals[as.account.id] = 0;
  }

  let remainingNeed = netSpendingNeeded;

  // Step 1: Apply SS income
  remainingNeed -= ssIncome;

  // Step 2: Take mandatory RMDs (these are forced, ordinary income)
  for (const as of accountStates) {
    if (as.rmdAmount > 0) {
      const rmd = Math.min(as.rmdAmount, as.balance);
      plan.withdrawals[as.account.id] += rmd;
      plan.ordinaryIncome += rmd;
      plan.totalGross += rmd;
      remainingNeed -= rmd;
    }
  }

  // Step 3: Take mandatory SEPP withdrawals
  for (const as of accountStates) {
    if (as.seppAmount > 0 && as.account.seppEnabled) {
      const sepp = Math.min(as.seppAmount, as.balance - (plan.withdrawals[as.account.id] || 0));
      if (sepp > 0) {
        plan.withdrawals[as.account.id] += sepp;
        plan.ordinaryIncome += sepp;
        plan.totalGross += sepp;
        remainingNeed -= sepp;
      }
    }
  }

  if (remainingNeed <= 0) {
    // RMDs + SEPP + SS cover everything, calculate tax
    const taxSituation = buildTaxSituation(plan, ssIncome, filingStatus, state);
    const taxResult = calculateTotalTax(taxSituation);
    plan.totalTax = taxResult.totalTax;

    // Need to withdraw enough to cover taxes too
    remainingNeed += taxResult.totalTax;
    if (remainingNeed > 0) {
      withdrawAdditional(accountStates, plan, remainingNeed, ssIncome, filingStatus, state);
    }

    recalcTax(plan, ssIncome, filingStatus, state);
    return plan;
  }

  // Step 4: Strategic withdrawal to fill low tax brackets
  // Fill ordinary income up to the top of the 12% bracket with traditional/401k
  const standardDeduction = getStandardDeduction(filingStatus);
  const brackets = getFederalBrackets(filingStatus);
  const target12Bracket = brackets[1].max; // top of 12% bracket
  const currentOrdinary = plan.ordinaryIncome;
  const roomInLowBrackets = Math.max(0, target12Bracket + standardDeduction - currentOrdinary);

  if (roomInLowBrackets > 0 && remainingNeed > 0) {
    const traditionalAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'traditional' &&
        as.canAccessPenaltyFree &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    let amountToFill = Math.min(roomInLowBrackets, remainingNeed);

    for (const as of traditionalAccounts) {
      if (amountToFill <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(amountToFill, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.ordinaryIncome += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      amountToFill -= withdrawal;
    }
  }

  // Step 5: Use taxable brokerage (LTCG rates, often 0% or 15%)
  if (remainingNeed > 0) {
    const taxableAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'taxable' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    for (const as of taxableAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      const gainRatio =
        as.balance > 0 ? Math.max(0, (as.balance - as.costBasis) / as.balance) : 0;
      const gain = withdrawal * gainRatio;

      plan.withdrawals[as.account.id] += withdrawal;
      plan.capitalGains += gain;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
    }
  }

  // Step 6: Use HSA (tax-free if for medical, otherwise ordinary income after 65)
  if (remainingNeed > 0) {
    const hsaAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'hsa' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    for (const as of hsaAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      // After 65, HSA withdrawals for non-medical are ordinary income
      // Before 65, there's a 20% penalty + ordinary income for non-medical
      // We'll treat as ordinary income for simplicity (medical expenses are complex)
      if (as.ownerAge >= 65) {
        plan.ordinaryIncome += withdrawal;
      }
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
    }
  }

  // Step 7: Use Roth (tax-free, preserve as long as possible)
  if (remainingNeed > 0) {
    const rothAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'roth' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    for (const as of rothAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.rothWithdrawals += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
    }
  }

  // Step 8: Use generic accounts (treat as ordinary income)
  if (remainingNeed > 0) {
    const genericAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'generic' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    for (const as of genericAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.ordinaryIncome += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
    }
  }

  // Step 9: Use traditional accounts even if penalty applies (last resort pre-59.5)
  if (remainingNeed > 0) {
    const lockedTraditional = accountStates.filter(
      (as) =>
        as.account.type === 'traditional' &&
        !as.canAccessPenaltyFree &&
        !as.account.seppEnabled &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    for (const as of lockedTraditional) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      // 10% early withdrawal penalty + ordinary income
      plan.ordinaryIncome += withdrawal * 1.1;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
    }
  }

  // Calculate taxes on the withdrawal plan
  const taxSituation = buildTaxSituation(plan, ssIncome, filingStatus, state);
  const taxResult = calculateTotalTax(taxSituation);
  plan.totalTax = taxResult.totalTax;

  // Need additional withdrawals to cover the tax bill
  if (taxResult.totalTax > 0) {
    const taxNeed = taxResult.totalTax;
    withdrawAdditional(accountStates, plan, taxNeed, ssIncome, filingStatus, state);
    recalcTax(plan, ssIncome, filingStatus, state);
  }

  plan.totalNet = plan.totalGross + ssIncome - plan.totalTax;

  return plan;
}

function withdrawAdditional(
  accountStates: AccountState[],
  plan: WithdrawalPlan,
  amount: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string
): void {
  let remaining = amount;

  // Prefer Roth for tax coverage (no additional tax impact)
  const rothAccounts = accountStates.filter(
    (as) => as.account.type === 'roth' && as.balance > (plan.withdrawals[as.account.id] || 0)
  );
  for (const as of rothAccounts) {
    if (remaining <= 0) break;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    plan.withdrawals[as.account.id] += withdrawal;
    plan.rothWithdrawals += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
  }

  // Then taxable brokerage
  const taxableAccounts = accountStates.filter(
    (as) => as.account.type === 'taxable' && as.balance > (plan.withdrawals[as.account.id] || 0)
  );
  for (const as of taxableAccounts) {
    if (remaining <= 0) break;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    const gainRatio = as.balance > 0 ? Math.max(0, (as.balance - as.costBasis) / as.balance) : 0;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.capitalGains += withdrawal * gainRatio;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
  }

  // Then traditional
  const traditionalAccounts = accountStates.filter(
    (as) =>
      (as.account.type === 'traditional' || as.account.type === 'generic') &&
      as.canAccessPenaltyFree &&
      as.balance > (plan.withdrawals[as.account.id] || 0)
  );
  for (const as of traditionalAccounts) {
    if (remaining <= 0) break;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    plan.withdrawals[as.account.id] += withdrawal;
    plan.ordinaryIncome += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
  }
}

function buildTaxSituation(
  plan: WithdrawalPlan,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string
): TaxSituation {
  return {
    ordinaryIncome: plan.ordinaryIncome,
    capitalGains: plan.capitalGains,
    rothWithdrawals: plan.rothWithdrawals,
    ssIncome,
    filingStatus,
    state,
  };
}

function recalcTax(
  plan: WithdrawalPlan,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string
): void {
  const taxSituation = buildTaxSituation(plan, ssIncome, filingStatus, state);
  const taxResult = calculateTotalTax(taxSituation);
  plan.totalTax = taxResult.totalTax;
  plan.totalNet = plan.totalGross + ssIncome - plan.totalTax;
}

// Determine optimal Roth conversions for a given year
// Convert traditional → Roth to fill up low tax brackets
export function calculateRothConversion(
  traditionalAccounts: AccountState[],
  currentOrdinaryIncome: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string,
  maxBracketRate: number = 0.22 // default: fill up to top of 22% bracket
): Record<string, number> {
  const conversions: Record<string, number> = {};

  const standardDeduction = getStandardDeduction(filingStatus);
  const brackets = getFederalBrackets(filingStatus);

  // Find the target bracket top
  let targetTop = 0;
  for (const bracket of brackets) {
    if (bracket.rate <= maxBracketRate) {
      targetTop = bracket.max;
    }
  }

  const roomForConversion = Math.max(
    0,
    targetTop + standardDeduction - currentOrdinaryIncome
  );

  if (roomForConversion <= 0) return conversions;

  let remaining = roomForConversion;

  for (const as of traditionalAccounts) {
    if (remaining <= 0) break;
    const available = as.balance;
    const conversion = Math.min(remaining, available);
    if (conversion > 0) {
      conversions[as.account.id] = conversion;
      remaining -= conversion;
    }
  }

  return conversions;
}
