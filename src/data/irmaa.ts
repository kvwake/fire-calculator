import { FilingStatus } from '../types';

// IRMAA (Income-Related Monthly Adjustment Amount) — Medicare surcharges
// for higher-income beneficiaries. Based on MAGI from 2 years prior.
// 2025 brackets (based on 2023 MAGI).

interface IRMAATier {
  singleMin: number;
  marriedMin: number;
  partBMonthly: number; // additional surcharge per person
  partDMonthly: number; // additional surcharge per person
}

// Standard Part B premium (2025): ~$185.00/month — not included here,
// as it's already part of the user's healthcare costs. These are the
// ADDITIONAL surcharges on top of the standard premium.
const IRMAA_TIERS: IRMAATier[] = [
  // Tier 1: $106k–$133k single, $212k–$266k married
  { singleMin: 106000, marriedMin: 212000, partBMonthly: 74.00, partDMonthly: 13.70 },
  // Tier 2: $133k–$167k single, $266k–$334k married
  { singleMin: 133000, marriedMin: 266000, partBMonthly: 185.00, partDMonthly: 35.30 },
  // Tier 3: $167k–$200k single, $334k–$400k married
  { singleMin: 167000, marriedMin: 334000, partBMonthly: 295.90, partDMonthly: 56.80 },
  // Tier 4: $200k–$500k single, $400k–$750k married
  { singleMin: 200000, marriedMin: 400000, partBMonthly: 406.90, partDMonthly: 78.30 },
  // Tier 5: >$500k single, >$750k married
  { singleMin: 500000, marriedMin: 750000, partBMonthly: 443.90, partDMonthly: 85.80 },
];

export interface IRMAAResult {
  annualSurcharge: number; // total annual IRMAA surcharge for the household
  partBSurcharge: number;
  partDSurcharge: number;
  tier: number; // 0 = no surcharge, 1-5 = IRMAA tier
  description: string;
}

// Calculate IRMAA surcharge for a given year.
// magi: Modified Adjusted Gross Income from 2 years prior
// medicareEligibleCount: number of people in household on Medicare (age 65+)
export function calculateIRMAA(
  magi: number,
  filingStatus: FilingStatus,
  medicareEligibleCount: number
): IRMAAResult {
  if (medicareEligibleCount === 0) {
    return { annualSurcharge: 0, partBSurcharge: 0, partDSurcharge: 0, tier: 0, description: '' };
  }

  let selectedTier: IRMAATier | null = null;
  let tierNumber = 0;

  for (let i = IRMAA_TIERS.length - 1; i >= 0; i--) {
    const tier = IRMAA_TIERS[i];
    const threshold = filingStatus === 'single' ? tier.singleMin : tier.marriedMin;
    if (magi > threshold) {
      selectedTier = tier;
      tierNumber = i + 1;
      break;
    }
  }

  if (!selectedTier) {
    return { annualSurcharge: 0, partBSurcharge: 0, partDSurcharge: 0, tier: 0, description: '' };
  }

  const partBAnnual = selectedTier.partBMonthly * 12 * medicareEligibleCount;
  const partDAnnual = selectedTier.partDMonthly * 12 * medicareEligibleCount;
  const total = partBAnnual + partDAnnual;

  const threshold = filingStatus === 'single' ? selectedTier.singleMin : selectedTier.marriedMin;

  return {
    annualSurcharge: total,
    partBSurcharge: partBAnnual,
    partDSurcharge: partDAnnual,
    tier: tierNumber,
    description:
      `IRMAA surcharge (Tier ${tierNumber}): $${Math.round(total).toLocaleString()}/year ` +
      `($${Math.round(partBAnnual).toLocaleString()} Part B + $${Math.round(partDAnnual).toLocaleString()} Part D). ` +
      `Because your income 2 years ago exceeded $${threshold.toLocaleString()}, Medicare charges ` +
      `an extra premium on top of the standard rate. This applies to ${medicareEligibleCount} ` +
      `person${medicareEligibleCount > 1 ? 's' : ''} in the household.`,
  };
}

// Get the IRMAA threshold for the lowest tier (used for optimization)
export function getIRMAAThreshold(filingStatus: FilingStatus): number {
  return filingStatus === 'single' ? IRMAA_TIERS[0].singleMin : IRMAA_TIERS[0].marriedMin;
}
