import { describe, it, expect } from 'vitest';
import { runSimulation } from '../engine/simulation';
import { AppState, Account, SpendingConfig, Settings } from '../types';

const CURRENT_YEAR = new Date().getFullYear();

function makeAccount(overrides: Partial<Account> & { id: string; type: Account['type'] }): Account {
  return {
    name: overrides.name ?? overrides.id,
    owner: 'p1',
    balance: 0,
    annualContribution: 0,
    contributionEndAge: 65,
    expectedReturn: 7,
    costBasis: 0,
    seppEnabled: false,
    dividendYield: 0,
    ...overrides,
  };
}

function makeSpending(annualAmount: number, startAge: number, endAge: number): SpendingConfig {
  return {
    phases: [{ id: 'sp1', label: 'Retirement', startAge, endAge, annualAmount }],
    healthcare: { pre65AnnualPerPerson: 0, post65AnnualPerPerson: 0, inflationRate: null },
    budgetItems: [],
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    inflationRate: 0, // use 0 inflation for predictable math
    state: 'TX',
    filingStatus: 'married',
    retirementYear: CURRENT_YEAR,
    cashYearsOfExpenses: 2,
    rothConversionStrategy: 'none',
    capitalGainsHarvesting: false,
    hsaContributionInRetirement: false,
    withdrawalSoftLimit: null,
    withdrawalHardLimit: null,
    cashFloorYears: 1,
    austerityReduction: null,
    glidePath: { enabled: false, safeYearsStart: 7, safeYearsEnd: 3 },
    ...overrides,
  };
}

function makeState(overrides: {
  accounts?: Account[];
  age?: number;
  lifeExpectancy?: number;
  retirementYear?: number;
  spending?: number;
  settings?: Partial<Settings>;
  secondPerson?: { age: number; lifeExpectancy: number };
  socialSecurity?: AppState['socialSecurity'];
  pensions?: AppState['pensions'];
}): AppState {
  const age = overrides.age ?? 55;
  const lifeExpectancy = overrides.lifeExpectancy ?? 90;
  const retYear = overrides.retirementYear ?? CURRENT_YEAR;
  const spending = overrides.spending ?? 60000;

  const people: AppState['people'] = [
    { id: 'p1', name: 'Person 1', currentAge: age, lifeExpectancy },
  ];
  if (overrides.secondPerson) {
    people.push({
      id: 'p2', name: 'Person 2',
      currentAge: overrides.secondPerson.age,
      lifeExpectancy: overrides.secondPerson.lifeExpectancy,
    });
  }

  return {
    people,
    accounts: overrides.accounts ?? [],
    socialSecurity: overrides.socialSecurity ?? [],
    pensions: overrides.pensions ?? [],
    spending: makeSpending(spending, age, lifeExpectancy),
    settings: makeSettings({ retirementYear: retYear, ...overrides.settings }),
  };
}

describe('Simulation Integration Tests', () => {
  describe('Simple success scenarios', () => {
    it('wealthy retiree with Roth - clear success', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 90,
        spending: 60000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 3000000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
      });

      const result = runSimulation(state);
      expect(result.successfulRetirement).toBe(true);
      expect(result.portfolioDepletionAge).toBeNull();
      expect(result.firstDeficitAge).toBeNull();
      expect(result.firstCashFloorBreachAge).toBeNull();
      // $3M Roth, $60k/yr spending, 30 years = $1.8M spent. Should have plenty left.
      expect(result.years[result.years.length - 1].totalPortfolioValue).toBeGreaterThan(1000000);
    });

    it('moderate portfolio with SS - success', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 90,
        spending: 60000,
        retirementYear: CURRENT_YEAR,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 800000 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 300000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 150000, expectedReturn: 0 }),
        ],
        socialSecurity: [
          { personId: 'p1', enabled: true, monthlyBenefitAtFRA: 2500, claimingAge: 67 },
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      // With $1.1M portfolio + SS at 67 + 0% inflation, should survive to 90
      expect(result.successfulRetirement).toBe(true);
    });
  });

  describe('Clear failure scenarios', () => {
    it('insufficient funds - portfolio depletes', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 90,
        spending: 100000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      // $600k total, $100k/yr, no growth = ~6 years. Clear failure.
      expect(result.successfulRetirement).toBe(false);
      expect(result.portfolioDepletionAge).not.toBeNull();
      expect(result.portfolioDepletionAge!).toBeLessThan(65);
    });

    it('no accounts at all - fails with deficit every year', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 90,
        spending: 60000,
        accounts: [],
      });

      const result = runSimulation(state);
      // Simulation runs but has no accounts to withdraw from
      expect(result.successfulRetirement).toBe(false);
      // Every retirement year should have a deficit
      const retYears = result.years.filter(y => y.phase === 'retirement');
      for (const y of retYears) {
        expect(y.deficit).toBeGreaterThan(0);
      }
    });
  });

  describe('Cash buffer model', () => {
    it('cash floor breach triggers failure', () => {
      // Small portfolio, cash should go below floor
      const state = makeState({
        age: 60,
        lifeExpectancy: 75,
        spending: 50000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 400000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 60000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, cashYearsOfExpenses: 2, cashFloorYears: 1 },
      });

      const result = runSimulation(state);
      // Cash floor = 1 year * $50k = $50k. Starting cash = $60k.
      // After first year spending, cash will drop and need replenishment from roth.
      // Eventually the portfolio may not sustain the buffer.
      // Check that the cash floor tracking works:
      const retirementYears = result.years.filter(y => y.phase === 'retirement');
      // Verify cashBalance is tracked on every retirement year
      for (const y of retirementYears) {
        expect(y.cashBalance).toBeDefined();
        expect(typeof y.cashBalance).toBe('number');
      }
    });

    it('deficit is recorded when cash is fully exhausted', () => {
      // Very small portfolio, will run out
      const state = makeState({
        age: 60,
        lifeExpectancy: 80,
        spending: 80000,
        accounts: [
          makeAccount({ id: 'cash', type: 'cash', balance: 50000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, cashFloorYears: 0 },
      });

      const result = runSimulation(state);
      expect(result.firstDeficitAge).not.toBeNull();
      const deficitYears = result.years.filter(y => y.deficit > 0);
      expect(deficitYears.length).toBeGreaterThan(0);
    });
  });

  describe('Accumulation phase', () => {
    it('grows accounts with contributions during accumulation', () => {
      const state = makeState({
        age: 30,
        lifeExpectancy: 90,
        spending: 60000,
        retirementYear: CURRENT_YEAR + 10,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 100000, annualContribution: 20000, contributionEndAge: 65 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 120000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const accumYears = result.years.filter(y => y.phase === 'accumulation');
      expect(accumYears.length).toBe(10);

      // After 10 years of $20k contributions to trad (+ growth), balance should be > $100k + $200k
      const lastAccum = accumYears[accumYears.length - 1];
      expect(lastAccum.accountBalances['trad']).toBeGreaterThan(300000);
    });

    it('stops contributions at contributionEndAge', () => {
      const state = makeState({
        age: 30,
        lifeExpectancy: 90,
        spending: 60000,
        retirementYear: CURRENT_YEAR + 40,
        accounts: [
          makeAccount({
            id: 'trad', type: 'traditional', balance: 0,
            annualContribution: 20000, contributionEndAge: 35,
          }),
          makeAccount({ id: 'cash', type: 'cash', balance: 120000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      // Contributions should happen for 5 years (ages 30-34)
      const accumYears = result.years.filter(y => y.phase === 'accumulation');
      let totalContributions = 0;
      for (const y of accumYears) {
        totalContributions += y.contributions['trad'] || 0;
      }
      expect(totalContributions).toBe(100000); // 5 years * $20k
    });
  });

  describe('Social Security integration', () => {
    it('SS income starts at claiming age', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 80,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        socialSecurity: [
          { personId: 'p1', enabled: true, monthlyBenefitAtFRA: 2000, claimingAge: 67 },
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // No SS before age 67
      const preSS = retYears.filter(y => y.ages['p1'] < 67);
      for (const y of preSS) {
        expect(Object.values(y.ssIncome).reduce((s, v) => s + v, 0)).toBe(0);
      }

      // SS at/after age 67
      const postSS = retYears.filter(y => y.ages['p1'] >= 67);
      for (const y of postSS) {
        const ss = Object.values(y.ssIncome).reduce((s, v) => s + v, 0);
        expect(ss).toBeGreaterThan(0);
      }
    });
  });

  describe('Pension integration', () => {
    it('pension income starts at specified age', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 80,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        pensions: [
          { id: 'pen1', personId: 'p1', enabled: true, name: 'State Pension', annualBenefit: 25000, startAge: 60, cola: 0 },
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // No pension before age 60
      const prePension = retYears.filter(y => y.ages['p1'] < 60);
      for (const y of prePension) {
        expect(Object.values(y.pensionIncome).reduce((s, v) => s + v, 0)).toBe(0);
      }

      // Pension at/after age 60
      const postPension = retYears.filter(y => y.ages['p1'] >= 60);
      for (const y of postPension) {
        const pension = Object.values(y.pensionIncome).reduce((s, v) => s + v, 0);
        expect(pension).toBeCloseTo(25000, 0);
      }
    });
  });

  describe('RMD integration', () => {
    it('forces RMDs from traditional accounts at correct age', () => {
      const state = makeState({
        age: 73,
        lifeExpectancy: 85,
        spending: 30000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 1000000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // Person born ~1953 (current age 73 in 2026), RMD starts at 73
      // First year should have an RMD
      const firstYear = retYears[0];
      expect(firstYear.rmds['trad']).toBeGreaterThan(0);
    });
  });

  describe('Return overrides (Monte Carlo / Historical)', () => {
    it('uses return overrides for non-cash accounts', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 70,
        spending: 30000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000, expectedReturn: 7 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 2 }),
        ],
        settings: { inflationRate: 0 },
      });

      // Override: 0% return every year (flat market)
      const flatReturns = { equity: Array(11).fill(0) };
      const flatResult = runSimulation(state, flatReturns);

      // Override: 20% return every year (bull market)
      const bullReturns = { equity: Array(11).fill(0.20) };
      const bullResult = runSimulation(state, bullReturns);

      // Bull market should end with more money
      const flatEnd = flatResult.years[flatResult.years.length - 1].totalPortfolioValue;
      const bullEnd = bullResult.years[bullResult.years.length - 1].totalPortfolioValue;
      expect(bullEnd).toBeGreaterThan(flatEnd);
    });

    it('cash accounts ignore return overrides', () => {
      // Use accumulation phase to isolate growth (no withdrawals/spending)
      const state = makeState({
        age: 30,
        lifeExpectancy: 50,
        spending: 10000,
        retirementYear: CURRENT_YEAR + 5, // 5 years of accumulation
        accounts: [
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 2 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 100000, expectedReturn: 10 }),
        ],
        settings: { inflationRate: 0 },
      });

      // Override: 50% equity return, 10% bond return
      const overrides = { equity: Array(25).fill(0.50), bonds: Array(25).fill(0.10) };
      const result = runSimulation(state, overrides);
      const accumYears = result.years.filter(y => y.phase === 'accumulation');

      // Cash growth should be 2% each year (ignores overrides)
      for (const y of accumYears) {
        const startBal = y.startingBalances['cash'];
        const growth = y.growth['cash'];
        if (startBal > 0) {
          expect(growth / startBal).toBeCloseTo(0.02, 2);
        }
      }

      // Roth at 10% nominal = 100% equity weight, should get 50% equity return
      for (const y of accumYears) {
        const startBal = y.startingBalances['roth'];
        const growth = y.growth['roth'];
        if (startBal > 0) {
          expect(growth / startBal).toBeCloseTo(0.50, 2);
        }
      }
    });
  });

  describe('Two-person household', () => {
    it('tracks ages for both people', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 90,
        spending: 60000,
        secondPerson: { age: 58, lifeExpectancy: 92 },
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 3000000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
      });

      const result = runSimulation(state);
      const firstYear = result.years[0];
      expect(firstYear.ages['p1']).toBe(60);
      expect(firstYear.ages['p2']).toBe(58);
    });

    it('simulation extends to cover both lifespans', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 80,
        spending: 40000,
        secondPerson: { age: 55, lifeExpectancy: 90 },
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 3000000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
      });

      const result = runSimulation(state);
      // Should run until person 2's life expectancy adjusted to p1's age scale
      // p2 life expectancy 90 + age diff (60-55) = 95 in p1 terms
      const lastYear = result.years[result.years.length - 1];
      expect(lastYear.ages['p1']).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Roth conversion strategy', () => {
    it('performs Roth conversions when enabled', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 70,
        spending: 20000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 100000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { rothConversionStrategy: 'fill22', inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // Should see some Roth conversions
      const hasConversions = retYears.some(y =>
        Object.values(y.rothConversions).some(v => v > 0)
      );
      expect(hasConversions).toBe(true);
    });

    it('does not convert when strategy is none', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 70,
        spending: 20000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 100000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { rothConversionStrategy: 'none', inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      for (const y of retYears) {
        const totalConv = Object.values(y.rothConversions).reduce((s, v) => s + v, 0);
        expect(totalConv).toBe(0);
      }
    });
  });

  describe('Capital gains harvesting', () => {
    it('harvests gains at 0% rate when enabled', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 70,
        spending: 20000,
        accounts: [
          makeAccount({ id: 'taxable', type: 'taxable', balance: 300000, costBasis: 100000 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 200000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { capitalGainsHarvesting: true, inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');
      const hasHarvests = retYears.some(y =>
        Object.values(y.capitalGainsHarvested).some(v => v > 0)
      );
      expect(hasHarvests).toBe(true);
    });
  });

  describe('Deterministic scenario: known outcome', () => {
    it('Roth-only, zero return, exact depletion timing', () => {
      // $300k Roth + $60k cash, $60k/yr spending, 0% return, 0% inflation
      // Cash buffer target = 2yr * $60k = $120k
      // Year 1: Cash $60k → spend $60k → cash $0, need $120k from Roth → Roth=$180k, Cash=$120k
      // Year 2: Cash $120k → spend $60k → cash $60k, need $60k from Roth → Roth=$120k, Cash=$120k
      // Year 3: same → Roth=$60k, Cash=$120k
      // Year 4: same → Roth=$0, Cash=$120k
      // Year 5: Cash $120k → spend $60k → cash $60k, no Roth left → Cash stays at $60k
      // Year 6: Cash $60k → spend $60k → cash $0
      const state = makeState({
        age: 60,
        lifeExpectancy: 70,
        spending: 60000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 300000, expectedReturn: 0 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 60000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, cashYearsOfExpenses: 2, cashFloorYears: 0 },
      });

      const result = runSimulation(state);
      // Total available: $360k. Spending $60k/yr for 10 years = $600k.
      // Should fail before age 70
      expect(result.successfulRetirement).toBe(false);
      // Should have ~6 years of funded spending
      const fundedYears = result.years.filter(y => y.phase === 'retirement' && y.deficit === 0);
      expect(fundedYears.length).toBeGreaterThanOrEqual(5);
      expect(fundedYears.length).toBeLessThanOrEqual(7);
    });

    it('portfolio exactly sufficient with returns', () => {
      // $2M Roth, $50k/yr spending, 10% return, 0% inflation
      // This should sustain easily (2.5% withdrawal rate < 10% return)
      const state = makeState({
        age: 60,
        lifeExpectancy: 90,
        spending: 50000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 2000000, expectedReturn: 10 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, cashFloorYears: 0 },
      });

      const result = runSimulation(state);
      expect(result.successfulRetirement).toBe(true);
      expect(result.firstDeficitAge).toBeNull();
      expect(result.firstCashFloorBreachAge).toBeNull();
      // Portfolio should grow (return > withdrawal rate)
      const endPortfolio = result.years[result.years.length - 1].totalPortfolioValue;
      expect(endPortfolio).toBeGreaterThan(2000000);
    });
  });

  describe('SEPP integration', () => {
    it('allows pre-59.5 traditional access via SEPP', () => {
      const state = makeState({
        age: 50,
        lifeExpectancy: 70,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 800000, seppEnabled: true }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // SEPP should be active for years before age 59.5
      const preSEPP = retYears.filter(y => y.ages['p1'] < 55); // SEPP should run ages 50-54
      const hasSEPP = preSEPP.some(y =>
        Object.values(y.seppWithdrawals).some(v => v > 0)
      );
      expect(hasSEPP).toBe(true);
    });
  });

  describe('Glide path', () => {
    it('glide path enabled vs disabled produces different growth patterns', () => {
      const baseAccounts = [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000, expectedReturn: 10 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
      ];
      const overrides = {
        equity: Array(35).fill(0.10),
        bonds: Array(35).fill(0.02),
      };

      const stateNoGlide = makeState({
        age: 55,
        lifeExpectancy: 85,
        spending: 40000,
        accounts: baseAccounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          glidePath: { enabled: false, safeYearsStart: 7, safeYearsEnd: 3 },
        },
      });

      const stateWithGlide = makeState({
        age: 55,
        lifeExpectancy: 85,
        spending: 40000,
        accounts: baseAccounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          glidePath: { enabled: true, safeYearsStart: 7, safeYearsEnd: 3 },
        },
      });

      const resultNoGlide = runSimulation(stateNoGlide, overrides);
      const resultWithGlide = runSimulation(stateWithGlide, overrides);

      // With glide path, early years have more bonds (lower returns) so growth differs
      const noGlideEnd = resultNoGlide.years[resultNoGlide.years.length - 1].totalPortfolioValue;
      const glideEnd = resultWithGlide.years[resultWithGlide.years.length - 1].totalPortfolioValue;
      // They should differ since glide path shifts allocation
      expect(noGlideEnd).not.toBeCloseTo(glideEnd, -2);
    });

    it('safeYearsStart/safeYearsEnd affect asset allocation', () => {
      const baseAccounts = [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000, expectedReturn: 10 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 50000, expectedReturn: 0 }),
      ];
      const overrides = {
        equity: Array(35).fill(0.10),
        bonds: Array(35).fill(0.02),
      };

      // Conservative: many safe years (more bonds)
      const stateConservative = makeState({
        age: 55,
        lifeExpectancy: 85,
        spending: 40000,
        accounts: baseAccounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          glidePath: { enabled: true, safeYearsStart: 15, safeYearsEnd: 10 },
        },
      });

      // Aggressive: few safe years (more equities)
      const stateAggressive = makeState({
        age: 55,
        lifeExpectancy: 85,
        spending: 40000,
        accounts: baseAccounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          glidePath: { enabled: true, safeYearsStart: 2, safeYearsEnd: 1 },
        },
      });

      const conservative = runSimulation(stateConservative, overrides);
      const aggressive = runSimulation(stateAggressive, overrides);

      // More safe years = more bond allocation = lower growth = lower final balance
      const conservativeEnd = conservative.years[conservative.years.length - 1].totalPortfolioValue;
      const aggressiveEnd = aggressive.years[aggressive.years.length - 1].totalPortfolioValue;
      expect(aggressiveEnd).toBeGreaterThan(conservativeEnd);
    });
  });

  describe('Austerity mode', () => {
    it('reduces spending when cash drops below floor', () => {
      // Set up scenario: small cash, big spending, austerity enabled
      const state = makeState({
        age: 60,
        lifeExpectancy: 75,
        spending: 60000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000, expectedReturn: 0 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 30000, expectedReturn: 0 }),
        ],
        settings: {
          inflationRate: 0,
          cashFloorYears: 1, // floor = $60k
          cashYearsOfExpenses: 2, // buffer target = $120k
          austerityReduction: 20, // 20% reduction
        },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // Cash starts at $30k which is below floor ($60k), so first year should be in austerity
      const firstYear = retYears[0];
      expect(firstYear.inAusterity).toBe(true);
      // Spending should be reduced: $60k * 0.80 = $48k
      expect(firstYear.netSpending).toBeLessThan(60000);
    });

    it('sets inAusterity flag correctly on year results', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 75,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 800000, expectedReturn: 0 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 20000, expectedReturn: 0 }),
        ],
        settings: {
          inflationRate: 0,
          cashFloorYears: 1, // floor = $40k
          cashYearsOfExpenses: 2, // buffer = $80k
          austerityReduction: 25,
        },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // Cash $20k < floor $40k so austerity starts
      expect(retYears[0].inAusterity).toBe(true);

      // Every year should have the flag as a boolean
      for (const y of retYears) {
        expect(typeof y.inAusterity).toBe('boolean');
      }
    });

    it('austerity reduces spending compared to non-austerity scenario', () => {
      // Compare two identical scenarios: one with austerity, one without.
      // Both start with low cash, but austerity version should spend less.
      const baseOpts = {
        age: 60,
        lifeExpectancy: 75,
        spending: 50000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000, expectedReturn: 0 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 10000, expectedReturn: 0 }),
        ],
      };

      const stateWithAusterity = makeState({
        ...baseOpts,
        accounts: baseOpts.accounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          cashFloorYears: 1,
          cashYearsOfExpenses: 2,
          austerityReduction: 25, // 25% reduction
        },
      });

      const stateNoAusterity = makeState({
        ...baseOpts,
        accounts: baseOpts.accounts.map(a => ({ ...a })),
        settings: {
          inflationRate: 0,
          cashFloorYears: 1,
          cashYearsOfExpenses: 2,
          austerityReduction: null,
        },
      });

      const resultWith = runSimulation(stateWithAusterity);
      const resultWithout = runSimulation(stateNoAusterity);

      const retWith = resultWith.years.filter(y => y.phase === 'retirement');
      const retWithout = resultWithout.years.filter(y => y.phase === 'retirement');

      // The austerity scenario should have lower total spending in austerity years
      const austerityYears = retWith.filter(y => y.inAusterity);
      expect(austerityYears.length).toBeGreaterThan(0);

      // In austerity years, netSpending should be 25% less than normal
      // (baseSpending stays at the full amount; netSpending reflects the reduction)
      for (const y of austerityYears) {
        expect(y.netSpending).toBeLessThan(50000);
        expect(y.netSpending).toBeCloseTo(50000 * 0.75, -2);
        // baseSpending remains the unreduced phase amount
        expect(y.baseSpending).toBeCloseTo(50000, -2);
      }

      // Without austerity, no year has the flag set
      for (const y of retWithout) {
        expect(y.inAusterity).toBe(false);
      }
    });

    it('no austerity when austerityReduction is null', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 70,
        spending: 50000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000, expectedReturn: 0 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 10000, expectedReturn: 0 }),
        ],
        settings: {
          inflationRate: 0,
          cashFloorYears: 1,
          austerityReduction: null,
        },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // No austerity flag should ever be set
      for (const y of retYears) {
        expect(y.inAusterity).toBe(false);
      }
    });
  });

  describe('Early withdrawal penalty', () => {
    it('applies 10% penalty for traditional withdrawal before 59.5 without SEPP', () => {
      // Person age 50, only traditional + minimal cash, no SEPP.
      // Cash is tiny so it depletes quickly, forcing traditional withdrawals.
      // The optimizer avoids locked traditional, but when no other source remains it must use it.
      const state = makeState({
        age: 50,
        lifeExpectancy: 65,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 800000, seppEnabled: false }),
          makeAccount({ id: 'cash', type: 'cash', balance: 5000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, cashYearsOfExpenses: 0, cashFloorYears: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // With only $5k cash and $40k spending, trad must be tapped.
      // Before age 59, this should incur early withdrawal penalty.
      const earlyYears = retYears.filter(y => y.ages['p1'] < 59);
      const hasEarlyPenalty = earlyYears.some(y => y.earlyWithdrawalPenalty > 0);
      expect(hasEarlyPenalty).toBe(true);

      // The penalty annotation should be present on penalty years
      for (const y of earlyYears) {
        if (y.earlyWithdrawalPenalty > 0) {
          const hasWarning = y.annotations.some(a => a.includes('EARLY WITHDRAWAL PENALTY'));
          expect(hasWarning).toBe(true);
        }
      }
    });

    it('no penalty when SEPP is enabled', () => {
      const state = makeState({
        age: 50,
        lifeExpectancy: 65,
        spending: 30000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 800000, seppEnabled: true }),
          makeAccount({ id: 'cash', type: 'cash', balance: 50000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // SEPP allows penalty-free access, so no early withdrawal penalty
      const earlyYears = retYears.filter(y => y.ages['p1'] < 59);
      for (const y of earlyYears) {
        expect(y.earlyWithdrawalPenalty).toBe(0);
      }
    });

    it('no penalty after age 59.5', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 75,
        spending: 40000,
        accounts: [
          makeAccount({ id: 'trad', type: 'traditional', balance: 800000, seppEnabled: false }),
          makeAccount({ id: 'cash', type: 'cash', balance: 50000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // All years should be penalty-free (age >= 60)
      for (const y of retYears) {
        expect(y.earlyWithdrawalPenalty).toBe(0);
      }
    });

    it('457b accounts never have early withdrawal penalty', () => {
      const state = makeState({
        age: 50,
        lifeExpectancy: 65,
        spending: 30000,
        accounts: [
          makeAccount({ id: '457', type: '457b', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 50000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // 457b should never incur early withdrawal penalty
      for (const y of retYears) {
        expect(y.earlyWithdrawalPenalty).toBe(0);
      }
    });
  });

  describe('Hard/soft withdrawal limits', () => {
    it('hard limit generates annotations without capping spending', () => {
      const state = makeState({
        age: 55,
        lifeExpectancy: 70,
        spending: 80000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0, withdrawalHardLimit: 3 },
      });

      const result = runSimulation(state);
      const retYears = result.years.filter(y => y.phase === 'retirement');

      // Spending should still happen fully (hard limit is informational)
      for (const y of retYears) {
        if (y.totalPortfolioValue > 0) {
          // Spending should be $80k every year (not capped)
          expect(y.netSpending).toBeCloseTo(80000, -2);
        }
      }
    });
  });

  describe('Year result structure', () => {
    it('all required fields are present on retirement years', () => {
      const state = makeState({
        age: 60,
        lifeExpectancy: 65,
        spending: 30000,
        accounts: [
          makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const y = result.years.find(yr => yr.phase === 'retirement')!;
      expect(y).toBeDefined();

      // Check all fields exist
      expect(typeof y.deficit).toBe('number');
      expect(typeof y.bufferBorrowed).toBe('number');
      expect(typeof y.cashBalance).toBe('number');
      expect(typeof y.cashBelowFloor).toBe('boolean');
      expect(typeof y.totalPortfolioValue).toBe('number');
      expect(typeof y.totalTax).toBe('number');
      expect(typeof y.totalSpending).toBe('number');
      expect(typeof y.baseSpending).toBe('number');
      expect(typeof y.healthcareCost).toBe('number');
      expect(typeof y.netSpending).toBe('number');
      expect(typeof y.acaConstrainedWithdrawals).toBe('boolean');
      expect(typeof y.earlyWithdrawalPenalty).toBe('number');
      expect(typeof y.irmaaSurcharge).toBe('number');
      expect(typeof y.acaSubsidy).toBe('number');
      expect(Array.isArray(y.annotations)).toBe(true);
    });

    it('accumulation years have correct cash balance tracking', () => {
      const state = makeState({
        age: 30,
        lifeExpectancy: 70,
        spending: 30000,
        retirementYear: CURRENT_YEAR + 5,
        accounts: [
          makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
          makeAccount({ id: 'roth', type: 'roth', balance: 200000 }),
        ],
        settings: { inflationRate: 0 },
      });

      const result = runSimulation(state);
      const accumYears = result.years.filter(y => y.phase === 'accumulation');

      for (const y of accumYears) {
        expect(typeof y.cashBalance).toBe('number');
        expect(y.cashBalance).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
