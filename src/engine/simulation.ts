import { AppState, YearResult, SimulationResult, Account } from '../types';
import { getAnnualSSBenefit } from '../data/socialSecurity';
import { calculateRMD, accountHasRMD } from '../data/rmd';
import { calculateSEPPPayment, isSEPPRequired, getSEPPEndAge } from './sepp';
import { optimizeWithdrawals, optimizeWithdrawalsACAaware, ACAContext, calculateRothConversion, calculateCapGainsHarvest } from './withdrawal';
import { calculateTotalTax } from './tax';
import { getStandardDeduction, getFederalBrackets } from '../data/federalTax';
import { calculateIRMAA, getIRMAAThreshold } from '../data/irmaa';
import { calculateACASubsidy, getACACliff } from '../data/aca';
import { isHSAEligible, getHSAContributionLimit } from '../data/hsa';

const CURRENT_YEAR = new Date().getFullYear();

interface AccountRuntime {
  account: Account;
  balance: number;
  costBasis: number;
  seppStartAge: number | null;
  seppFixedPayment: number | null; // Locked at SEPP start per IRS Fixed Amortization rules
}

/**
 * Per-asset-class return overrides for Monte Carlo / historical backtesting.
 * equity: real returns per year for equity-heavy accounts
 * bonds: real returns per year for bond-heavy accounts (optional; uses configured return if omitted)
 *
 * Each account's return is blended between equity and bond streams based on its
 * configured expectedReturn (high → equity-weighted, low → bond-weighted).
 */
export interface ReturnOverrides {
  equity: number[];
  bonds?: number[];
}

// Anchor points for equity weight calculation (nominal rates)
const EQUITY_NOMINAL_RATE = 0.10; // S&P 500 historical average
const BOND_NOMINAL_RATE = 0.045;  // Aggregate bond historical average

/**
 * Run the deterministic retirement simulation.
 * @param state - App state with all user inputs
 * @param returnOverrides - Optional per-asset-class real returns (for Monte Carlo / historical).
 *   Cash accounts always use their configured return.
 */
export function runSimulation(state: AppState, returnOverrides?: ReturnOverrides): SimulationResult {
  if (state.people.length === 0) {
    return {
      years: [],
      fireAge: null,
      successfulRetirement: false,
      totalTaxesPaid: 0,
      portfolioDepletionAge: null,
      totalRetirementWithdrawals: 0,
      totalRetirementSSIncome: 0,
      totalRetirementPensionIncome: 0,
      firstDeficitAge: null,
      firstCashFloorBreachAge: null,
    };
  }

  const inflationRate = state.settings.inflationRate / 100;
  const retirementYear = state.settings.retirementYear;
  const primaryPerson = state.people[0];
  const secondPerson = state.people.length > 1 ? state.people[1] : null;

  // Determine simulation range based on max life expectancy
  const maxAge = Math.max(
    primaryPerson.lifeExpectancy,
    secondPerson
      ? secondPerson.lifeExpectancy + (primaryPerson.currentAge - secondPerson.currentAge)
      : 0
  );
  const startAge = primaryPerson.currentAge;

  // Initialize account runtimes
  const accountRuntimes: AccountRuntime[] = state.accounts.map((a) => ({
    account: { ...a },
    balance: a.balance,
    costBasis: a.type === 'taxable' ? a.costBasis : 0,
    seppStartAge: null,
    seppFixedPayment: null,
  }));

  const years: YearResult[] = [];
  let totalTaxesPaid = 0;
  let totalRetirementWithdrawals = 0;
  let totalRetirementSSIncome = 0;
  let totalRetirementPensionIncome = 0;
  let portfolioDepletionAge: number | null = null;
  let firstDeficitAge: number | null = null;
  let firstCashFloorBreachAge: number | null = null;

  // Track MAGI history for IRMAA 2-year lookback
  const magiHistory: number[] = [];

  // Austerity mode: reduce spending when cash drops below floor, recover at buffer target
  let inAusterity = false;
  const austerityReduction = (state.settings.austerityReduction ?? 0) / 100;

  // Helper: get real return for an account for a given year.
  // Blends equity and bond return streams based on the account's expected return.
  // When glidePathEquityPct is provided, it overrides the account-level equity weight
  // to enforce a portfolio-wide asset allocation.
  function getRealReturn(ar: AccountRuntime, yearIdx: number, glidePathEquityPct?: number): number {
    const configuredReal = ar.account.expectedReturn / 100 - inflationRate;
    if (!returnOverrides || ar.account.type === 'cash') {
      return configuredReal;
    }
    // Equity weight: either from glide path or from account's expected return
    let equityWeight: number;
    if (glidePathEquityPct !== undefined) {
      equityWeight = glidePathEquityPct;
    } else {
      const nominal = ar.account.expectedReturn / 100;
      equityWeight = Math.max(0, Math.min(1,
        (nominal - BOND_NOMINAL_RATE) / (EQUITY_NOMINAL_RATE - BOND_NOMINAL_RATE)
      ));
    }
    const equityReturn = returnOverrides.equity[yearIdx] ?? configuredReal;
    const bondReturn = returnOverrides.bonds
      ? (returnOverrides.bonds[yearIdx] ?? configuredReal)
      : configuredReal;
    return equityWeight * equityReturn + (1 - equityWeight) * bondReturn;
  }

  // Glide path: calculate target equity % based on retirement progress
  const glidePath = state.settings.glidePath;
  const retirementAge = primaryPerson.currentAge + (retirementYear - CURRENT_YEAR);
  const retirementDuration = maxAge - retirementAge;

  for (let age = startAge; age <= maxAge; age++) {
    const year = CURRENT_YEAR + (age - startAge);
    const inRetirement = year >= retirementYear;
    const person2Age = secondPerson ? secondPerson.currentAge + (age - startAge) : null;
    const birthYear = CURRENT_YEAR - primaryPerson.currentAge;
    const person2BirthYear = secondPerson ? CURRENT_YEAR - secondPerson.currentAge : 0;

    const ages: Record<string, number> = {
      [primaryPerson.id]: age,
    };
    if (secondPerson && person2Age !== null) {
      ages[secondPerson.id] = person2Age;
    }

    const getOwnerAge = (ownerId: string): number => {
      if (ownerId === primaryPerson.id) return age;
      if (secondPerson && ownerId === secondPerson.id) return person2Age ?? age;
      return age;
    };

    const getOwnerBirthYear = (ownerId: string): number => {
      if (ownerId === primaryPerson.id) return birthYear;
      if (secondPerson && ownerId === secondPerson.id) return person2BirthYear;
      return birthYear;
    };

    // Capture starting balances before any changes this year
    const startingBalances = buildBalanceMap(accountRuntimes);

    if (!inRetirement) {
      // ACCUMULATION PHASE
      const yearContributions: Record<string, number> = {};
      const yearGrowth: Record<string, number> = {};

      const yearIdx = age - startAge;
      for (const ar of accountRuntimes) {
        const ownerAge = getOwnerAge(ar.account.owner);
        const contributionEndAge = ar.account.contributionEndAge ?? (primaryPerson.currentAge + (retirementYear - CURRENT_YEAR));
        const realReturn = getRealReturn(ar, yearIdx);

        // Add contributions if owner hasn't hit their end age
        let contrib = 0;
        if (ownerAge < contributionEndAge) {
          contrib = ar.account.annualContribution;
          ar.balance += contrib;
          if (ar.account.type === 'taxable') {
            ar.costBasis += contrib;
          }
        }
        yearContributions[ar.account.id] = contrib;

        // Grow by real return
        const growth = ar.balance * realReturn;
        ar.balance += growth;
        yearGrowth[ar.account.id] = growth;
      }

      const totalPortfolio = accountRuntimes.reduce((sum, ar) => sum + ar.balance, 0);

      // Track MAGI for IRMAA lookback (accumulation years have employment income,
      // but we don't model that — assume high enough to be in IRMAA range if applicable)
      magiHistory.push(0); // placeholder for accumulation years

      years.push({
        year,
        ages,
        startingBalances,
        accountBalances: buildBalanceMap(accountRuntimes),
        contributions: yearContributions,
        growth: yearGrowth,
        ssIncome: {},
        pensionIncome: {},
        rmds: {},
        withdrawals: {},
        rothConversions: {},
        seppWithdrawals: {},
        capitalGainsHarvested: {},
        incomeByAccount: {},
        totalIncome: 0,
        ordinaryIncome: 0,
        capitalGains: 0,
        taxableSSIncome: 0,
        federalTax: 0,
        federalIncomeTax: 0,
        federalCapGainsTax: 0,
        niit: 0,
        stateTax: 0,
        irmaaSurcharge: 0,
        acaSubsidy: 0,
        acaOverCliff: false,
        earlyWithdrawalPenalty: 0,
        hsaContributions: {},
        acaConstrainedWithdrawals: false,
        totalTax: 0,
        totalSpending: 0,
        baseSpending: 0,
        healthcareCost: 0,
        netSpending: 0,
        deficit: 0,
        bufferBorrowed: 0,
        cashBalance: accountRuntimes.filter(ar => ar.account.type === 'cash').reduce((s, ar) => s + ar.balance, 0),
        dividendIncome: 0,
        cashBelowFloor: false,
        inAusterity: false,
        totalPortfolioValue: totalPortfolio,
        phase: 'accumulation',
        annotations: [],
      });

      continue;
    }

    // RETIREMENT PHASE
    const annotations: string[] = [];

    // Calculate required spending for this year
    const retirementAge = primaryPerson.currentAge + (retirementYear - CURRENT_YEAR);
    const yearsFromRetirement = Math.max(0, age - retirementAge);
    const spendingBreakdown = calculateSpending(state, age, primaryPerson.id, secondPerson?.id ?? null, ages, retirementAge, yearsFromRetirement);
    const fullSpending = spendingBreakdown.total;

    // Austerity mode: check cash position to determine if we enter/exit austerity
    if (austerityReduction > 0) {
      const currentCashForAusterity = accountRuntimes
        .filter((ar) => ar.account.type === 'cash')
        .reduce((s, ar) => s + ar.balance, 0);
      const cashFloor = fullSpending * (state.settings.cashFloorYears ?? 1);
      const bufferTarget = fullSpending * state.settings.cashYearsOfExpenses;

      if (inAusterity) {
        // Exit austerity when cash recovers to buffer target
        if (currentCashForAusterity >= bufferTarget) {
          inAusterity = false;
        }
      } else {
        // Enter austerity when cash drops below floor
        if (currentCashForAusterity < cashFloor) {
          inAusterity = true;
        }
      }
    }

    const spending = inAusterity ? fullSpending * (1 - austerityReduction) : fullSpending;

    if (inAusterity) {
      const pct = Math.round(austerityReduction * 100);
      annotations.push(
        `Austerity mode: Spending reduced by ${pct}% (from $${Math.round(fullSpending).toLocaleString()} to ` +
        `$${Math.round(spending).toLocaleString()}). Cash reserve is below the floor — tightening the belt ` +
        `until it recovers to the buffer target of ${state.settings.cashYearsOfExpenses} years of expenses.`
      );
    }

    // Calculate Social Security income
    let totalSSIncome = 0;
    const ssIncomeMap: Record<string, number> = {};

    for (const ssConfig of state.socialSecurity) {
      if (!ssConfig.enabled) continue;
      const ownerAge = getOwnerAge(ssConfig.personId);
      if (ownerAge >= ssConfig.claimingAge) {
        const annualBenefit = getAnnualSSBenefit(
          ssConfig.monthlyBenefitAtFRA,
          ssConfig.claimingAge
        );
        ssIncomeMap[ssConfig.personId] = annualBenefit;
        totalSSIncome += annualBenefit;
      }
    }

    totalRetirementSSIncome += totalSSIncome;

    // Calculate pension income (pension is not just retirement - it can start at any age)
    let totalPensionIncome = 0;
    const pensionIncomeMap: Record<string, number> = {};

    for (const pension of (state.pensions || [])) {
      if (!pension.enabled) continue;
      const ownerAge = getOwnerAge(pension.personId);
      if (ownerAge >= pension.startAge) {
        // Pension benefit with COLA adjustment from start age
        const yearsReceiving = ownerAge - pension.startAge;
        const colaRate = (pension.cola || 0) / 100;
        // Pension COLA is in nominal terms, but we're in real terms, so adjust by (cola - inflation)
        const realColaRate = colaRate - inflationRate;
        const adjustedBenefit = pension.annualBenefit * Math.pow(1 + realColaRate, yearsReceiving);
        pensionIncomeMap[pension.id] = adjustedBenefit;
        totalPensionIncome += adjustedBenefit;
      }
    }
    totalRetirementPensionIncome += totalPensionIncome;

    // Calculate RMDs for traditional accounts
    const rmds: Record<string, number> = {};
    for (const ar of accountRuntimes) {
      if (!accountHasRMD(ar.account.type)) continue;
      const ownerAge = getOwnerAge(ar.account.owner);
      const ownerBirthYear = getOwnerBirthYear(ar.account.owner);
      const rmd = calculateRMD(ar.balance, ownerAge, ownerBirthYear);
      if (rmd > 0) {
        rmds[ar.account.id] = rmd;
        annotations.push(
          `Required withdrawal (RMD): $${Math.round(rmd).toLocaleString()} must be withdrawn from ${ar.account.name}. ` +
          `At age ${Math.floor(ownerAge)}, the IRS requires you to take money out of traditional retirement accounts ` +
          `each year — you can't leave it growing tax-deferred forever. The amount is based on your account balance ` +
          `and life expectancy. This money is taxed as regular income.`
        );
      }
    }

    // Calculate SEPP amounts
    // IRS Fixed Amortization: payment is calculated ONCE at SEPP start using the
    // initial balance and the owner's age. The same payment continues each year
    // until the SEPP period ends. Changing the payment would violate 72(t) rules
    // and trigger a 10% penalty on ALL prior distributions.
    const seppWithdrawals: Record<string, number> = {};
    for (const ar of accountRuntimes) {
      if (!ar.account.seppEnabled || ar.account.type !== 'traditional') continue;
      const ownerAge = getOwnerAge(ar.account.owner);

      if (ownerAge < 59.5) {
        if (ar.seppStartAge === null) {
          // First year of SEPP — lock in the payment using current balance
          ar.seppStartAge = ownerAge;
          ar.seppFixedPayment = calculateSEPPPayment(ar.balance, Math.floor(ownerAge));
        }
        if (ar.seppFixedPayment && ar.seppFixedPayment > 0 && isSEPPRequired(ar.seppStartAge, ownerAge)) {
          // Use the locked-in payment (capped at current balance to avoid overdraft)
          const seppAmount = Math.min(ar.seppFixedPayment, ar.balance);
          if (seppAmount > 0) {
            seppWithdrawals[ar.account.id] = seppAmount;
            const endAge = getSEPPEndAge(ar.seppStartAge);
            const yearsRemaining = Math.ceil(endAge - ownerAge);
            annotations.push(
              `Early access (SEPP/72t): $${Math.round(seppAmount).toLocaleString()} from ${ar.account.name}. ` +
              `Normally, withdrawing from a traditional retirement account before age 59½ triggers a 10% penalty. ` +
              `SEPP avoids this by committing to fixed annual payments. This payment was calculated when SEPP began ` +
              `at age ${Math.floor(ar.seppStartAge)} and cannot be changed — any modification would trigger penalties ` +
              `on all past withdrawals. ~${yearsRemaining} year${yearsRemaining !== 1 ? 's' : ''} of payments remaining ` +
              `(ends at age ${Math.round(endAge * 10) / 10}). Taxed as regular income.`
            );
          }
        }
      }
    }

    // --- Cash Flow Model ---
    // 1. Cash accounts are the spending account - money flows in via withdrawals, out via spending/taxes
    // 2. Non-cash accounts are withdrawal sources
    // 3. Target: maintain cash at cashYearsOfExpenses * annual spending

    const cashRuntimes = accountRuntimes.filter((ar) => ar.account.type === 'cash');
    const hasCashAccounts = cashRuntimes.length > 0;
    const currentCash = cashRuntimes.reduce((sum, ar) => sum + ar.balance, 0);

    // Cash receives SS + pension, pays spending. Calculate how much we need from non-cash accounts.
    const cashAfterSpendingAndSS = currentCash - spending + totalSSIncome + totalPensionIncome;
    const targetCash = spending * state.settings.cashYearsOfExpenses;
    const shortfall = Math.max(0, targetCash - cashAfterSpendingAndSS);

    // Build non-cash account states for withdrawal optimizer
    const accountStates = accountRuntimes
      .filter((ar) => ar.account.type !== 'cash')
      .map((ar) => {
        const ownerAge = getOwnerAge(ar.account.owner);
        return {
          account: ar.account,
          balance: ar.balance,
          costBasis: ar.costBasis,
          ownerAge,
          canAccessPenaltyFree:
            ownerAge >= 59.5 ||
            ar.account.type !== 'traditional' ||
            ar.account.seppEnabled,
          rmdAmount: rmds[ar.account.id] || 0,
          seppAmount: seppWithdrawals[ar.account.id] || 0,
        };
      });

    // --- HSA Contributions in Retirement ---
    // If enabled, contribute to HSA accounts for eligible people (under 65).
    // HSA contributions reduce MAGI and grow tax-free for medical expenses.
    let hsaContribAmount = 0;
    const hsaContributions: Record<string, number> = {};

    if (state.settings.hsaContributionInRetirement) {
      const eligibleAges: number[] = [];
      if (age < 65) eligibleAges.push(age);
      if (person2Age !== null && person2Age < 65) eligibleAges.push(person2Age);

      if (eligibleAges.length > 0) {
        const maxContrib = getHSAContributionLimit(state.settings.filingStatus, eligibleAges);
        // Find HSA accounts to contribute to
        const hsaRuntimes = accountRuntimes.filter(
          (ar) => ar.account.type === 'hsa' && isHSAEligible(getOwnerAge(ar.account.owner))
        );
        if (hsaRuntimes.length > 0) {
          // Split contribution evenly across eligible HSA accounts
          const perAccount = maxContrib / hsaRuntimes.length;
          for (const ar of hsaRuntimes) {
            hsaContributions[ar.account.id] = perAccount;
            hsaContribAmount += perAccount;
          }
          annotations.push(
            `HSA contribution: $${Math.round(hsaContribAmount).toLocaleString()} contributed to HSA ` +
            `(${eligibleAges.length} eligible ${eligibleAges.length === 1 ? 'person' : 'people'} under 65). ` +
            `This reduces your MAGI, helping preserve ACA subsidies and lowering taxes. ` +
            `The money grows tax-free and can be withdrawn tax-free for medical expenses at any age.`
          );
        }
      }
    }

    // The optimizer subtracts ssIncome from the need, so we add it back
    // so that: effectiveNeed - ssIncome = shortfall
    // HSA contributions are an additional spending need (money flows out to HSA)
    // Pension income is already accounted for in cashAfterSpendingAndSS
    const effectiveNeed = (hasCashAccounts ? shortfall + totalSSIncome + totalPensionIncome : spending) + hsaContribAmount;

    // --- Dividend Income from Taxable Accounts ---
    // Dividends are generated annually and count as qualified dividend income (LTCG rates).
    // They are added to MAGI and can push you over the ACA cliff even without withdrawals.
    // Dividends are reinvested (increase balance and cost basis).
    let dividendIncome = 0;
    for (const ar of accountRuntimes) {
      if (ar.account.type === 'taxable' && (ar.account.dividendYield ?? 0) > 0) {
        const divYield = ar.account.dividendYield / 100;
        const dividends = ar.balance * divYield;
        dividendIncome += dividends;
        // Dividends are reinvested — increase both balance and cost basis
        ar.balance += dividends;
        ar.costBasis += dividends;
      }
    }
    if (dividendIncome > 0) {
      annotations.push(
        `Dividend income: $${Math.round(dividendIncome).toLocaleString()} from taxable accounts. ` +
        `Dividends are taxed as qualified dividends (capital gains rates) and count toward MAGI ` +
        `even though you didn't sell anything. This is "phantom income" that can affect ACA subsidies and IRMAA.`
      );
    }

    // Build ACA context for cliff-aware optimization
    const acaAges: number[] = [];
    if (age < 65) acaAges.push(age);
    if (person2Age !== null && person2Age < 65) acaAges.push(person2Age);

    let acaContext: ACAContext | null = null;
    if (acaAges.length > 0) {
      const householdSize = secondPerson ? 2 : 1;
      const cliff = getACACliff(householdSize);
      // Estimate subsidy value near the cliff
      const nearCliffResult = calculateACASubsidy(
        cliff - 1, state.settings.filingStatus, householdSize, acaAges
      );
      acaContext = {
        cliff400FPL: cliff,
        estimatedSubsidyAtCliff: nearCliffResult.annualSubsidy,
        ssIncome: totalSSIncome,
        hsaContribDeduction: hsaContribAmount,
        dividendIncome, // Dividend income uses MAGI headroom
      };
    }

    // Optimize withdrawals from non-cash accounts (ACA-aware if applicable)
    const withdrawalResult = optimizeWithdrawalsACAaware(
      accountStates,
      effectiveNeed,
      totalSSIncome,
      state.settings.filingStatus,
      state.settings.state,
      acaContext,
      totalPensionIncome
    );
    const withdrawalPlan = withdrawalResult;
    const acaConstrainedWithdrawals = withdrawalResult.acaConstrained;

    // Include withdrawal reasoning in annotations
    annotations.push(...withdrawalPlan.reasons);

    // Track total withdrawals from non-cash accounts
    const yearWithdrawals = Object.values(withdrawalPlan.withdrawals).reduce((s, v) => s + v, 0);
    totalRetirementWithdrawals += yearWithdrawals;

    // Apply withdrawals to non-cash account runtimes
    for (const ar of accountRuntimes) {
      if (ar.account.type === 'cash') continue;
      const withdrawn = withdrawalPlan.withdrawals[ar.account.id] || 0;
      if (withdrawn > 0) {
        if (ar.account.type === 'taxable' && ar.balance > 0) {
          const ratio = ar.costBasis / ar.balance;
          ar.costBasis -= withdrawn * ratio;
          ar.costBasis = Math.max(0, ar.costBasis);
        }
        ar.balance -= withdrawn;
        ar.balance = Math.max(0, ar.balance);
      }
    }

    // Apply HSA contributions (add to HSA balances)
    for (const [accountId, contrib] of Object.entries(hsaContributions)) {
      const ar = accountRuntimes.find((a) => a.account.id === accountId);
      if (ar) {
        ar.balance += contrib;
      }
    }

    // --- Cash Flow: Update cash accounts ---
    // Cash receives: withdrawals from investments + SS + pension
    // Cash pays: spending + taxes
    // The cash buffer absorbs shortfalls (sequence of returns risk protection).
    // Only when cash drops below the floor is it a true failure.
    let deficit = 0;
    let bufferBorrowed = 0;
    let cashBalance = 0;
    let cashBelowFloor = false;

    if (hasCashAccounts) {
      const cashEnd = currentCash - spending + totalSSIncome + totalPensionIncome + yearWithdrawals - withdrawalPlan.totalTax;
      if (cashEnd < 0) {
        // Cash is completely exhausted — this is a true deficit (unfunded spending)
        deficit = -cashEnd;
        cashRuntimes[0].balance = 0;
        cashBalance = 0;
      } else {
        cashRuntimes[0].balance = cashEnd;
        cashBalance = cashEnd;
      }

      // Check if cash is below target (buffer borrowed) or below floor (failure)
      const cashFloor = spending * (state.settings.cashFloorYears ?? 1);
      if (cashBalance < cashFloor) {
        cashBelowFloor = true;
      }
      if (cashBalance < targetCash) {
        bufferBorrowed = targetCash - cashBalance;
      }
    } else {
      deficit = Math.max(0, spending + withdrawalPlan.totalTax - yearWithdrawals - totalSSIncome - totalPensionIncome);
    }

    // Track hard limit annotations (informational only — doesn't cap spending)
    if (state.settings.withdrawalHardLimit !== null && state.settings.withdrawalHardLimit !== undefined) {
      const totalStartingPortfolio = Object.values(startingBalances).reduce((s, v) => s + v, 0);
      if (totalStartingPortfolio > 0) {
        const netDrain = spending + withdrawalPlan.totalTax - totalSSIncome - totalPensionIncome - deficit;
        const drainPct = (netDrain / totalStartingPortfolio) * 100;
        if (drainPct > state.settings.withdrawalHardLimit) {
          annotations.push(
            `Withdrawal rate: Net portfolio drain of ${drainPct.toFixed(1)}% exceeds the ` +
            `${state.settings.withdrawalHardLimit}% hard limit. Cash buffer is absorbing the excess ` +
            `($${Math.round(bufferBorrowed).toLocaleString()} below target).`
          );
        }
      }
    }

    if (deficit > 0 && firstDeficitAge === null) {
      firstDeficitAge = age;
    }
    if (cashBelowFloor && firstCashFloorBreachAge === null) {
      firstCashFloorBreachAge = age;
    }

    // --- Tax Optimization: Roth Conversions ---
    // After spending is handled, fill remaining bracket space by converting
    // traditional → Roth. Pays tax now at lower rate, avoids higher brackets later.
    const rothConversions: Record<string, number> = {};
    let conversionTax = 0;

    const strategyToRate: Record<string, number> = {
      'fill12': 0.12, 'fill22': 0.22, 'fill24': 0.24,
    };
    const conversionMaxRate = strategyToRate[state.settings.rothConversionStrategy];

    if (conversionMaxRate) {
      // Current ordinary income after spending withdrawals
      const currentOrdinary = withdrawalPlan.ordinaryIncome +
        withdrawalPlan.taxableSSIncome;

      // Only do Roth conversions in low-income years. If total income (ordinary +
      // capital gains) already fills the target bracket, conversions would just
      // push us into higher brackets — defeating the purpose.
      const totalTaxableIncome = currentOrdinary + withdrawalPlan.capitalGains;
      const standardDed = getStandardDeduction(state.settings.filingStatus);
      const bracketsList = getFederalBrackets(state.settings.filingStatus);
      let targetBracketTop = 0;
      let targetBracketLabel = '';
      for (const bracket of bracketsList) {
        if (bracket.rate < conversionMaxRate) {
          targetBracketTop = bracket.max;
          targetBracketLabel = `${(bracket.rate * 100).toFixed(0)}%`;
        }
      }
      let incomeHeadroom = targetBracketTop + standardDed - totalTaxableIncome;

      // When ACA-constrained, cap conversions to remaining MAGI headroom
      // Roth conversions increase MAGI (they are ordinary income)
      if (acaConstrainedWithdrawals && acaContext) {
        const currentMAGI = withdrawalPlan.ordinaryIncome + withdrawalPlan.capitalGains +
          totalSSIncome - hsaContribAmount;
        const magiHeadroom = acaContext.cliff400FPL - currentMAGI;
        if (magiHeadroom <= 0) {
          incomeHeadroom = 0;
          annotations.push(
            `Roth conversion: Skipped to preserve ACA subsidy. Converting would increase MAGI ` +
            `above the 400% FPL threshold ($${Math.round(acaContext.cliff400FPL).toLocaleString()}).`
          );
        } else {
          incomeHeadroom = Math.min(incomeHeadroom, magiHeadroom);
        }
      }

      // IRMAA look-ahead: if anyone will be on Medicare in 2 years, cap conversions
      // to avoid triggering IRMAA surcharges. IRMAA uses 2-year lookback MAGI.
      if (incomeHeadroom > 0) {
        const futureAge = age + 2;
        const futurePerson2Age = person2Age !== null ? person2Age + 2 : null;
        let futureMedicareCount = 0;
        if (futureAge >= 65) futureMedicareCount++;
        if (futurePerson2Age !== null && futurePerson2Age >= 65) futureMedicareCount++;

        if (futureMedicareCount > 0) {
          // Current MAGI before conversion
          const currentMAGI = withdrawalPlan.ordinaryIncome +
            withdrawalPlan.capitalGains + totalSSIncome;
          const irmaaThreshold = getIRMAAThreshold(state.settings.filingStatus);

          if (currentMAGI < irmaaThreshold) {
            // Cap conversion so MAGI stays below the IRMAA threshold
            const irmaaHeadroom = irmaaThreshold - currentMAGI;
            if (irmaaHeadroom < incomeHeadroom) {
              // Calculate what IRMAA cost would be if we did the full conversion
              const fullConvMAGI = currentMAGI + incomeHeadroom;
              const irmaaIfFull = calculateIRMAA(fullConvMAGI, state.settings.filingStatus, futureMedicareCount);

              // Only cap if IRMAA cost exceeds the marginal tax rate benefit
              // Rough estimate: conversion saves conversionMaxRate on the amount above threshold,
              // but IRMAA costs are fixed tiers. Cap unless benefit clearly exceeds cost.
              const amountOverThreshold = incomeHeadroom - irmaaHeadroom;
              const estimatedTaxSaving = amountOverThreshold * conversionMaxRate;
              if (irmaaIfFull.annualSurcharge > estimatedTaxSaving) {
                annotations.push(
                  `Roth conversion: Capped to avoid IRMAA surcharge. Converting the full ` +
                  `$${Math.round(incomeHeadroom).toLocaleString()} would push your MAGI to ` +
                  `$${Math.round(fullConvMAGI).toLocaleString()}, triggering ` +
                  `$${Math.round(irmaaIfFull.annualSurcharge).toLocaleString()}/year in Medicare ` +
                  `surcharges 2 years from now (IRMAA uses 2-year lookback). ` +
                  `Conversion limited to $${Math.round(irmaaHeadroom).toLocaleString()} to stay ` +
                  `below the $${irmaaThreshold.toLocaleString()} IRMAA threshold.`
                );
                incomeHeadroom = Math.max(0, irmaaHeadroom);
              }
            }
          }
        }
      }

      // Find traditional accounts with remaining balance (post-withdrawal)
      const traditionalForConversion = incomeHeadroom > 0
        ? accountRuntimes
            .filter((ar) => ar.account.type === 'traditional' && ar.balance > 0)
            .map((ar) => ({
              accountId: ar.account.id,
              balance: ar.balance,
              canAccess: getOwnerAge(ar.account.owner) >= 59.5 || ar.account.seppEnabled,
            }))
        : [];

      // Cap conversion to incomeHeadroom so that total income (ordinary + cap gains
      // + conversion) stays within the target bracket. calculateRothConversion only
      // considers ordinary income, so without this cap, capital gains can cause overshoot.
      const conversions = incomeHeadroom > 0
        ? calculateRothConversion(
            traditionalForConversion,
            currentOrdinary,
            state.settings.filingStatus,
            conversionMaxRate,
            incomeHeadroom
          )
        : {};

      if (incomeHeadroom <= 0) {
        const taxableIncome = Math.max(0, totalTaxableIncome - standardDed);
        // Determine what bracket we're in
        let currentBracketRate = 0;
        for (const bracket of bracketsList) {
          if (taxableIncome > bracket.min) currentBracketRate = bracket.rate;
        }
        annotations.push(
          `Roth conversion: Not done this year — your income is too high for it to be beneficial. ` +
          `Your gross income ($${Math.round(totalTaxableIncome).toLocaleString()}) minus the standard deduction ` +
          `($${Math.round(standardDed).toLocaleString()}) = $${Math.round(taxableIncome).toLocaleString()} in taxable income. ` +
          `This already exceeds the ${targetBracketLabel} tax bracket ceiling ($${targetBracketTop.toLocaleString()}), ` +
          `putting you in the ${(currentBracketRate * 100).toFixed(0)}% bracket. Converting traditional to Roth right now ` +
          `would be taxed at ${(conversionMaxRate * 100).toFixed(0)}% or higher — the same rate you'd pay later anyway. ` +
          `Roth conversions only save money when done in years with lower income.`
        );
      }

      // Apply conversions: move from traditional to Roth
      const totalConversion = Object.values(conversions).reduce((s, v) => s + v, 0);
      if (totalConversion > 0) {
        // Calculate tax on the conversion
        const preTax = calculateTotalTax({
          ordinaryIncome: withdrawalPlan.ordinaryIncome,
          capitalGains: withdrawalPlan.capitalGains,
          rothWithdrawals: withdrawalPlan.rothWithdrawals,
          ssIncome: totalSSIncome,
          filingStatus: state.settings.filingStatus,
          state: state.settings.state,
        });
        const postTax = calculateTotalTax({
          ordinaryIncome: withdrawalPlan.ordinaryIncome + totalConversion,
          capitalGains: withdrawalPlan.capitalGains,
          rothWithdrawals: withdrawalPlan.rothWithdrawals,
          ssIncome: totalSSIncome,
          filingStatus: state.settings.filingStatus,
          state: state.settings.state,
        });
        conversionTax = postTax.totalTax - preTax.totalTax;

        // Determine marginal rate on conversion
        const effectiveConvRate = totalConversion > 0 ? conversionTax / totalConversion : 0;
        const taxableBeforeConv = Math.max(0, currentOrdinary - standardDed);
        let convBracketLow = 0;
        for (const bracket of bracketsList) {
          if (taxableBeforeConv >= bracket.max) convBracketLow = bracket.rate;
        }
        // Find the bracket we fill up to
        let convBracketHigh = convBracketLow;
        const taxableAfterConv = taxableBeforeConv + totalConversion;
        for (const bracket of bracketsList) {
          if (taxableAfterConv > bracket.min) convBracketHigh = bracket.rate;
        }

        const bracketRange = convBracketLow === convBracketHigh
          ? `${(convBracketHigh * 100).toFixed(0)}%`
          : `${(convBracketLow * 100).toFixed(0)}–${(convBracketHigh * 100).toFixed(0)}%`;

        annotations.push(
          `Roth conversion: $${Math.round(totalConversion).toLocaleString()} moved from traditional retirement account to Roth. ` +
          `Why? Your income this year is low enough to do this cheaply. Before conversion, your taxable income was ` +
          `$${Math.round(taxableBeforeConv).toLocaleString()} (income $${Math.round(currentOrdinary).toLocaleString()} ` +
          `minus $${Math.round(standardDed).toLocaleString()} standard deduction), leaving room in the ` +
          `${targetBracketLabel} bracket (up to $${targetBracketTop.toLocaleString()}). ` +
          `The conversion is taxed at ${bracketRange} — costing $${Math.round(conversionTax).toLocaleString()} in tax now ` +
          `(${(effectiveConvRate * 100).toFixed(1)}% effective rate). ` +
          `The payoff: this money is now in a Roth and will never be taxed again. Without converting, ` +
          `it would eventually be taxed at ${(conversionMaxRate * 100).toFixed(0)}% or higher when withdrawn later ` +
          `(or forced out via required minimum distributions).`
        );

        // Find or create a Roth account to receive conversions
        let rothRuntime = accountRuntimes.find((ar) => ar.account.type === 'roth');

        for (const [accountId, amount] of Object.entries(conversions)) {
          const tradRuntime = accountRuntimes.find((ar) => ar.account.id === accountId);
          if (!tradRuntime || tradRuntime.balance < amount) continue;

          tradRuntime.balance -= amount;
          rothConversions[accountId] = amount;

          if (rothRuntime) {
            rothRuntime.balance += amount;
          }
        }

        // Tax on conversion comes from cash
        if (hasCashAccounts && conversionTax > 0) {
          cashRuntimes[0].balance = Math.max(0, cashRuntimes[0].balance - conversionTax);
        }
      }
    }

    // --- Tax Optimization: Capital Gains Harvesting ---
    // Sell and rebuy taxable assets to realize gains at 0% LTCG rate.
    // This resets cost basis higher, reducing future taxable gains.
    let harvestedGains = 0;
    const capitalGainsHarvested: Record<string, number> = {};

    if (state.settings.capitalGainsHarvesting) {
      const currentOrdinaryForCG = withdrawalPlan.ordinaryIncome +
        withdrawalPlan.taxableSSIncome +
        Object.values(rothConversions).reduce((s, v) => s + v, 0);

      const taxableForHarvest = accountRuntimes
        .filter((ar) => ar.account.type === 'taxable' && ar.balance > 0)
        .map((ar) => ({
          accountId: ar.account.id,
          balance: ar.balance,
          costBasis: ar.costBasis,
        }));

      let harvests = calculateCapGainsHarvest(
        taxableForHarvest,
        currentOrdinaryForCG,
        state.settings.filingStatus
      );

      // When ACA-constrained, cap harvested gains to remaining MAGI headroom
      if (acaConstrainedWithdrawals && acaContext) {
        const convAmount = Object.values(rothConversions).reduce((s, v) => s + v, 0);
        const currentMAGI = withdrawalPlan.ordinaryIncome + convAmount +
          withdrawalPlan.capitalGains + totalSSIncome - hsaContribAmount;
        const magiHeadroom = Math.max(0, acaContext.cliff400FPL - currentMAGI);
        let totalHarvestGains = Object.values(harvests).reduce((s, v) => s + v, 0);
        if (totalHarvestGains > magiHeadroom) {
          const originalGains = totalHarvestGains;
          // Scale down proportionally
          if (magiHeadroom <= 0) {
            harvests = {};
            annotations.push(
              `Tax-free gain reset: Skipped to preserve ACA subsidy. Realizing gains would increase MAGI ` +
              `above the 400% FPL threshold ($${Math.round(acaContext.cliff400FPL).toLocaleString()}), ` +
              `costing you the full ACA premium subsidy. The $${Math.round(originalGains).toLocaleString()} ` +
              `in harvestable gains will wait for a year when ACA constraints don't apply.`
            );
          } else {
            const scale = magiHeadroom / totalHarvestGains;
            for (const key of Object.keys(harvests)) {
              harvests[key] = Math.floor(harvests[key] * scale);
              if (harvests[key] <= 0) delete harvests[key];
            }
            const cappedGains = Object.values(harvests).reduce((s, v) => s + v, 0);
            annotations.push(
              `Tax-free gain reset: Limited by ACA subsidy preservation. Could have harvested ` +
              `$${Math.round(originalGains).toLocaleString()} in gains at 0% tax, but capped at ` +
              `$${Math.round(cappedGains).toLocaleString()} to keep MAGI below the 400% FPL threshold ` +
              `($${Math.round(acaContext.cliff400FPL).toLocaleString()}).`
            );
          }
        }
      }

      // Apply harvests: increase cost basis (sell and rebuy, no balance change)
      for (const [accountId, gainsHarvested] of Object.entries(harvests)) {
        const ar = accountRuntimes.find((a) => a.account.id === accountId);
        if (!ar) continue;
        const oldBasis = ar.costBasis;
        ar.costBasis += gainsHarvested; // Cost basis increases by harvested gains
        harvestedGains += gainsHarvested;
        capitalGainsHarvested[accountId] = gainsHarvested;

        annotations.push(
          `Tax-free gain reset: $${Math.round(gainsHarvested).toLocaleString()} in investment profits from ` +
          `${ar.account.name} realized at the 0% tax rate. Here's how this works: your income is low enough this year ` +
          `that investment profits are taxed at 0%. So we "sell" and immediately "rebuy" the same investments. ` +
          `Nothing changes in your portfolio, but the IRS now considers your purchase price to be ` +
          `$${Math.round(ar.costBasis).toLocaleString()} instead of $${Math.round(oldBasis).toLocaleString()}. ` +
          `When you actually sell later, you'll owe tax on a much smaller gain — saving potentially ` +
          `$${Math.round(gainsHarvested * 0.15).toLocaleString()}+ in future taxes.`
        );
      }

      if (Object.keys(harvests).length === 0 && taxableForHarvest.length > 0) {
        const taxableOrd = Math.max(0, currentOrdinaryForCG - getStandardDeduction(state.settings.filingStatus));
        const allAtBasis = taxableForHarvest.every((a) => a.costBasis >= a.balance);
        if (allAtBasis) {
          annotations.push(
            `Tax-free gain reset: Not needed — your taxable brokerage accounts have no unrealized profits ` +
            `(what you paid equals or exceeds what they're worth). Nothing to harvest.`
          );
        } else {
          annotations.push(
            `Tax-free gain reset: Not done this year — your income ($${Math.round(taxableOrd).toLocaleString()} taxable) ` +
            `is too high to qualify for the 0% capital gains tax rate. Selling investments at a profit right now ` +
            `would trigger a 15%+ tax on the gains, so it's better to wait for a lower-income year.`
          );
        }
      }
    }

    // Grow remaining balances
    const yearGrowth: Record<string, number> = {};
    const yearIdx = age - startAge;

    // Glide path: calculate target equity % for this year of retirement
    let glideEquityPct: number | undefined;
    if (glidePath?.enabled && returnOverrides && retirementDuration > 0) {
      const yearsIntoRetirement = age - retirementAge;
      const progress = Math.max(0, Math.min(1, yearsIntoRetirement / retirementDuration));
      const safeYears = glidePath.safeYearsStart +
        (glidePath.safeYearsEnd - glidePath.safeYearsStart) * progress;
      const totalNonCash = accountRuntimes
        .filter(ar => ar.account.type !== 'cash')
        .reduce((s, ar) => s + ar.balance, 0);
      const safeTarget = safeYears * spending;
      // Cash already provides some "safe years" — subtract it from target
      const cashBal = accountRuntimes
        .filter(ar => ar.account.type === 'cash')
        .reduce((s, ar) => s + ar.balance, 0);
      const bondTarget = Math.max(0, safeTarget - cashBal);
      glideEquityPct = totalNonCash > 0
        ? Math.max(0, Math.min(1, 1 - bondTarget / totalNonCash))
        : 0;
    }

    for (const ar of accountRuntimes) {
      const realReturn = getRealReturn(ar, yearIdx, glideEquityPct);
      const growth = ar.balance * realReturn;
      ar.balance += growth;
      ar.balance = Math.max(0, ar.balance);
      yearGrowth[ar.account.id] = growth;
    }

    const totalPortfolio = accountRuntimes.reduce((sum, ar) => sum + ar.balance, 0);

    if (totalPortfolio <= 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    const totalConversionAmount = Object.values(rothConversions).reduce((s, v) => s + v, 0);

    // Recalculate total tax breakdown including conversions
    let yearFederalTax = withdrawalPlan.federalTax;
    let yearFederalIncomeTax = withdrawalPlan.federalIncomeTax;
    let yearFederalCapGainsTax = withdrawalPlan.federalCapGainsTax;
    let yearNiit = withdrawalPlan.niit;
    let yearStateTax = withdrawalPlan.stateTax;
    let yearTaxableSSIncome = withdrawalPlan.taxableSSIncome;

    if (conversionTax > 0) {
      // Recalculate full tax picture including conversions
      const fullTax = calculateTotalTax({
        ordinaryIncome: withdrawalPlan.ordinaryIncome + totalConversionAmount,
        capitalGains: withdrawalPlan.capitalGains,
        rothWithdrawals: withdrawalPlan.rothWithdrawals,
        ssIncome: totalSSIncome,
        filingStatus: state.settings.filingStatus,
        state: state.settings.state,
      });
      yearFederalTax = fullTax.totalFederalTax;
      yearFederalIncomeTax = fullTax.federalIncomeTax;
      yearFederalCapGainsTax = fullTax.federalCapGainsTax;
      yearNiit = fullTax.niit;
      yearStateTax = fullTax.stateTax;
      yearTaxableSSIncome = fullTax.taxableSSIncome;
    }

    // --- IRMAA Calculation (Medicare surcharge for high-income beneficiaries) ---
    // Uses MAGI from 2 years prior. Applies to people age 65+.
    let irmaaSurcharge = 0;
    const yearMAGI = withdrawalPlan.ordinaryIncome + totalConversionAmount +
      withdrawalPlan.capitalGains + totalSSIncome + dividendIncome;

    // Count Medicare-eligible people (age 65+)
    let medicareCount = 0;
    if (age >= 65) medicareCount++;
    if (person2Age !== null && person2Age >= 65) medicareCount++;

    if (medicareCount > 0) {
      // IRMAA uses 2-year lookback. Use MAGI from 2 years ago if available.
      const lookbackIndex = magiHistory.length - 2;
      const lookbackMAGI = lookbackIndex >= 0 ? magiHistory[lookbackIndex] : yearMAGI;
      const irmaaResult = calculateIRMAA(lookbackMAGI, state.settings.filingStatus, medicareCount);
      irmaaSurcharge = irmaaResult.annualSurcharge;
      if (irmaaSurcharge > 0) {
        annotations.push(irmaaResult.description);
      }
    }

    // --- ACA Subsidy Calculation (pre-65 health insurance) ---
    // For early retirees under 65 who need marketplace coverage.
    // ACA MAGI = ordinary income + cap gains + full SS - HSA contributions
    let acaSubsidy = 0;
    let acaOverCliff = false;

    if (acaAges.length > 0) {
      const householdSize = secondPerson ? 2 : 1;
      const acaMAGI = yearMAGI - hsaContribAmount; // HSA contributions reduce MAGI
      const acaResult = calculateACASubsidy(acaMAGI, state.settings.filingStatus, householdSize, acaAges);
      acaSubsidy = acaResult.annualSubsidy;
      acaOverCliff = acaResult.overCliff;
      if (acaResult.description) {
        annotations.push(acaResult.description);
      }
    }

    // --- Early Withdrawal Penalty Detection ---
    // Flag any withdrawals from traditional accounts where owner is under 59.5
    // and SEPP is not enabled. These should be avoided.
    let earlyWithdrawalPenalty = 0;
    for (const as of accountStates) {
      if (as.account.type === 'traditional' && !as.canAccessPenaltyFree) {
        const withdrawn = withdrawalPlan.withdrawals[as.account.id] || 0;
        if (withdrawn > 0) {
          earlyWithdrawalPenalty += withdrawn * 0.10;
          annotations.push(
            `WARNING: $${Math.round(withdrawn).toLocaleString()} withdrawn from ${as.account.name} ` +
            `with a 10% EARLY WITHDRAWAL PENALTY ($${Math.round(withdrawn * 0.10).toLocaleString()}). ` +
            `The account owner is under 59½ and SEPP is not enabled. This is extremely costly — ` +
            `consider enabling SEPP/72(t) on this account, adjusting your retirement date, ` +
            `or using other account types to avoid this penalty.`
          );
        }
      }
    }

    // Track MAGI for IRMAA lookback in future years
    magiHistory.push(yearMAGI);

    // Total tax includes IRMAA surcharge (it's a mandatory cost, not technically a tax,
    // but it increases the amount needed from accounts)
    const yearTotalTax = withdrawalPlan.totalTax + conversionTax + irmaaSurcharge;
    totalTaxesPaid += yearTotalTax;

    // ACA subsidy reduces healthcare costs (already included in spending).
    // If the user loses the subsidy by going over the cliff, the full premium
    // is effectively their healthcare cost — which is already modeled in spending.
    // The subsidy is informational: it shows how much the government helps.

    years.push({
      year,
      ages,
      startingBalances,
      accountBalances: buildBalanceMap(accountRuntimes),
      contributions: hsaContributions,
      growth: yearGrowth,
      ssIncome: ssIncomeMap,
      pensionIncome: pensionIncomeMap,
      rmds,
      withdrawals: withdrawalPlan.withdrawals,
      rothConversions,
      seppWithdrawals,
      capitalGainsHarvested,
      incomeByAccount: withdrawalPlan.incomeByAccount,
      totalIncome: withdrawalPlan.totalGross + totalSSIncome,
      ordinaryIncome: withdrawalPlan.ordinaryIncome + totalConversionAmount,
      capitalGains: withdrawalPlan.capitalGains + harvestedGains,
      taxableSSIncome: yearTaxableSSIncome,
      federalTax: yearFederalTax,
      federalIncomeTax: yearFederalIncomeTax,
      federalCapGainsTax: yearFederalCapGainsTax,
      niit: yearNiit,
      stateTax: yearStateTax,
      irmaaSurcharge,
      acaSubsidy,
      acaOverCliff,
      earlyWithdrawalPenalty,
      hsaContributions,
      acaConstrainedWithdrawals,
      totalTax: yearTotalTax,
      totalSpending: spending + hsaContribAmount,
      baseSpending: spendingBreakdown.base,
      healthcareCost: spendingBreakdown.healthcare,
      netSpending: spending,
      deficit,
      bufferBorrowed,
      cashBalance,
      dividendIncome,
      cashBelowFloor,
      inAusterity,
      totalPortfolioValue: totalPortfolio,
      phase: 'retirement',
      annotations,
    });
  }

  return {
    years,
    fireAge: retirementAge,
    successfulRetirement: portfolioDepletionAge === null,
    totalTaxesPaid,
    portfolioDepletionAge,
    totalRetirementWithdrawals,
    totalRetirementSSIncome,
    totalRetirementPensionIncome,
    firstDeficitAge,
    firstCashFloorBreachAge,
  };
}

interface SpendingBreakdown {
  total: number;
  base: number;
  healthcare: number;
}

function calculateSpending(
  appState: AppState,
  primaryAge: number,
  primaryId: string,
  secondaryId: string | null,
  ages: Record<string, number>,
  retirementAge: number,
  yearsFromRetirement: number = 0
): SpendingBreakdown {
  // The first spending phase's effective start is the retirement age,
  // so there's never a gap between retiring and when spending begins.
  const phases = appState.spending.phases.map((phase, i) => {
    if (i === 0) {
      return { ...phase, startAge: Math.min(phase.startAge, retirementAge) };
    }
    return phase;
  });

  let baseSpending = 0;
  for (const phase of phases) {
    if (primaryAge >= phase.startAge && primaryAge <= phase.endAge) {
      baseSpending = phase.annualAmount;
      break;
    }
  }

  if (baseSpending === 0 && phases.length > 0) {
    const lastPhase = phases[phases.length - 1];
    if (primaryAge > lastPhase.endAge) {
      baseSpending = lastPhase.annualAmount;
    }
  }

  let healthcareCost = 0;
  const healthcare = appState.spending.healthcare;

  const primaryAge_ = ages[primaryId];
  if (primaryAge_ < 65) {
    healthcareCost += healthcare.pre65AnnualPerPerson;
  } else {
    healthcareCost += healthcare.post65AnnualPerPerson;
  }

  if (secondaryId && ages[secondaryId] !== undefined) {
    const secondaryAge = ages[secondaryId];
    if (secondaryAge < 65) {
      healthcareCost += healthcare.pre65AnnualPerPerson;
    } else {
      healthcareCost += healthcare.post65AnnualPerPerson;
    }
  }

  // Apply excess healthcare inflation if set
  // Everything is in "today's dollars" (general inflation already removed via real returns).
  // If healthcare inflates faster, compound the excess rate over years from retirement.
  if (healthcare.inflationRate !== null && healthcare.inflationRate !== undefined && yearsFromRetirement > 0) {
    const generalInflation = appState.settings.inflationRate / 100;
    const healthcareInflation = healthcare.inflationRate / 100;
    const excessRate = healthcareInflation - generalInflation;
    if (excessRate > 0) {
      healthcareCost *= Math.pow(1 + excessRate, yearsFromRetirement);
    }
  }

  return { total: baseSpending + healthcareCost, base: baseSpending, healthcare: healthcareCost };
}

function buildBalanceMap(runtimes: AccountRuntime[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ar of runtimes) {
    map[ar.account.id] = ar.balance;
  }
  return map;
}
