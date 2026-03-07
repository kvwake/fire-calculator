// Social Security constants and calculations

// Full Retirement Age for those born 1960+
export const FULL_RETIREMENT_AGE = 67;
export const EARLIEST_CLAIMING_AGE = 62;
export const LATEST_CLAIMING_AGE = 70;

// 2025 maximum monthly benefit at FRA
export const MAX_MONTHLY_BENEFIT_AT_FRA = 4018;

// Reduction for early claiming:
// First 36 months early: 5/9 of 1% per month (6.67% per year)
// Months 37-60 early: 5/12 of 1% per month (5% per year)
// Increase for delayed claiming:
// 8% per year (2/3 of 1% per month) for each year after FRA up to 70

export function adjustBenefitForClaimingAge(
  monthlyBenefitAtFRA: number,
  claimingAge: number
): number {
  const monthsFromFRA = (claimingAge - FULL_RETIREMENT_AGE) * 12;

  if (monthsFromFRA === 0) {
    return monthlyBenefitAtFRA;
  }

  if (monthsFromFRA < 0) {
    // Early claiming - reduction
    const monthsEarly = Math.abs(monthsFromFRA);
    let reductionPercent = 0;

    // First 36 months: 5/9 of 1% per month
    const firstTierMonths = Math.min(monthsEarly, 36);
    reductionPercent += firstTierMonths * (5 / 9 / 100);

    // Months 37-60: 5/12 of 1% per month
    if (monthsEarly > 36) {
      const secondTierMonths = monthsEarly - 36;
      reductionPercent += secondTierMonths * (5 / 12 / 100);
    }

    return monthlyBenefitAtFRA * (1 - reductionPercent);
  }

  // Delayed claiming - increase (8% per year, prorated monthly)
  const monthsDelayed = monthsFromFRA;
  const increasePercent = monthsDelayed * (2 / 3 / 100);
  return monthlyBenefitAtFRA * (1 + increasePercent);
}

export function getAnnualSSBenefit(
  monthlyBenefitAtFRA: number,
  claimingAge: number
): number {
  const adjustedMonthly = adjustBenefitForClaimingAge(monthlyBenefitAtFRA, claimingAge);
  return adjustedMonthly * 12;
}

// Get the reduction/increase percentage for display
export function getClaimingAdjustmentPercent(claimingAge: number): number {
  const monthsFromFRA = (claimingAge - FULL_RETIREMENT_AGE) * 12;

  if (monthsFromFRA === 0) return 0;

  if (monthsFromFRA < 0) {
    const monthsEarly = Math.abs(monthsFromFRA);
    let reductionPercent = 0;
    const firstTierMonths = Math.min(monthsEarly, 36);
    reductionPercent += firstTierMonths * (5 / 9 / 100);
    if (monthsEarly > 36) {
      reductionPercent += (monthsEarly - 36) * (5 / 12 / 100);
    }
    return -reductionPercent * 100;
  }

  return monthsFromFRA * (2 / 3 / 100) * 100;
}
