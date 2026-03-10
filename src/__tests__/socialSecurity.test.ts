import { describe, it, expect } from 'vitest';
import {
  adjustBenefitForClaimingAge,
  getAnnualSSBenefit,
  getClaimingAdjustmentPercent,
  FULL_RETIREMENT_AGE,
} from '../data/socialSecurity';

describe('Social Security', () => {
  describe('adjustBenefitForClaimingAge', () => {
    const FRA_BENEFIT = 3000; // $3,000/month at FRA

    it('returns full benefit at FRA (67)', () => {
      expect(adjustBenefitForClaimingAge(FRA_BENEFIT, 67)).toBe(3000);
    });

    it('reduces benefit for claiming at 62 (earliest)', () => {
      const adjusted = adjustBenefitForClaimingAge(FRA_BENEFIT, 62);
      // 60 months early: 36 months * 5/9% + 24 months * 5/12%
      // = 20% + 10% = 30% reduction
      expect(adjusted).toBeCloseTo(3000 * 0.70, 0);
    });

    it('reduces benefit for claiming at 65 (2 years early)', () => {
      const adjusted = adjustBenefitForClaimingAge(FRA_BENEFIT, 65);
      // 24 months early, all in first tier: 24 * 5/9% = 13.33% reduction
      expect(adjusted).toBeCloseTo(3000 * (1 - 24 * 5 / 9 / 100), 0);
    });

    it('increases benefit for claiming at 70 (3 years delayed)', () => {
      const adjusted = adjustBenefitForClaimingAge(FRA_BENEFIT, 70);
      // 36 months delayed * 2/3% per month = 24% increase
      expect(adjusted).toBeCloseTo(3000 * 1.24, 0);
    });

    it('increases benefit for claiming at 68 (1 year delayed)', () => {
      const adjusted = adjustBenefitForClaimingAge(FRA_BENEFIT, 68);
      // 12 months * 2/3% = 8% increase
      expect(adjusted).toBeCloseTo(3000 * 1.08, 0);
    });
  });

  describe('getAnnualSSBenefit', () => {
    it('returns 12x the adjusted monthly benefit', () => {
      const annual = getAnnualSSBenefit(3000, 67);
      expect(annual).toBe(36000);
    });

    it('correctly annualizes early claiming', () => {
      const annual = getAnnualSSBenefit(3000, 62);
      expect(annual).toBeCloseTo(3000 * 0.70 * 12, 0);
    });
  });

  describe('getClaimingAdjustmentPercent', () => {
    it('returns 0 at FRA', () => {
      expect(getClaimingAdjustmentPercent(67)).toBe(0);
    });

    it('returns negative for early claiming', () => {
      expect(getClaimingAdjustmentPercent(62)).toBeCloseTo(-30, 0);
    });

    it('returns positive for delayed claiming', () => {
      expect(getClaimingAdjustmentPercent(70)).toBeCloseTo(24, 0);
    });
  });

  it('FULL_RETIREMENT_AGE is 67', () => {
    expect(FULL_RETIREMENT_AGE).toBe(67);
  });
});
