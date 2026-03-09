import { AppState, SimulationResult } from '../types';
import { runSimulation } from './simulation';
import { HISTORICAL_REAL_RETURNS, HISTORICAL_MEAN_REAL_RETURN, HISTORICAL_STDDEV_REAL_RETURN } from '../data/historicalReturns';

export interface MonteCarloResult {
  successRate: number; // 0-1
  trials: number;
  percentiles: {
    p5: number[];   // portfolio value at each year (5th percentile)
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  years: number[]; // year labels corresponding to percentile arrays
  ages: number[];  // primary person age for each year
  failureYearDistribution: Record<number, number>; // age -> count of failures at that age
  medianEndPortfolio: number;
  trialEndPortfolios: number[]; // sorted end portfolio values for all trials
}

export interface HistoricalResult {
  successRate: number;
  totalCycles: number;
  cycles: {
    startYear: number;
    endPortfolio: number;
    depletionAge: number | null;
    firstDeficitAge: number | null;
    successful: boolean;
    portfolioByYear: number[];
  }[];
  percentiles: {
    p5: number[];
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  years: number[];
  ages: number[];
  worstStartYear: number | null;
  bestStartYear: number | null;
}

// Box-Muller transform for normal distribution
function randomNormal(mean: number, stddev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + stddev * z;
}

/**
 * Run Monte Carlo simulation with randomized returns.
 * Each trial randomizes the market return using a normal distribution,
 * then scales each account's return proportionally.
 */
export function runMonteCarlo(
  state: AppState,
  trials: number = 1000,
  seed?: number,
): MonteCarloResult {
  const primaryPerson = state.people[0];
  if (!primaryPerson) {
    return {
      successRate: 0,
      trials: 0,
      percentiles: { p5: [], p10: [], p25: [], p50: [], p75: [], p90: [] },
      years: [],
      ages: [],
      failureYearDistribution: {},
      medianEndPortfolio: 0,
      trialEndPortfolios: [],
    };
  }

  const inflationRate = state.settings.inflationRate / 100;
  // The "baseline" real return is what the user's stock accounts expect
  // We use the historical mean and stddev for generating random returns
  const mean = HISTORICAL_MEAN_REAL_RETURN;
  const stddev = HISTORICAL_STDDEV_REAL_RETURN;

  const maxAge = Math.max(
    primaryPerson.lifeExpectancy,
    state.people.length > 1
      ? state.people[1].lifeExpectancy + (primaryPerson.currentAge - state.people[1].currentAge)
      : 0
  );
  const numYears = maxAge - primaryPerson.currentAge + 1;
  const currentYear = new Date().getFullYear();

  // Collect all trial portfolio paths
  const allPortfolioPaths: number[][] = [];
  const endPortfolios: number[] = [];
  const failureAges: Record<number, number> = {};
  let successes = 0;

  // Seeded random for reproducibility
  let rngState = seed ?? Math.floor(Math.random() * 2147483647);
  function seededRandom(): number {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }

  function seededNormal(m: number, s: number): number {
    let u = 0, v = 0;
    while (u === 0) u = seededRandom();
    while (v === 0) v = seededRandom();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return m + s * z;
  }

  const randomFn = seed !== undefined ? seededNormal : randomNormal;

  for (let trial = 0; trial < trials; trial++) {
    // Generate random real returns for each year
    const yearReturns: number[] = [];
    for (let y = 0; y < numYears; y++) {
      yearReturns.push(randomFn(mean, stddev));
    }

    // Run simulation with return overrides
    const result = runSimulation(state, yearReturns);

    // Extract portfolio path
    const portfolioPath = result.years.map(y => y.totalPortfolioValue);
    allPortfolioPaths.push(portfolioPath);

    const endValue = portfolioPath.length > 0 ? portfolioPath[portfolioPath.length - 1] : 0;
    endPortfolios.push(endValue);

    if (result.successfulRetirement) {
      successes++;
    } else if (result.portfolioDepletionAge !== null) {
      failureAges[result.portfolioDepletionAge] = (failureAges[result.portfolioDepletionAge] || 0) + 1;
    }
  }

  // Sort end portfolios for percentile calculation
  endPortfolios.sort((a, b) => a - b);

  // Calculate percentiles at each year
  const p5: number[] = [];
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let y = 0; y < numYears; y++) {
    const values = allPortfolioPaths
      .map(path => path[y] ?? 0)
      .sort((a, b) => a - b);

    p5.push(values[Math.floor(values.length * 0.05)] ?? 0);
    p10.push(values[Math.floor(values.length * 0.10)] ?? 0);
    p25.push(values[Math.floor(values.length * 0.25)] ?? 0);
    p50.push(values[Math.floor(values.length * 0.50)] ?? 0);
    p75.push(values[Math.floor(values.length * 0.75)] ?? 0);
    p90.push(values[Math.floor(values.length * 0.90)] ?? 0);
  }

  const years = Array.from({ length: numYears }, (_, i) => currentYear + i);
  const ages = Array.from({ length: numYears }, (_, i) => primaryPerson.currentAge + i);

  return {
    successRate: trials > 0 ? successes / trials : 0,
    trials,
    percentiles: { p5, p10, p25, p50, p75, p90 },
    years,
    ages,
    failureYearDistribution: failureAges,
    medianEndPortfolio: endPortfolios[Math.floor(endPortfolios.length / 2)] ?? 0,
    trialEndPortfolios: endPortfolios,
  };
}

/**
 * Run historical backtesting using Shiller S&P 500 data.
 * Tests every possible starting year from the historical dataset.
 */
export function runHistoricalBacktest(state: AppState): HistoricalResult {
  const primaryPerson = state.people[0];
  if (!primaryPerson) {
    return {
      successRate: 0,
      totalCycles: 0,
      cycles: [],
      percentiles: { p5: [], p10: [], p25: [], p50: [], p75: [], p90: [] },
      years: [],
      ages: [],
      worstStartYear: null,
      bestStartYear: null,
    };
  }

  const maxAge = Math.max(
    primaryPerson.lifeExpectancy,
    state.people.length > 1
      ? state.people[1].lifeExpectancy + (primaryPerson.currentAge - state.people[1].currentAge)
      : 0
  );
  const numYears = maxAge - primaryPerson.currentAge + 1;
  const currentYear = new Date().getFullYear();
  const returns = HISTORICAL_REAL_RETURNS;

  const cycles: HistoricalResult['cycles'] = [];
  let successes = 0;

  // Test every possible starting year where we have enough data
  for (let startIdx = 0; startIdx <= returns.length - numYears; startIdx++) {
    const yearReturns = returns
      .slice(startIdx, startIdx + numYears)
      .map(r => r.realReturn);

    const result = runSimulation(state, yearReturns);

    const portfolioPath = result.years.map(y => y.totalPortfolioValue);

    cycles.push({
      startYear: returns[startIdx].year,
      endPortfolio: portfolioPath.length > 0 ? portfolioPath[portfolioPath.length - 1] : 0,
      depletionAge: result.portfolioDepletionAge,
      firstDeficitAge: result.firstDeficitAge,
      successful: result.successfulRetirement,
      portfolioByYear: portfolioPath,
    });

    if (result.successfulRetirement) {
      successes++;
    }
  }

  // Calculate percentiles
  const p5: number[] = [];
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let y = 0; y < numYears; y++) {
    const values = cycles
      .map(c => c.portfolioByYear[y] ?? 0)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      p5.push(0); p10.push(0); p25.push(0); p50.push(0); p75.push(0); p90.push(0);
    } else {
      p5.push(values[Math.floor(values.length * 0.05)]);
      p10.push(values[Math.floor(values.length * 0.10)]);
      p25.push(values[Math.floor(values.length * 0.25)]);
      p50.push(values[Math.floor(values.length * 0.50)]);
      p75.push(values[Math.floor(values.length * 0.75)]);
      p90.push(values[Math.floor(values.length * 0.90)]);
    }
  }

  const worstCycle = cycles.length > 0
    ? cycles.reduce((worst, c) => c.endPortfolio < worst.endPortfolio ? c : worst)
    : null;
  const bestCycle = cycles.length > 0
    ? cycles.reduce((best, c) => c.endPortfolio > best.endPortfolio ? c : best)
    : null;

  const years = Array.from({ length: numYears }, (_, i) => currentYear + i);
  const ages = Array.from({ length: numYears }, (_, i) => primaryPerson.currentAge + i);

  return {
    successRate: cycles.length > 0 ? successes / cycles.length : 0,
    totalCycles: cycles.length,
    cycles,
    percentiles: { p5, p10, p25, p50, p75, p90 },
    years,
    ages,
    worstStartYear: worstCycle?.startYear ?? null,
    bestStartYear: bestCycle?.startYear ?? null,
  };
}
