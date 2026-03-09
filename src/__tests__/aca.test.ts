import { describe, it, expect } from 'vitest';
import { calculateACASubsidy, getACACliff } from '../data/aca';

describe('ACA (Affordable Care Act)', () => {
  describe('getACACliff', () => {
    it('returns 400% FPL for household of 1', () => {
      // FPL_BASE = $15,650
      expect(getACACliff(1)).toBe(15650 * 4);
    });

    it('returns 400% FPL for household of 2', () => {
      // FPL = $15,650 + $5,500 = $21,150
      expect(getACACliff(2)).toBe(21150 * 4);
    });
  });

  describe('calculateACASubsidy', () => {
    it('returns zero for no people needing coverage', () => {
      const result = calculateACASubsidy(50000, 'married', 2, []);
      expect(result.annualSubsidy).toBe(0);
    });

    it('provides full subsidy below 150% FPL', () => {
      // Household of 1, FPL = $15,650. 150% = $23,475
      const result = calculateACASubsidy(20000, 'single', 1, [50]);
      expect(result.annualSubsidy).toBe(result.fullPremiumCost); // 0% contribution
      expect(result.annualPremiumCost).toBe(0);
    });

    it('provides partial subsidy in middle bands', () => {
      // 250% FPL for household of 2 = ~$52,875
      const cliff = getACACliff(2);
      const magi = cliff * 0.6; // ~250% FPL
      const result = calculateACASubsidy(magi, 'married', 2, [55, 55]);
      expect(result.annualSubsidy).toBeGreaterThan(0);
      expect(result.annualSubsidy).toBeLessThan(result.fullPremiumCost);
      expect(result.overCliff).toBe(false);
    });

    it('returns zero subsidy above 400% FPL cliff', () => {
      const cliff = getACACliff(2);
      const result = calculateACASubsidy(cliff + 1000, 'married', 2, [55, 55]);
      expect(result.annualSubsidy).toBe(0);
      expect(result.overCliff).toBe(true);
    });

    it('returns zero subsidy below 100% FPL (Medicaid range)', () => {
      const result = calculateACASubsidy(10000, 'single', 1, [50]);
      expect(result.annualSubsidy).toBe(0);
      expect(result.overCliff).toBe(false);
    });

    it('higher ages have higher premiums', () => {
      const young = calculateACASubsidy(30000, 'single', 1, [35]);
      const old = calculateACASubsidy(30000, 'single', 1, [60]);
      expect(old.fullPremiumCost).toBeGreaterThan(young.fullPremiumCost);
    });

    it('cliff value is included in result', () => {
      const result = calculateACASubsidy(50000, 'married', 2, [55]);
      expect(result.cliff400FPL).toBe(getACACliff(2));
    });
  });
});
