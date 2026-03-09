import { describe, it, expect } from 'vitest';
import {
  getRMDStartAge,
  getDistributionPeriod,
  calculateRMD,
  accountHasRMD,
} from '../data/rmd';

describe('RMD (Required Minimum Distributions)', () => {
  describe('getRMDStartAge', () => {
    it('returns 72 for people born 1950 or earlier', () => {
      expect(getRMDStartAge(1950)).toBe(72);
      expect(getRMDStartAge(1940)).toBe(72);
    });

    it('returns 73 for people born 1951-1959', () => {
      expect(getRMDStartAge(1951)).toBe(73);
      expect(getRMDStartAge(1955)).toBe(73);
      expect(getRMDStartAge(1959)).toBe(73);
    });

    it('returns 75 for people born 1960+', () => {
      expect(getRMDStartAge(1960)).toBe(75);
      expect(getRMDStartAge(1990)).toBe(75);
    });
  });

  describe('getDistributionPeriod', () => {
    it('returns correct values from Uniform Lifetime Table', () => {
      expect(getDistributionPeriod(72)).toBe(27.4);
      expect(getDistributionPeriod(75)).toBe(24.6);
      expect(getDistributionPeriod(90)).toBe(12.2);
    });

    it('returns null for ages not in the table', () => {
      expect(getDistributionPeriod(50)).toBeNull();
      expect(getDistributionPeriod(121)).toBeNull();
    });
  });

  describe('calculateRMD', () => {
    it('returns 0 before RMD start age', () => {
      expect(calculateRMD(1000000, 72, 1960)).toBe(0); // born 1960, starts at 75
      expect(calculateRMD(1000000, 74, 1960)).toBe(0);
    });

    it('calculates correctly at RMD start age', () => {
      // Born 1960, starts at 75, period = 24.6
      const rmd = calculateRMD(1000000, 75, 1960);
      expect(rmd).toBeCloseTo(1000000 / 24.6, 0);
    });

    it('calculates correctly at older ages', () => {
      // Born 1950, age 90, period = 12.2
      const rmd = calculateRMD(500000, 90, 1950);
      expect(rmd).toBeCloseTo(500000 / 12.2, 0);
    });

    it('returns 0 for zero balance', () => {
      expect(calculateRMD(0, 75, 1960)).toBe(0);
    });
  });

  describe('accountHasRMD', () => {
    it('returns true for traditional accounts', () => {
      expect(accountHasRMD('traditional')).toBe(true);
    });

    it('returns true for 457b accounts', () => {
      expect(accountHasRMD('457b')).toBe(true);
    });

    it('returns false for Roth accounts', () => {
      expect(accountHasRMD('roth')).toBe(false);
    });

    it('returns false for other account types', () => {
      expect(accountHasRMD('taxable')).toBe(false);
      expect(accountHasRMD('hsa')).toBe(false);
      expect(accountHasRMD('cash')).toBe(false);
    });
  });
});
