import { describe, it, expect } from 'vitest';
import {
  calculateStateTax,
  getStateTaxInfo,
  getAllStates,
} from '../data/stateTax';

describe('State Tax', () => {
  describe('getStateTaxInfo', () => {
    it('returns info for valid state', () => {
      const tx = getStateTaxInfo('TX');
      expect(tx).not.toBeNull();
      expect(tx!.hasNoIncomeTax).toBe(true);
    });

    it('returns null for invalid state', () => {
      expect(getStateTaxInfo('XX')).toBeNull();
    });
  });

  describe('getAllStates', () => {
    it('returns 51 entries (50 states + DC)', () => {
      const states = getAllStates();
      expect(states.length).toBe(51);
    });

    it('is sorted by name', () => {
      const states = getAllStates();
      for (let i = 1; i < states.length; i++) {
        expect(states[i].name >= states[i - 1].name).toBe(true);
      }
    });
  });

  describe('calculateStateTax', () => {
    it('returns 0 for no-income-tax states', () => {
      expect(calculateStateTax(100000, 'TX', 'single')).toBe(0);
      expect(calculateStateTax(100000, 'FL', 'single')).toBe(0);
      expect(calculateStateTax(100000, 'NV', 'single')).toBe(0);
      expect(calculateStateTax(100000, 'WA', 'single')).toBe(0);
    });

    it('calculates tax for states with brackets', () => {
      // California has progressive brackets
      const tax = calculateStateTax(100000, 'CA', 'single');
      expect(tax).toBeGreaterThan(0);
    });

    it('returns 0 for zero income', () => {
      expect(calculateStateTax(0, 'CA', 'single')).toBe(0);
    });

    it('handles SS exemptions for exempt states', () => {
      const info = getStateTaxInfo('CA');
      // CA exempts SS from state tax
      if (info?.ssExemption === 'exempt') {
        const withSS = calculateStateTax(50000, 'CA', 'single', { ssIncome: 20000, capitalGains: 0 });
        const withoutSS = calculateStateTax(30000, 'CA', 'single');
        expect(withSS).toBeCloseTo(withoutSS, 0);
      }
    });
  });
});
