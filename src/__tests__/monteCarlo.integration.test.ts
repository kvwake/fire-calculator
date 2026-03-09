import { describe, it, expect } from 'vitest';
import { runMonteCarlo, runHistoricalBacktest } from '../engine/monteCarlo';
import { AppState, Account, Settings } from '../types';

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
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    inflationRate: 3,
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
    ...overrides,
  };
}

function makeState(overrides: {
  accounts?: Account[];
  age?: number;
  lifeExpectancy?: number;
  spending?: number;
  settings?: Partial<Settings>;
  socialSecurity?: AppState['socialSecurity'];
}): AppState {
  const age = overrides.age ?? 55;
  const lifeExpectancy = overrides.lifeExpectancy ?? 90;
  const spending = overrides.spending ?? 60000;

  return {
    people: [{ id: 'p1', name: 'Person 1', currentAge: age, lifeExpectancy }],
    accounts: overrides.accounts ?? [],
    socialSecurity: overrides.socialSecurity ?? [],
    pensions: [],
    spending: {
      phases: [{ id: 'sp1', label: 'Retirement', startAge: age, endAge: lifeExpectancy, annualAmount: spending }],
      healthcare: { pre65AnnualPerPerson: 0, post65AnnualPerPerson: 0, inflationRate: null },
      budgetItems: [],
    },
    settings: makeSettings(overrides.settings),
  };
}

describe('Monte Carlo Simulation', () => {
  it('returns correct structure', () => {
    const state = makeState({
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runMonteCarlo(state, 50, 42);
    expect(result.trials).toBe(50);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
    expect(result.percentiles.p10.length).toBeGreaterThan(0);
    expect(result.percentiles.p50.length).toBe(result.percentiles.p10.length);
    expect(result.years.length).toBe(result.percentiles.p10.length);
    expect(result.ages.length).toBe(result.years.length);
    expect(result.trialEndPortfolios.length).toBe(50);
  });

  it('seeded runs produce deterministic results', () => {
    const state = makeState({
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result1 = runMonteCarlo(state, 100, 12345);
    const result2 = runMonteCarlo(state, 100, 12345);
    expect(result1.successRate).toBe(result2.successRate);
    expect(result1.medianEndPortfolio).toBe(result2.medianEndPortfolio);
  });

  it('wealthy portfolio has high success rate', () => {
    const state = makeState({
      age: 55,
      lifeExpectancy: 90,
      spending: 60000,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 3000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 300000, expectedReturn: 2 }),
      ],
      settings: { inflationRate: 0 },
    });

    const result = runMonteCarlo(state, 200, 42);
    expect(result.successRate).toBeGreaterThan(0.8);
  });

  it('underfunded portfolio has low success rate', () => {
    const state = makeState({
      age: 55,
      lifeExpectancy: 90,
      spending: 100000,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 300000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 100000, expectedReturn: 0 }),
      ],
      settings: { inflationRate: 0, cashFloorYears: 0 },
    });

    const result = runMonteCarlo(state, 200, 42);
    expect(result.successRate).toBeLessThan(0.5);
  });

  it('percentiles are ordered correctly', () => {
    const state = makeState({
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runMonteCarlo(state, 100, 42);
    for (let i = 0; i < result.percentiles.p5.length; i++) {
      expect(result.percentiles.p5[i]).toBeLessThanOrEqual(result.percentiles.p10[i]);
      expect(result.percentiles.p10[i]).toBeLessThanOrEqual(result.percentiles.p25[i]);
      expect(result.percentiles.p25[i]).toBeLessThanOrEqual(result.percentiles.p50[i]);
      expect(result.percentiles.p50[i]).toBeLessThanOrEqual(result.percentiles.p75[i]);
      expect(result.percentiles.p75[i]).toBeLessThanOrEqual(result.percentiles.p90[i]);
    }
  });

  it('end portfolios are sorted', () => {
    const state = makeState({
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runMonteCarlo(state, 50, 42);
    for (let i = 1; i < result.trialEndPortfolios.length; i++) {
      expect(result.trialEndPortfolios[i]).toBeGreaterThanOrEqual(result.trialEndPortfolios[i - 1]);
    }
  });

  it('handles empty state gracefully', () => {
    const state: AppState = {
      people: [],
      accounts: [],
      socialSecurity: [],
      pensions: [],
      spending: {
        phases: [],
        healthcare: { pre65AnnualPerPerson: 0, post65AnnualPerPerson: 0, inflationRate: null },
        budgetItems: [],
      },
      settings: makeSettings(),
    };

    const result = runMonteCarlo(state, 10);
    expect(result.trials).toBe(0);
    expect(result.successRate).toBe(0);
  });
});

describe('Historical Backtesting', () => {
  it('returns correct structure', () => {
    const state = makeState({
      age: 60,
      lifeExpectancy: 75,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runHistoricalBacktest(state);
    expect(result.totalCycles).toBeGreaterThan(0);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
    expect(result.cycles.length).toBe(result.totalCycles);
    expect(result.percentiles.p10.length).toBeGreaterThan(0);
  });

  it('cycle count matches available historical data', () => {
    const state = makeState({
      age: 60,
      lifeExpectancy: 75, // 16 years needed
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runHistoricalBacktest(state);
    // 154 years of data (1871-2024), need 16 years per cycle
    // Available starting years: 1871 to (2024 - 16 + 1) = 2009, so 139 cycles
    expect(result.totalCycles).toBe(154 - 16 + 1);
  });

  it('wealthy portfolio has high historical success', () => {
    const state = makeState({
      age: 60,
      lifeExpectancy: 85,
      spending: 40000,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 2000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
      settings: { inflationRate: 0 },
    });

    const result = runHistoricalBacktest(state);
    expect(result.successRate).toBeGreaterThan(0.8);
  });

  it('identifies worst and best start years', () => {
    const state = makeState({
      age: 60,
      lifeExpectancy: 80,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
    });

    const result = runHistoricalBacktest(state);
    expect(result.worstStartYear).not.toBeNull();
    expect(result.bestStartYear).not.toBeNull();
    expect(result.bestStartYear).not.toBe(result.worstStartYear);
  });

  it('cycles track success consistently', () => {
    const state = makeState({
      age: 60,
      lifeExpectancy: 75,
      spending: 60000,
      accounts: [
        makeAccount({ id: 'roth', type: 'roth', balance: 1000000 }),
        makeAccount({ id: 'cash', type: 'cash', balance: 200000, expectedReturn: 2 }),
      ],
      settings: { inflationRate: 0 },
    });

    const result = runHistoricalBacktest(state);
    const successCount = result.cycles.filter(c => c.successful).length;
    expect(result.successRate).toBeCloseTo(successCount / result.totalCycles, 4);
  });

  it('handles empty state gracefully', () => {
    const state: AppState = {
      people: [],
      accounts: [],
      socialSecurity: [],
      pensions: [],
      spending: {
        phases: [],
        healthcare: { pre65AnnualPerPerson: 0, post65AnnualPerPerson: 0, inflationRate: null },
        budgetItems: [],
      },
      settings: makeSettings(),
    };

    const result = runHistoricalBacktest(state);
    expect(result.totalCycles).toBe(0);
    expect(result.successRate).toBe(0);
  });
});
