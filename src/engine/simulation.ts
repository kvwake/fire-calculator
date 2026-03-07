import { AppState, YearResult, SimulationResult, Account } from '../types';
import { getAnnualSSBenefit } from '../data/socialSecurity';
import { calculateRMD, accountHasRMD, getRMDStartAge } from '../data/rmd';
import { calculateSEPPPayment, isSEPPRequired } from './sepp';
import { optimizeWithdrawals } from './withdrawal';

const CURRENT_YEAR = new Date().getFullYear();

interface AccountRuntime {
  account: Account;
  balance: number;
  costBasis: number;
  seppStartAge: number | null;
}

export function runSimulation(state: AppState): SimulationResult {
  if (state.people.length === 0) {
    return {
      years: [],
      fireAge: null,
      successfulRetirement: false,
      totalTaxesPaid: 0,
      portfolioDepletionAge: null,
    };
  }

  const inflationRate = state.settings.inflationRate / 100;
  const primaryPerson = state.people[0];
  const secondPerson = state.people.length > 1 ? state.people[1] : null;

  // Determine simulation range
  const maxAge = Math.max(
    primaryPerson.lifeExpectancy,
    secondPerson ? secondPerson.lifeExpectancy + (primaryPerson.currentAge - secondPerson.currentAge) : 0
  );
  const startAge = primaryPerson.currentAge;

  // Initialize account runtimes
  const accountRuntimes: AccountRuntime[] = state.accounts.map((a) => ({
    account: { ...a },
    balance: a.balance,
    costBasis: a.type === 'taxable' ? a.costBasis : 0,
    seppStartAge: null,
  }));

  const years: YearResult[] = [];
  let totalTaxesPaid = 0;
  let portfolioDepletionAge: number | null = null;

  for (let age = startAge; age <= maxAge; age++) {
    const year = CURRENT_YEAR + (age - startAge);
    const isRetired = age >= primaryPerson.retirementAge;
    const person2Age = secondPerson ? secondPerson.currentAge + (age - startAge) : null;
    const person2Retired = secondPerson && person2Age !== null
      ? person2Age >= secondPerson.retirementAge
      : true;

    // Both must be retired for retirement phase
    const inRetirement = isRetired && person2Retired;
    const birthYear = CURRENT_YEAR - primaryPerson.currentAge;
    const person2BirthYear = secondPerson ? CURRENT_YEAR - secondPerson.currentAge : 0;

    const ages: Record<string, number> = {
      [primaryPerson.id]: age,
    };
    if (secondPerson && person2Age !== null) {
      ages[secondPerson.id] = person2Age;
    }

    // Get owner age for each account
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

    if (!inRetirement) {
      // ACCUMULATION PHASE
      // Add contributions and grow accounts
      for (const ar of accountRuntimes) {
        const realReturn = ar.account.expectedReturn / 100 - inflationRate;

        // Add contributions (in today's dollars)
        ar.balance += ar.account.annualContribution;
        if (ar.account.type === 'taxable') {
          ar.costBasis += ar.account.annualContribution;
        }

        // Grow by real return
        const growth = ar.balance * realReturn;
        ar.balance += growth;
        // Cost basis doesn't grow with returns
      }

      const totalPortfolio = accountRuntimes.reduce((sum, ar) => sum + ar.balance, 0);

      years.push({
        year,
        ages,
        accountBalances: buildBalanceMap(accountRuntimes),
        ssIncome: {},
        rmds: {},
        withdrawals: {},
        rothConversions: {},
        seppWithdrawals: {},
        totalIncome: 0,
        ordinaryIncome: 0,
        capitalGains: 0,
        taxableSSIncome: 0,
        federalTax: 0,
        stateTax: 0,
        totalTax: 0,
        totalSpending: 0,
        netSpending: 0,
        deficit: 0,
        totalPortfolioValue: totalPortfolio,
        phase: 'accumulation',
      });

      continue;
    }

    // RETIREMENT PHASE

    // Calculate required spending for this year
    const spending = calculateSpending(state, age, primaryPerson.id, secondPerson?.id ?? null, ages);

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

    // Calculate RMDs for traditional accounts
    const rmds: Record<string, number> = {};
    for (const ar of accountRuntimes) {
      if (!accountHasRMD(ar.account.type)) continue;
      const ownerAge = getOwnerAge(ar.account.owner);
      const ownerBirthYear = getOwnerBirthYear(ar.account.owner);
      const rmd = calculateRMD(ar.balance, ownerAge, ownerBirthYear);
      if (rmd > 0) {
        rmds[ar.account.id] = rmd;
      }
    }

    // Calculate SEPP amounts for accounts with SEPP enabled
    const seppWithdrawals: Record<string, number> = {};
    for (const ar of accountRuntimes) {
      if (!ar.account.seppEnabled || ar.account.type !== 'traditional') continue;
      const ownerAge = getOwnerAge(ar.account.owner);

      if (ownerAge < 59.5) {
        // Initialize SEPP start age
        if (ar.seppStartAge === null) {
          ar.seppStartAge = ownerAge;
        }

        if (isSEPPRequired(ar.seppStartAge, ownerAge)) {
          const seppAmount = calculateSEPPPayment(ar.balance, Math.floor(ownerAge));
          if (seppAmount > 0) {
            seppWithdrawals[ar.account.id] = seppAmount;
          }
        }
      }
    }

    // Build account states for withdrawal optimizer
    const accountStates = accountRuntimes.map((ar) => {
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

    // Optimize withdrawals
    const withdrawalPlan = optimizeWithdrawals(
      accountStates,
      spending,
      totalSSIncome,
      state.settings.filingStatus,
      state.settings.state
    );

    // Apply withdrawals to account runtimes
    for (const ar of accountRuntimes) {
      const withdrawn = withdrawalPlan.withdrawals[ar.account.id] || 0;
      if (withdrawn > 0) {
        if (ar.account.type === 'taxable' && ar.balance > 0) {
          // Reduce cost basis proportionally
          const ratio = ar.costBasis / ar.balance;
          ar.costBasis -= withdrawn * ratio;
          ar.costBasis = Math.max(0, ar.costBasis);
        }
        ar.balance -= withdrawn;
        ar.balance = Math.max(0, ar.balance);
      }
    }

    // Apply Roth conversions (if any)
    const rothConversions = withdrawalPlan.rothConversions;

    // Grow remaining balances
    for (const ar of accountRuntimes) {
      const realReturn = ar.account.expectedReturn / 100 - inflationRate;
      const growth = ar.balance * realReturn;
      ar.balance += growth;
      ar.balance = Math.max(0, ar.balance);
    }

    const totalPortfolio = accountRuntimes.reduce((sum, ar) => sum + ar.balance, 0);
    const deficit = Math.max(
      0,
      spending - (withdrawalPlan.totalGross + totalSSIncome)
    );

    if (totalPortfolio <= 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    totalTaxesPaid += withdrawalPlan.totalTax;

    years.push({
      year,
      ages,
      accountBalances: buildBalanceMap(accountRuntimes),
      ssIncome: ssIncomeMap,
      rmds,
      withdrawals: withdrawalPlan.withdrawals,
      rothConversions,
      seppWithdrawals,
      totalIncome: withdrawalPlan.totalGross + totalSSIncome,
      ordinaryIncome: withdrawalPlan.ordinaryIncome,
      capitalGains: withdrawalPlan.capitalGains,
      taxableSSIncome: 0,
      federalTax: withdrawalPlan.totalTax * 0.7, // rough split
      stateTax: withdrawalPlan.totalTax * 0.3,
      totalTax: withdrawalPlan.totalTax,
      totalSpending: spending,
      netSpending: spending,
      deficit,
      totalPortfolioValue: totalPortfolio,
      phase: 'retirement',
    });
  }

  return {
    years,
    fireAge: primaryPerson.retirementAge,
    successfulRetirement: portfolioDepletionAge === null,
    totalTaxesPaid,
    portfolioDepletionAge,
  };
}

function calculateSpending(
  appState: AppState,
  primaryAge: number,
  primaryId: string,
  secondaryId: string | null,
  ages: Record<string, number>
): number {
  // Find the applicable spending phase
  let baseSpending = 0;
  for (const phase of appState.spending.phases) {
    if (primaryAge >= phase.startAge && primaryAge <= phase.endAge) {
      baseSpending = phase.annualAmount;
      break;
    }
  }

  // If no phase matches, use the last phase or 0
  if (baseSpending === 0 && appState.spending.phases.length > 0) {
    const lastPhase = appState.spending.phases[appState.spending.phases.length - 1];
    if (primaryAge > lastPhase.endAge) {
      baseSpending = lastPhase.annualAmount;
    }
  }

  // Add healthcare costs
  let healthcareCost = 0;
  const healthcare = appState.spending.healthcare;

  // Primary person healthcare
  const primaryAge_ = ages[primaryId];
  if (primaryAge_ < 65) {
    healthcareCost += healthcare.pre65AnnualPerPerson;
  } else {
    healthcareCost += healthcare.post65AnnualPerPerson;
  }

  // Secondary person healthcare
  if (secondaryId && ages[secondaryId] !== undefined) {
    const secondaryAge = ages[secondaryId];
    if (secondaryAge < 65) {
      healthcareCost += healthcare.pre65AnnualPerPerson;
    } else {
      healthcareCost += healthcare.post65AnnualPerPerson;
    }
  }

  return baseSpending + healthcareCost;
}

function buildBalanceMap(runtimes: AccountRuntime[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ar of runtimes) {
    map[ar.account.id] = ar.balance;
  }
  return map;
}
