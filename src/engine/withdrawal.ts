import { Account, AccountIncomeDetail, FilingStatus } from '../types';
import { calculateTotalTax, TaxSituation } from './tax';
import { getStandardDeduction, getFederalBrackets, getLTCGBrackets } from '../data/federalTax';

export interface WithdrawalPlan {
  withdrawals: Record<string, number>; // accountId -> amount
  rothConversions: Record<string, number>; // accountId -> amount converted to Roth
  incomeByAccount: Record<string, AccountIncomeDetail>;
  ordinaryIncome: number;
  capitalGains: number;
  rothWithdrawals: number;
  totalGross: number;
  federalTax: number;
  federalIncomeTax: number;
  federalCapGainsTax: number;
  niit: number;
  stateTax: number;
  totalTax: number;
  totalNet: number;
  taxableSSIncome: number;
  reasons: string[]; // Plain-language explanations of withdrawal decisions
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

function addAccountIncome(
  plan: WithdrawalPlan,
  accountId: string,
  type: 'ordinary' | 'capitalGains' | 'taxFree',
  amount: number
) {
  if (!plan.incomeByAccount[accountId]) {
    plan.incomeByAccount[accountId] = { ordinary: 0, capitalGains: 0, taxFree: 0 };
  }
  plan.incomeByAccount[accountId][type] += amount;
}

// Optimize withdrawals to minimize taxes while meeting spending needs
export function optimizeWithdrawals(
  accountStates: AccountState[],
  netSpendingNeeded: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string,
  pensionIncome: number = 0
): WithdrawalPlan {
  const plan: WithdrawalPlan = {
    withdrawals: {},
    rothConversions: {},
    incomeByAccount: {},
    ordinaryIncome: 0,
    capitalGains: 0,
    rothWithdrawals: 0,
    totalGross: 0,
    federalTax: 0,
    federalIncomeTax: 0,
    federalCapGainsTax: 0,
    niit: 0,
    stateTax: 0,
    totalTax: 0,
    totalNet: 0,
    taxableSSIncome: 0,
    reasons: [],
  };

  // Initialize withdrawals (skip cash accounts - they are the destination, not source)
  for (const as of accountStates) {
    if (as.account.type === 'cash') continue;
    plan.withdrawals[as.account.id] = 0;
  }

  let remainingNeed = netSpendingNeeded;

  // Step 1: Apply SS + pension income
  remainingNeed -= ssIncome;
  if (ssIncome > 0) {
    plan.reasons.push(
      `Social Security provides $${Math.round(ssIncome).toLocaleString()} — this is applied first to reduce how much needs to come from your investment accounts.`
    );
  }
  if (pensionIncome > 0) {
    remainingNeed -= pensionIncome;
    plan.ordinaryIncome += pensionIncome;
    plan.totalGross += pensionIncome;
    plan.reasons.push(
      `Pension income provides $${Math.round(pensionIncome).toLocaleString()} — taxed as ordinary income.`
    );
  }

  // Step 2: Take mandatory RMDs (these are forced, ordinary income)
  for (const as of accountStates) {
    if (as.rmdAmount > 0 && as.account.type !== 'cash') {
      const rmd = Math.min(as.rmdAmount, as.balance);
      plan.withdrawals[as.account.id] += rmd;
      plan.ordinaryIncome += rmd;
      plan.totalGross += rmd;
      remainingNeed -= rmd;
      addAccountIncome(plan, as.account.id, 'ordinary', rmd);
      plan.reasons.push(
        `${as.account.name}: $${Math.round(rmd).toLocaleString()} required minimum distribution (RMD). ` +
        `The IRS requires this withdrawal — it's not optional. Taxed as regular income.`
      );
    }
  }

  // Step 3: Take mandatory SEPP withdrawals
  for (const as of accountStates) {
    if (as.seppAmount > 0 && as.account.seppEnabled && as.account.type !== 'cash') {
      const sepp = Math.min(as.seppAmount, as.balance - (plan.withdrawals[as.account.id] || 0));
      if (sepp > 0) {
        plan.withdrawals[as.account.id] += sepp;
        plan.ordinaryIncome += sepp;
        plan.totalGross += sepp;
        remainingNeed -= sepp;
        addAccountIncome(plan, as.account.id, 'ordinary', sepp);
        plan.reasons.push(
          `${as.account.name}: $${Math.round(sepp).toLocaleString()} SEPP/72(t) payment. ` +
          `This is a fixed annual withdrawal that allows penalty-free access before age 59½. ` +
          `The amount cannot be changed without triggering penalties. Taxed as regular income.`
        );
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
  // Fill ordinary income up to the top of the 12% bracket with traditional/401k/457b
  const standardDeduction = getStandardDeduction(filingStatus);
  const brackets = getFederalBrackets(filingStatus);
  const target12Bracket = brackets[1].max; // top of 12% bracket
  const currentOrdinary = plan.ordinaryIncome;
  const roomInLowBrackets = Math.max(0, target12Bracket + standardDeduction - currentOrdinary);

  if (roomInLowBrackets > 0 && remainingNeed > 0) {
    const traditionalAccounts = accountStates.filter(
      (as) =>
        (as.account.type === 'traditional' || as.account.type === '457b') &&
        as.canAccessPenaltyFree &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    let amountToFill = Math.min(roomInLowBrackets, remainingNeed);
    const fillTarget = amountToFill;

    for (const as of traditionalAccounts) {
      if (amountToFill <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(amountToFill, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.ordinaryIncome += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      amountToFill -= withdrawal;
      addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
    }

    const filled = fillTarget - amountToFill;
    if (filled > 0) {
      plan.reasons.push(
        `Traditional accounts: $${Math.round(filled).toLocaleString()} withdrawn to fill the low tax brackets ` +
        `(10% and 12%). This income is taxed at the lowest rates. We use traditional accounts here ` +
        `because this money will be taxed as regular income regardless of when it's withdrawn — ` +
        `better to take it now while rates are low than later when other income might push it into higher brackets.`
      );
    }
  }

  // Step 5: Use taxable brokerage (LTCG rates, often 0% or 15%)
  if (remainingNeed > 0) {
    const taxableAccounts = accountStates.filter(
      (as) =>
        as.account.type === 'taxable' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );

    let totalTaxableWithdrawn = 0;
    let totalGainsPortion = 0;
    let totalBasisPortion = 0;

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
      totalTaxableWithdrawn += withdrawal;
      totalGainsPortion += gain;
      totalBasisPortion += withdrawal - gain;
      addAccountIncome(plan, as.account.id, 'capitalGains', gain);
      addAccountIncome(plan, as.account.id, 'taxFree', withdrawal - gain);
    }

    if (totalTaxableWithdrawn > 0) {
      plan.reasons.push(
        `Taxable brokerage: $${Math.round(totalTaxableWithdrawn).toLocaleString()} withdrawn. ` +
        `Of this, $${Math.round(totalBasisPortion).toLocaleString()} is your original investment (cost basis) ` +
        `returned tax-free, and $${Math.round(totalGainsPortion).toLocaleString()} is investment profit ` +
        `taxed at the lower capital gains rates (0–20%) rather than regular income rates (up to 37%). ` +
        `This is used after filling low brackets with traditional accounts because the tax rates on gains are usually lower.`
      );
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
      if (as.ownerAge >= 65) {
        plan.ordinaryIncome += withdrawal;
        addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
        plan.reasons.push(
          `HSA (${as.account.name}): $${Math.round(withdrawal).toLocaleString()} withdrawn. ` +
          `After age 65, HSA withdrawals for non-medical expenses are taxed as regular income (like a traditional IRA). ` +
          `Medical expense withdrawals remain tax-free at any age.`
        );
      } else {
        addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
        plan.reasons.push(
          `HSA (${as.account.name}): $${Math.round(withdrawal).toLocaleString()} withdrawn tax-free ` +
          `(assumed used for qualified medical expenses).`
        );
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

    let totalRothWithdrawn = 0;
    for (const as of rothAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.rothWithdrawals += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      totalRothWithdrawn += withdrawal;
      addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
    }

    if (totalRothWithdrawn > 0) {
      plan.reasons.push(
        `Roth accounts: $${Math.round(totalRothWithdrawn).toLocaleString()} withdrawn completely tax-free. ` +
        `Roth withdrawals are used last because they are the most valuable — every dollar grows and is withdrawn ` +
        `tax-free forever. We preserve Roth as long as possible to maximize this benefit.`
      );
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
      addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
      plan.reasons.push(
        `${as.account.name}: $${Math.round(withdrawal).toLocaleString()} withdrawn, taxed as regular income.`
      );
    }
  }

  // Step 9: Use traditional accounts even if penalty applies (ABSOLUTE LAST RESORT pre-59.5)
  // This should almost never happen. If it does, something is wrong with the plan.
  // Note: 457(b) accounts never have penalties so they won't appear here.
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
      addAccountIncome(plan, as.account.id, 'ordinary', withdrawal * 1.1);
      plan.reasons.push(
        `CRITICAL WARNING: $${Math.round(withdrawal).toLocaleString()} withdrawn from ${as.account.name} ` +
        `WITH 10% EARLY WITHDRAWAL PENALTY ($${Math.round(withdrawal * 0.1).toLocaleString()} wasted). ` +
        `The account owner is under 59½ and SEPP/72(t) is NOT enabled on this account. ` +
        `This is an extremely costly last resort that should be avoided. ` +
        `RECOMMENDED ACTIONS: (1) Enable SEPP/72(t) on this account for penalty-free access, ` +
        `(2) Delay retirement until you have sufficient non-traditional assets, ` +
        `(3) Build up Roth/taxable/cash accounts before retiring, or ` +
        `(4) Reduce spending to avoid needing these funds.`
      );
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
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
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
    const gain = withdrawal * gainRatio;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.capitalGains += gain;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'capitalGains', gain);
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal - gain);
  }

  // Then traditional
  const traditionalAccounts = accountStates.filter(
    (as) =>
      (as.account.type === 'traditional' || as.account.type === '457b' || as.account.type === 'generic') &&
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
    addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
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
  plan.federalTax = taxResult.totalFederalTax;
  plan.federalIncomeTax = taxResult.federalIncomeTax;
  plan.federalCapGainsTax = taxResult.federalCapGainsTax;
  plan.niit = taxResult.niit;
  plan.stateTax = taxResult.stateTax;
  plan.totalTax = taxResult.totalTax;
  plan.taxableSSIncome = taxResult.taxableSSIncome;
  plan.totalNet = plan.totalGross + ssIncome - plan.totalTax;
}

// Determine optimal Roth conversions for a given year.
// Converts traditional → Roth to fill up to the target tax bracket.
// This is taxable as ordinary income now, but future Roth withdrawals are tax-free.
// Reduces future RMDs and avoids higher brackets when withdrawals spike.
export function calculateRothConversion(
  traditionalBalances: { accountId: string; balance: number; canAccess: boolean }[],
  currentOrdinaryIncome: number,
  filingStatus: FilingStatus,
  maxBracketRate: number = 0.22,
  maxConversion?: number
): Record<string, number> {
  const conversions: Record<string, number> = {};

  const standardDeduction = getStandardDeduction(filingStatus);
  const brackets = getFederalBrackets(filingStatus);

  // Fill brackets BELOW the target rate. "Fill 22%" means "I expect 22%+ in
  // the future, so convert now at rates strictly below 22%." Converting at 22%
  // to avoid 22% later is a wash — no tax savings. Only convert dollars where
  // the marginal rate is lower than the expected future rate.
  let targetTop = 0;
  for (const bracket of brackets) {
    if (bracket.rate < maxBracketRate) {
      targetTop = bracket.max;
    }
  }

  let roomForConversion = Math.max(
    0,
    targetTop + standardDeduction - currentOrdinaryIncome
  );

  // If a cap is provided (e.g. accounting for capital gains), apply it
  if (maxConversion !== undefined) {
    roomForConversion = Math.min(roomForConversion, maxConversion);
  }

  if (roomForConversion <= 0) return conversions;

  let remaining = roomForConversion;

  for (const acct of traditionalBalances) {
    if (remaining <= 0) break;
    if (!acct.canAccess) continue;
    const conversion = Math.min(remaining, acct.balance);
    if (conversion > 0) {
      conversions[acct.accountId] = conversion;
      remaining -= conversion;
    }
  }

  return conversions;
}

// Calculate capital gains that can be harvested at 0% LTCG rate.
// When ordinary income is low enough, LTCG up to a threshold is taxed at 0%.
// "Harvesting" means selling and rebuying to reset cost basis (no actual portfolio change).
export function calculateCapGainsHarvest(
  taxableAccounts: { accountId: string; balance: number; costBasis: number }[],
  currentOrdinaryIncome: number,
  filingStatus: FilingStatus
): Record<string, number> {
  const harvests: Record<string, number> = {};

  const standardDeduction = getStandardDeduction(filingStatus);
  const ltcgBrackets = getLTCGBrackets(filingStatus);

  // The 0% LTCG bracket top
  const zeroRateTop = ltcgBrackets[0].max; // e.g., $96,700 for MFJ

  // Taxable ordinary income (after standard deduction)
  const taxableOrdinary = Math.max(0, currentOrdinaryIncome - standardDeduction);

  // Room in the 0% LTCG bracket (LTCG stacks on top of ordinary income)
  const roomForZeroRateGains = Math.max(0, zeroRateTop - taxableOrdinary);

  if (roomForZeroRateGains <= 0) return harvests;

  let remainingRoom = roomForZeroRateGains;

  for (const acct of taxableAccounts) {
    if (remainingRoom <= 0) break;
    const unrealizedGains = Math.max(0, acct.balance - acct.costBasis);
    if (unrealizedGains <= 0) continue;

    const gainsToHarvest = Math.min(remainingRoom, unrealizedGains);
    if (gainsToHarvest > 0) {
      harvests[acct.accountId] = gainsToHarvest;
      remainingRoom -= gainsToHarvest;
    }
  }

  return harvests;
}

// ACA context for cliff-aware withdrawal optimization
export interface ACAContext {
  cliff400FPL: number;         // income threshold at 400% FPL
  estimatedSubsidyAtCliff: number; // annual subsidy value if we stay just under
  ssIncome: number;            // full SS income (counts toward ACA MAGI)
  hsaContribDeduction: number; // HSA contributions that reduce MAGI
  dividendIncome: number;      // taxable dividend income (counts toward MAGI)
}

// ACA-aware withdrawal optimization.
// Runs the normal optimizer first, then checks if we'd go over the ACA cliff.
// If the subsidy loss exceeds the benefit of the extra withdrawal, re-optimizes
// with a MAGI cap, using a different withdrawal order that prioritizes
// MAGI-free sources (HSA medical, Roth) over MAGI-impacting sources.
export function optimizeWithdrawalsACAaware(
  accountStates: AccountState[],
  netSpendingNeeded: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string,
  acaContext: ACAContext | null,
  pensionIncome: number = 0
): WithdrawalPlan & { acaConstrained: boolean } {
  // Run the normal (unconstrained) optimizer
  const unconstrainedPlan = optimizeWithdrawals(
    accountStates, netSpendingNeeded, ssIncome, filingStatus, state, pensionIncome
  );

  // If no ACA context or no subsidy to protect, return as-is
  if (!acaContext || acaContext.estimatedSubsidyAtCliff <= 0) {
    return { ...unconstrainedPlan, acaConstrained: false };
  }

  // Calculate MAGI from the unconstrained plan
  // ACA MAGI = ordinary income + capital gains + dividends + FULL SS income - HSA contributions
  const unconstrainedMAGI =
    unconstrainedPlan.ordinaryIncome +
    unconstrainedPlan.capitalGains +
    (acaContext.dividendIncome ?? 0) +
    acaContext.ssIncome -
    acaContext.hsaContribDeduction;

  // If we're already under the cliff, no problem
  if (unconstrainedMAGI <= acaContext.cliff400FPL) {
    return { ...unconstrainedPlan, acaConstrained: false };
  }

  // Calculate mandatory MAGI (RMDs + SEPP + pension + dividends — can't be reduced)
  let mandatoryOrdinaryIncome = 0;
  for (const as of accountStates) {
    mandatoryOrdinaryIncome += as.rmdAmount + as.seppAmount;
  }
  mandatoryOrdinaryIncome += pensionIncome;
  const mandatoryMAGI = mandatoryOrdinaryIncome + (acaContext.dividendIncome ?? 0) +
    acaContext.ssIncome - acaContext.hsaContribDeduction;

  // If mandatory income alone exceeds the cliff, no point capping
  if (mandatoryMAGI > acaContext.cliff400FPL) {
    unconstrainedPlan.reasons.push(
      `ACA cliff: Mandatory income (RMDs + SEPP + Social Security = ` +
      `$${Math.round(mandatoryMAGI + acaContext.hsaContribDeduction).toLocaleString()}) ` +
      `exceeds the 400% FPL threshold ($${Math.round(acaContext.cliff400FPL).toLocaleString()}). ` +
      `Cannot avoid losing ACA subsidies — mandatory withdrawals alone push MAGI over the cliff.`
    );
    return { ...unconstrainedPlan, acaConstrained: false };
  }

  // We CAN stay under the cliff. Build a MAGI-constrained plan.
  // Available MAGI budget for discretionary withdrawals:
  const magiBudget = acaContext.cliff400FPL - mandatoryMAGI;

  const plan: WithdrawalPlan = {
    withdrawals: {},
    rothConversions: {},
    incomeByAccount: {},
    ordinaryIncome: 0,
    capitalGains: 0,
    rothWithdrawals: 0,
    totalGross: 0,
    federalTax: 0,
    federalIncomeTax: 0,
    federalCapGainsTax: 0,
    niit: 0,
    stateTax: 0,
    totalTax: 0,
    totalNet: 0,
    taxableSSIncome: 0,
    reasons: [],
  };

  // Initialize withdrawals
  for (const as of accountStates) {
    if (as.account.type === 'cash') continue;
    plan.withdrawals[as.account.id] = 0;
  }

  let remainingNeed = netSpendingNeeded;
  let magiUsed = 0; // tracks MAGI from discretionary withdrawals

  // Step 1: SS + pension income
  remainingNeed -= ssIncome;
  if (ssIncome > 0) {
    plan.reasons.push(
      `Social Security provides $${Math.round(ssIncome).toLocaleString()} — applied first.`
    );
  }
  if (pensionIncome > 0) {
    remainingNeed -= pensionIncome;
    plan.ordinaryIncome += pensionIncome;
    plan.totalGross += pensionIncome;
    magiUsed += pensionIncome;
    plan.reasons.push(
      `Pension income provides $${Math.round(pensionIncome).toLocaleString()} — taxed as ordinary income, counts toward MAGI.`
    );
  }

  // Step 2: Mandatory RMDs (MAGI impact, but unavoidable)
  for (const as of accountStates) {
    if (as.rmdAmount > 0 && as.account.type !== 'cash') {
      const rmd = Math.min(as.rmdAmount, as.balance);
      plan.withdrawals[as.account.id] += rmd;
      plan.ordinaryIncome += rmd;
      plan.totalGross += rmd;
      remainingNeed -= rmd;
      magiUsed += rmd;
      addAccountIncome(plan, as.account.id, 'ordinary', rmd);
      plan.reasons.push(
        `${as.account.name}: $${Math.round(rmd).toLocaleString()} RMD (mandatory).`
      );
    }
  }

  // Step 3: Mandatory SEPP
  for (const as of accountStates) {
    if (as.seppAmount > 0 && as.account.seppEnabled && as.account.type !== 'cash') {
      const sepp = Math.min(as.seppAmount, as.balance - (plan.withdrawals[as.account.id] || 0));
      if (sepp > 0) {
        plan.withdrawals[as.account.id] += sepp;
        plan.ordinaryIncome += sepp;
        plan.totalGross += sepp;
        remainingNeed -= sepp;
        magiUsed += sepp;
        addAccountIncome(plan, as.account.id, 'ordinary', sepp);
        plan.reasons.push(
          `${as.account.name}: $${Math.round(sepp).toLocaleString()} SEPP payment (mandatory).`
        );
      }
    }
  }

  // ACA-CONSTRAINED ORDERING: prioritize MAGI-free sources
  // Step 4: HSA for medical expenses (pre-65, zero MAGI impact)
  if (remainingNeed > 0) {
    const hsaAccounts = accountStates.filter(
      (as) => as.account.type === 'hsa' && as.ownerAge < 65 &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );
    for (const as of hsaAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
      plan.reasons.push(
        `HSA (${as.account.name}): $${Math.round(withdrawal).toLocaleString()} withdrawn tax-free ` +
        `for medical expenses. Zero MAGI impact — preserves ACA subsidy.`
      );
    }
  }

  // Step 5: Roth (zero MAGI impact — normally saved for last, but ACA cliff makes it more valuable now)
  if (remainingNeed > 0) {
    const rothAccounts = accountStates.filter(
      (as) => as.account.type === 'roth' && as.balance > (plan.withdrawals[as.account.id] || 0)
    );
    let totalRothWithdrawn = 0;
    for (const as of rothAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available);
      plan.withdrawals[as.account.id] += withdrawal;
      plan.rothWithdrawals += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      totalRothWithdrawn += withdrawal;
      addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
    }
    if (totalRothWithdrawn > 0) {
      plan.reasons.push(
        `Roth accounts: $${Math.round(totalRothWithdrawn).toLocaleString()} withdrawn tax-free. ` +
        `Normally Roth is used last, but ACA subsidy preservation makes it more valuable to use ` +
        `MAGI-free sources first. The ACA subsidy saved exceeds the benefit of preserving Roth growth.`
      );
    }
  }

  // Step 6: Taxable brokerage — only the cost basis portion is MAGI-free
  if (remainingNeed > 0) {
    const taxableAccounts = accountStates.filter(
      (as) => as.account.type === 'taxable' &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );
    let totalTaxableWithdrawn = 0;
    let totalGainsPortion = 0;

    for (const as of taxableAccounts) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const gainRatio = as.balance > 0 ? Math.max(0, (as.balance - as.costBasis) / as.balance) : 0;

      // How much MAGI budget remains?
      const magiRemaining = magiBudget - magiUsed;

      // Each $1 withdrawn generates $gainRatio in MAGI-impacting gains
      // Max withdrawal limited by MAGI budget: magiRemaining / gainRatio
      let maxByMagi = gainRatio > 0 ? magiRemaining / gainRatio : available;
      maxByMagi = Math.max(0, maxByMagi);

      const withdrawal = Math.min(remainingNeed, available, maxByMagi);
      if (withdrawal <= 0) continue;

      const gain = withdrawal * gainRatio;
      plan.withdrawals[as.account.id] += withdrawal;
      plan.capitalGains += gain;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      magiUsed += gain;
      totalTaxableWithdrawn += withdrawal;
      totalGainsPortion += gain;
      addAccountIncome(plan, as.account.id, 'capitalGains', gain);
      addAccountIncome(plan, as.account.id, 'taxFree', withdrawal - gain);
    }
    if (totalTaxableWithdrawn > 0) {
      plan.reasons.push(
        `Taxable brokerage: $${Math.round(totalTaxableWithdrawn).toLocaleString()} withdrawn ` +
        `($${Math.round(totalGainsPortion).toLocaleString()} gains count toward MAGI). ` +
        `Capped to preserve ACA subsidy.`
      );
    }
  }

  // Step 7: Traditional accounts — full MAGI impact, use remaining budget
  if (remainingNeed > 0) {
    const magiRemaining = magiBudget - magiUsed;
    if (magiRemaining > 0) {
      const traditionalAccounts = accountStates.filter(
        (as) => (as.account.type === 'traditional' || as.account.type === '457b') && as.canAccessPenaltyFree &&
          as.balance > (plan.withdrawals[as.account.id] || 0)
      );
      let totalTraditionalWithdrawn = 0;
      let amountToFill = Math.min(magiRemaining, remainingNeed);

      for (const as of traditionalAccounts) {
        if (amountToFill <= 0) break;
        const available = as.balance - (plan.withdrawals[as.account.id] || 0);
        const withdrawal = Math.min(amountToFill, available);
        plan.withdrawals[as.account.id] += withdrawal;
        plan.ordinaryIncome += withdrawal;
        plan.totalGross += withdrawal;
        remainingNeed -= withdrawal;
        amountToFill -= withdrawal;
        magiUsed += withdrawal;
        totalTraditionalWithdrawn += withdrawal;
        addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
      }
      if (totalTraditionalWithdrawn > 0) {
        plan.reasons.push(
          `Traditional accounts: $${Math.round(totalTraditionalWithdrawn).toLocaleString()} withdrawn ` +
          `within MAGI budget to preserve ACA subsidy.`
        );
      }
    }
  }

  // Step 8: Generic accounts — full MAGI impact, use remaining budget
  if (remainingNeed > 0) {
    const magiRemaining = magiBudget - magiUsed;
    if (magiRemaining > 0) {
      const genericAccounts = accountStates.filter(
        (as) => as.account.type === 'generic' &&
          as.balance > (plan.withdrawals[as.account.id] || 0)
      );
      for (const as of genericAccounts) {
        if (remainingNeed <= 0) break;
        const available = as.balance - (plan.withdrawals[as.account.id] || 0);
        const withdrawal = Math.min(remainingNeed, available, magiBudget - magiUsed);
        if (withdrawal <= 0) continue;
        plan.withdrawals[as.account.id] += withdrawal;
        plan.ordinaryIncome += withdrawal;
        plan.totalGross += withdrawal;
        remainingNeed -= withdrawal;
        magiUsed += withdrawal;
        addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
        plan.reasons.push(
          `${as.account.name}: $${Math.round(withdrawal).toLocaleString()} withdrawn within MAGI budget.`
        );
      }
    }
  }

  // Step 9: HSA for non-medical (age 65+, taxed as ordinary but still useful)
  if (remainingNeed > 0) {
    const magiRemaining = magiBudget - magiUsed;
    const hsaAccounts65 = accountStates.filter(
      (as) => as.account.type === 'hsa' && as.ownerAge >= 65 &&
        as.balance > (plan.withdrawals[as.account.id] || 0)
    );
    for (const as of hsaAccounts65) {
      if (remainingNeed <= 0) break;
      const available = as.balance - (plan.withdrawals[as.account.id] || 0);
      const withdrawal = Math.min(remainingNeed, available, magiRemaining);
      if (withdrawal <= 0) continue;
      plan.withdrawals[as.account.id] += withdrawal;
      plan.ordinaryIncome += withdrawal;
      plan.totalGross += withdrawal;
      remainingNeed -= withdrawal;
      magiUsed += withdrawal;
      addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
    }
  }

  // If still short after using all MAGI budget + MAGI-free sources,
  // check if going over the cliff is worth it
  if (remainingNeed > 0) {
    // Cost of going over: lost ACA subsidy
    // Benefit of going over: meeting remaining spending need
    // If remaining need is small relative to subsidy, accept the deficit
    if (remainingNeed < acaContext.estimatedSubsidyAtCliff * 0.5) {
      plan.reasons.push(
        `ACA optimization: Accepting $${Math.round(remainingNeed).toLocaleString()} spending shortfall ` +
        `to preserve $${Math.round(acaContext.estimatedSubsidyAtCliff).toLocaleString()} ACA subsidy. ` +
        `Going over the cliff would save less than the subsidy is worth.`
      );
    } else {
      // The deficit is too large — better to go over the cliff and meet spending
      plan.reasons.push(
        `ACA cliff exceeded: Spending need ($${Math.round(remainingNeed).toLocaleString()} remaining) ` +
        `is too large to stay under the 400% FPL threshold. ACA subsidy of ` +
        `$${Math.round(acaContext.estimatedSubsidyAtCliff).toLocaleString()} will be lost.`
      );
      // Fill remainder from traditional, taxable, generic (no longer MAGI-constrained)
      fillRemainingUnconstrained(accountStates, plan, remainingNeed, ssIncome, filingStatus, state);
      remainingNeed = 0;
    }
  }

  // Calculate taxes
  const taxSituation = buildTaxSituation(plan, ssIncome, filingStatus, state);
  const taxResult = calculateTotalTax(taxSituation);
  plan.totalTax = taxResult.totalTax;

  // Withdraw additional to cover taxes (prefer MAGI-free sources)
  if (taxResult.totalTax > 0) {
    withdrawAdditionalACAaware(accountStates, plan, taxResult.totalTax, magiBudget - magiUsed);
    recalcTax(plan, ssIncome, filingStatus, state);
  }

  plan.totalNet = plan.totalGross + ssIncome - plan.totalTax;

  plan.reasons.unshift(
    `ACA-optimized withdrawals: Income capped at ~$${Math.round(acaContext.cliff400FPL).toLocaleString()} ` +
    `(400% FPL) to preserve ~$${Math.round(acaContext.estimatedSubsidyAtCliff).toLocaleString()}/year ` +
    `ACA health insurance subsidy. Withdrawal order was changed to prioritize MAGI-free sources ` +
    `(HSA medical expenses, Roth) over taxable sources.`
  );

  return { ...plan, acaConstrained: true };
}

// Fill remaining need without MAGI constraint (when going over cliff is accepted)
function fillRemainingUnconstrained(
  accountStates: AccountState[],
  plan: WithdrawalPlan,
  amount: number,
  ssIncome: number,
  filingStatus: FilingStatus,
  state: string
): void {
  let remaining = amount;

  // Traditional (penalty-free)
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if ((as.account.type !== 'traditional' && as.account.type !== '457b') || !as.canAccessPenaltyFree) continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.ordinaryIncome += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
  }

  // Taxable brokerage
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if (as.account.type !== 'taxable') continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    const gainRatio = as.balance > 0 ? Math.max(0, (as.balance - as.costBasis) / as.balance) : 0;
    const gain = withdrawal * gainRatio;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.capitalGains += gain;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'capitalGains', gain);
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal - gain);
  }

  // Generic
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if (as.account.type !== 'generic') continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.ordinaryIncome += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
  }
}

// Withdraw additional for taxes, preferring MAGI-free sources when ACA-constrained
function withdrawAdditionalACAaware(
  accountStates: AccountState[],
  plan: WithdrawalPlan,
  amount: number,
  magiRemaining: number
): void {
  let remaining = amount;

  // Prefer Roth (MAGI-free)
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if (as.account.type !== 'roth') continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.rothWithdrawals += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
  }

  // Then HSA (pre-65, MAGI-free)
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if (as.account.type !== 'hsa' || as.ownerAge >= 65) continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal);
  }

  // Then taxable brokerage (gains use MAGI)
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if (as.account.type !== 'taxable') continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    const gainRatio = as.balance > 0 ? Math.max(0, (as.balance - as.costBasis) / as.balance) : 0;
    const gain = withdrawal * gainRatio;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.capitalGains += gain;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'capitalGains', gain);
    addAccountIncome(plan, as.account.id, 'taxFree', withdrawal - gain);
  }

  // Then traditional (full MAGI impact)
  for (const as of accountStates) {
    if (remaining <= 0) break;
    if ((as.account.type !== 'traditional' && as.account.type !== '457b' && as.account.type !== 'generic') || !as.canAccessPenaltyFree) continue;
    const available = as.balance - (plan.withdrawals[as.account.id] || 0);
    const withdrawal = Math.min(remaining, available);
    if (withdrawal <= 0) continue;
    plan.withdrawals[as.account.id] += withdrawal;
    plan.ordinaryIncome += withdrawal;
    plan.totalGross += withdrawal;
    remaining -= withdrawal;
    addAccountIncome(plan, as.account.id, 'ordinary', withdrawal);
  }
}
