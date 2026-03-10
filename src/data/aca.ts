import { FilingStatus } from '../types';

// ACA (Affordable Care Act) premium subsidy calculations for early retirees.
// The ACA provides premium tax credits to reduce health insurance costs
// for people buying coverage on the marketplace (pre-Medicare, under 65).

// 2025 Federal Poverty Level (FPL) - continental US
// Uses 2024 HHS guidelines for 2025 plan year
const FPL_BASE = 15650; // 1-person household
const FPL_PER_ADDITIONAL = 5500; // each additional person (2-person = $21,150)

// Under the Inflation Reduction Act (IRA) enhanced subsidies (2021-2025),
// there is NO hard cliff — subsidies phase out gradually with income.
// Premium contributions are capped at a percentage of income.
// After 2025, unless extended, the cliff at 400% FPL returns:
// income above 400% FPL = NO subsidies at all.
//
// For conservative FIRE planning, we model the cliff at 400% FPL.

// ACA subsidy contribution percentages (2025 enhanced)
// These define the max % of income you pay for the benchmark silver plan.
// Below 150% FPL: 0% of income
// 150-200% FPL: 0-2% of income
// 200-250% FPL: 2-4% of income
// 250-300% FPL: 4-6% of income
// 300-400% FPL: 6-8.5% of income
// Above 400% FPL: 8.5% of income (with enhanced subsidies)
// Above 400% FPL: NO SUBSIDY (without enhanced subsidies — the "cliff")

interface ACABand {
  fplMin: number; // as multiple of FPL
  fplMax: number;
  premiumPctMin: number; // % of income at bottom of band
  premiumPctMax: number; // % of income at top of band
}

const ACA_BANDS: ACABand[] = [
  { fplMin: 1.0, fplMax: 1.5, premiumPctMin: 0, premiumPctMax: 0 },
  { fplMin: 1.5, fplMax: 2.0, premiumPctMin: 0, premiumPctMax: 0.02 },
  { fplMin: 2.0, fplMax: 2.5, premiumPctMin: 0.02, premiumPctMax: 0.04 },
  { fplMin: 2.5, fplMax: 3.0, premiumPctMin: 0.04, premiumPctMax: 0.06 },
  { fplMin: 3.0, fplMax: 4.0, premiumPctMin: 0.06, premiumPctMax: 0.085 },
  { fplMin: 4.0, fplMax: Infinity, premiumPctMin: 0.085, premiumPctMax: 0.085 },
];

// Approximate annual benchmark silver plan cost per person by age
// (2025 estimates, national average — actual varies by location)
function estimatedBenchmarkPremium(age: number): number {
  if (age < 21) return 4200;
  if (age < 30) return 5400;
  if (age < 40) return 6000;
  if (age < 50) return 7200;
  if (age < 55) return 9600;
  if (age < 60) return 12000;
  return 15600; // 60-64
}

export interface ACAResult {
  annualSubsidy: number; // how much the government pays toward your premium
  annualPremiumCost: number; // what you pay after subsidy
  fullPremiumCost: number; // unsubsidized benchmark premium
  overCliff: boolean; // true if income exceeds 400% FPL
  fplPercentage: number; // income as % of FPL
  cliff400FPL: number; // the income threshold at 400% FPL
  description: string;
}

// Calculate ACA subsidy for a household.
// magi: Modified Adjusted Gross Income (for ACA: AGI + tax-exempt interest)
// householdSize: number of people (1 or 2 for this calculator)
// ages: ages of people needing ACA coverage (pre-65 only)
export function calculateACASubsidy(
  magi: number,
  filingStatus: FilingStatus,
  householdSize: number,
  ages: number[] // ages of people needing marketplace coverage (exclude 65+)
): ACAResult {
  if (ages.length === 0) {
    return {
      annualSubsidy: 0,
      annualPremiumCost: 0,
      fullPremiumCost: 0,
      overCliff: false,
      fplPercentage: 0,
      cliff400FPL: 0,
      description: '',
    };
  }

  const fpl = FPL_BASE + FPL_PER_ADDITIONAL * (householdSize - 1);
  const fplPct = magi / fpl;
  const cliff400 = fpl * 4;

  // Total benchmark premium for all people needing coverage
  const totalBenchmark = ages.reduce((sum, age) => sum + estimatedBenchmarkPremium(age), 0);

  // If over 400% FPL, no subsidy (cliff scenario)
  if (magi > cliff400) {
    return {
      annualSubsidy: 0,
      annualPremiumCost: totalBenchmark,
      fullPremiumCost: totalBenchmark,
      overCliff: true,
      fplPercentage: fplPct * 100,
      cliff400FPL: cliff400,
      description:
        `ACA SUBSIDY LOST: Your income ($${Math.round(magi).toLocaleString()}) exceeds 400% of the Federal Poverty Level ` +
        `($${Math.round(cliff400).toLocaleString()} for a household of ${householdSize}). ` +
        `You must pay the full unsubsidized premium of ~$${Math.round(totalBenchmark).toLocaleString()}/year. ` +
        `Keeping income below $${Math.round(cliff400).toLocaleString()} would have saved ` +
        `significant money on health insurance.`,
    };
  }

  // Below 100% FPL: technically not eligible for marketplace subsidies
  // (would qualify for Medicaid in expansion states)
  if (fplPct < 1.0) {
    return {
      annualSubsidy: 0,
      annualPremiumCost: totalBenchmark,
      fullPremiumCost: totalBenchmark,
      overCliff: false,
      fplPercentage: fplPct * 100,
      cliff400FPL: cliff400,
      description: 'Income below 100% FPL — may qualify for Medicaid instead of marketplace subsidies.',
    };
  }

  // Find applicable band and calculate expected contribution
  let expectedContribution = 0;
  for (const band of ACA_BANDS) {
    if (fplPct >= band.fplMin && fplPct < band.fplMax) {
      // Interpolate within the band
      const bandPosition = (fplPct - band.fplMin) / (band.fplMax - band.fplMin);
      const pctOfIncome = band.premiumPctMin + bandPosition * (band.premiumPctMax - band.premiumPctMin);
      expectedContribution = magi * pctOfIncome;
      break;
    }
  }

  const subsidy = Math.max(0, totalBenchmark - expectedContribution);
  const netPremium = totalBenchmark - subsidy;

  const nearCliff = magi > cliff400 * 0.9;
  let desc =
    `ACA subsidy: $${Math.round(subsidy).toLocaleString()}/year toward health insurance premiums. ` +
    `Your income is ${Math.round(fplPct * 100)}% of FPL. You pay ~$${Math.round(netPremium).toLocaleString()}/year ` +
    `(benchmark premium: $${Math.round(totalBenchmark).toLocaleString()}).`;

  if (nearCliff) {
    desc +=
      ` WARNING: You are close to the 400% FPL cliff ($${Math.round(cliff400).toLocaleString()}). ` +
      `Going over would cost you the entire $${Math.round(subsidy).toLocaleString()} subsidy.`;
  }

  return {
    annualSubsidy: subsidy,
    annualPremiumCost: netPremium,
    fullPremiumCost: totalBenchmark,
    overCliff: false,
    fplPercentage: fplPct * 100,
    cliff400FPL: cliff400,
    description: desc,
  };
}

// Get the 400% FPL threshold for a household size
export function getACACliff(householdSize: number): number {
  const fpl = FPL_BASE + FPL_PER_ADDITIONAL * (householdSize - 1);
  return fpl * 4;
}
