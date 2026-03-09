import { FilingStatus } from '../types';

// 2025 HSA contribution limits
const HSA_LIMIT_SINGLE = 4300;
const HSA_LIMIT_FAMILY = 8550;
const HSA_CATCHUP_55 = 1000; // additional if age 55+

// Must be under 65 (not on Medicare) to contribute
export function isHSAEligible(age: number): boolean {
  return age < 65;
}

// Get the max HSA contribution for the household.
// ages: ages of people who are HSA-eligible (under 65)
export function getHSAContributionLimit(
  filingStatus: FilingStatus,
  eligibleAges: number[]
): number {
  if (eligibleAges.length === 0) return 0;

  const base = filingStatus === 'married' ? HSA_LIMIT_FAMILY : HSA_LIMIT_SINGLE;

  // Catch-up: $1,000 extra per person age 55+
  let catchup = 0;
  for (const age of eligibleAges) {
    if (age >= 55) catchup += HSA_CATCHUP_55;
  }

  return base + catchup;
}
