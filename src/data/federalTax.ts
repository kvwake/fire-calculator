import { FilingStatus } from '../types';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

// 2025 Federal Income Tax Brackets
const SINGLE_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const MARRIED_BRACKETS: TaxBracket[] = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

// 2025 Long-Term Capital Gains Brackets
const SINGLE_LTCG_BRACKETS: TaxBracket[] = [
  { min: 0, max: 48350, rate: 0.00 },
  { min: 48350, max: 533400, rate: 0.15 },
  { min: 533400, max: Infinity, rate: 0.20 },
];

const MARRIED_LTCG_BRACKETS: TaxBracket[] = [
  { min: 0, max: 96700, rate: 0.00 },
  { min: 96700, max: 600050, rate: 0.15 },
  { min: 600050, max: Infinity, rate: 0.20 },
];

// 2025 Standard Deduction
const STANDARD_DEDUCTION = {
  single: 15000,
  married: 30000,
};

// Net Investment Income Tax (NIIT) threshold
const NIIT_THRESHOLD = {
  single: 200000,
  married: 250000,
};
const NIIT_RATE = 0.038;

export function getFederalBrackets(status: FilingStatus): TaxBracket[] {
  return status === 'single' ? SINGLE_BRACKETS : MARRIED_BRACKETS;
}

export function getLTCGBrackets(status: FilingStatus): TaxBracket[] {
  return status === 'single' ? SINGLE_LTCG_BRACKETS : MARRIED_LTCG_BRACKETS;
}

export function getStandardDeduction(status: FilingStatus): number {
  return STANDARD_DEDUCTION[status];
}

export function calculateFederalTax(
  ordinaryIncome: number,
  ltcg: number,
  filingStatus: FilingStatus
): { incomeTax: number; capitalGainsTax: number; niit: number } {
  const deduction = getStandardDeduction(filingStatus);
  const taxableOrdinary = Math.max(0, ordinaryIncome - deduction);

  // Calculate ordinary income tax
  const brackets = getFederalBrackets(filingStatus);
  let incomeTax = 0;
  for (const bracket of brackets) {
    if (taxableOrdinary <= bracket.min) break;
    const taxableInBracket = Math.min(taxableOrdinary, bracket.max) - bracket.min;
    incomeTax += taxableInBracket * bracket.rate;
  }

  // Calculate LTCG tax
  // LTCG brackets are based on total taxable income (ordinary + LTCG)
  // but LTCG is stacked on top of ordinary income
  const ltcgBrackets = getLTCGBrackets(filingStatus);
  let capitalGainsTax = 0;
  let ltcgRemaining = ltcg;

  for (const bracket of ltcgBrackets) {
    if (ltcgRemaining <= 0) break;
    // The bracket space available is reduced by ordinary income
    const bracketStart = Math.max(bracket.min, taxableOrdinary);
    const bracketEnd = bracket.max;
    if (bracketStart >= bracketEnd) continue;

    const spaceInBracket = bracketEnd - bracketStart;
    const gainsInBracket = Math.min(ltcgRemaining, spaceInBracket);
    capitalGainsTax += gainsInBracket * bracket.rate;
    ltcgRemaining -= gainsInBracket;
  }

  // NIIT on investment income if AGI exceeds threshold
  const agi = ordinaryIncome + ltcg;
  const niitThreshold = NIIT_THRESHOLD[filingStatus];
  let niit = 0;
  if (agi > niitThreshold) {
    const excessAGI = agi - niitThreshold;
    niit = Math.min(ltcg, excessAGI) * NIIT_RATE;
  }

  return { incomeTax, capitalGainsTax, niit };
}

// Social Security taxation thresholds
// "Combined income" = AGI + nontaxable interest + 50% of SS benefits
const SS_TAX_THRESHOLDS = {
  single: { low: 25000, high: 34000 },
  married: { low: 32000, high: 44000 },
};

export function calculateTaxableSSIncome(
  ssIncome: number,
  otherIncome: number,
  filingStatus: FilingStatus
): number {
  const combinedIncome = otherIncome + ssIncome * 0.5;
  const thresholds = SS_TAX_THRESHOLDS[filingStatus];

  if (combinedIncome <= thresholds.low) {
    return 0;
  } else if (combinedIncome <= thresholds.high) {
    // Up to 50% of SS is taxable
    const excess = combinedIncome - thresholds.low;
    return Math.min(excess * 0.5, ssIncome * 0.5);
  } else {
    // Up to 85% of SS is taxable
    const tier1 = (thresholds.high - thresholds.low) * 0.5;
    const tier2 = (combinedIncome - thresholds.high) * 0.85;
    return Math.min(tier1 + tier2, ssIncome * 0.85);
  }
}
