import { describe, it, expect } from 'vitest';
import { isHSAEligible, getHSAContributionLimit } from '../data/hsa';

describe('HSA', () => {
  describe('isHSAEligible', () => {
    it('returns true for ages under 65', () => {
      expect(isHSAEligible(30)).toBe(true);
      expect(isHSAEligible(64)).toBe(true);
    });

    it('returns false for age 65 and above', () => {
      expect(isHSAEligible(65)).toBe(false);
      expect(isHSAEligible(70)).toBe(false);
    });
  });

  describe('getHSAContributionLimit', () => {
    it('returns 0 for no eligible people', () => {
      expect(getHSAContributionLimit('single', [])).toBe(0);
    });

    it('returns single limit for single filer', () => {
      expect(getHSAContributionLimit('single', [40])).toBe(4300);
    });

    it('returns family limit for married filer', () => {
      expect(getHSAContributionLimit('married', [40])).toBe(8550);
    });

    it('adds catch-up for person age 55+', () => {
      expect(getHSAContributionLimit('single', [56])).toBe(4300 + 1000);
    });

    it('adds catch-up for each person 55+ in married filing', () => {
      expect(getHSAContributionLimit('married', [56, 58])).toBe(8550 + 2000);
    });

    it('only adds catch-up for eligible people 55+', () => {
      // One person 55+, one under
      expect(getHSAContributionLimit('married', [40, 56])).toBe(8550 + 1000);
    });
  });
});
