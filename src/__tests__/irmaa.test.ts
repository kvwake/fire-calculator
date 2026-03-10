import { describe, it, expect } from 'vitest';
import { calculateIRMAA, getIRMAAThreshold } from '../data/irmaa';

describe('IRMAA (Medicare Surcharges)', () => {
  describe('calculateIRMAA', () => {
    it('returns 0 for no Medicare-eligible people', () => {
      const result = calculateIRMAA(300000, 'married', 0);
      expect(result.annualSurcharge).toBe(0);
      expect(result.tier).toBe(0);
    });

    it('returns 0 when MAGI is below all thresholds', () => {
      const result = calculateIRMAA(100000, 'married', 2);
      expect(result.annualSurcharge).toBe(0);
      expect(result.tier).toBe(0);
    });

    it('calculates Tier 1 for married', () => {
      // Married Tier 1: >$212,000
      const result = calculateIRMAA(220000, 'married', 1);
      expect(result.tier).toBe(1);
      expect(result.annualSurcharge).toBeCloseTo((74.00 + 13.70) * 12, 0);
    });

    it('doubles surcharge for 2 Medicare-eligible people', () => {
      const result1 = calculateIRMAA(220000, 'married', 1);
      const result2 = calculateIRMAA(220000, 'married', 2);
      expect(result2.annualSurcharge).toBeCloseTo(result1.annualSurcharge * 2, 0);
    });

    it('calculates Tier 5 for very high income', () => {
      const result = calculateIRMAA(800000, 'married', 1);
      expect(result.tier).toBe(5);
      expect(result.annualSurcharge).toBeCloseTo((443.90 + 85.80) * 12, 0);
    });

    it('uses single thresholds for single filers', () => {
      // Single Tier 1: >$106,000
      const result = calculateIRMAA(110000, 'single', 1);
      expect(result.tier).toBe(1);
    });
  });

  describe('getIRMAAThreshold', () => {
    it('returns $106,000 for single', () => {
      expect(getIRMAAThreshold('single')).toBe(106000);
    });

    it('returns $212,000 for married', () => {
      expect(getIRMAAThreshold('married')).toBe(212000);
    });
  });
});
