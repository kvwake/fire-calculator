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

    describe('additional no-income-tax states', () => {
      it('returns 0 for WY, SD, AK, NH, TN', () => {
        const noTaxStates = ['WY', 'SD', 'AK', 'NH', 'TN'];
        for (const st of noTaxStates) {
          const info = getStateTaxInfo(st);
          expect(info).not.toBeNull();
          expect(info!.hasNoIncomeTax).toBe(true);
          expect(calculateStateTax(80000, st, 'married')).toBe(0);
          expect(calculateStateTax(250000, st, 'married')).toBe(0);
        }
      });
    });

    describe('New York - high progressive brackets', () => {
      it('taxes moderate income ($80k MFJ)', () => {
        const tax = calculateStateTax(80000, 'NY', 'married');
        expect(tax).toBeGreaterThan(0);
        // NY effective rate at $80k MFJ should be roughly 3-5%
        expect(tax).toBeGreaterThan(80000 * 0.02);
        expect(tax).toBeLessThan(80000 * 0.07);
      });

      it('taxes high income ($250k MFJ)', () => {
        const tax = calculateStateTax(250000, 'NY', 'married');
        expect(tax).toBeGreaterThan(0);
        // Higher income = higher effective rate
        const moderateTax = calculateStateTax(80000, 'NY', 'married');
        expect(tax / 250000).toBeGreaterThan(moderateTax / 80000);
      });
    });

    describe('Illinois - flat tax (4.95%)', () => {
      it('taxes moderate income ($80k MFJ) at flat rate', () => {
        // IL has no standard deduction, flat 4.95%
        const tax = calculateStateTax(80000, 'IL', 'married');
        expect(tax).toBeCloseTo(80000 * 0.0495, 0);
      });

      it('taxes high income ($250k MFJ) at flat rate', () => {
        const tax = calculateStateTax(250000, 'IL', 'married');
        expect(tax).toBeCloseTo(250000 * 0.0495, 0);
      });

      it('effective rate is the same at all income levels', () => {
        const rate80k = calculateStateTax(80000, 'IL', 'married') / 80000;
        const rate250k = calculateStateTax(250000, 'IL', 'married') / 250000;
        expect(rate80k).toBeCloseTo(rate250k, 4);
      });
    });

    describe('Pennsylvania - flat tax (3.07%)', () => {
      it('taxes moderate income ($80k MFJ) at flat rate', () => {
        const tax = calculateStateTax(80000, 'PA', 'married');
        expect(tax).toBeCloseTo(80000 * 0.0307, 0);
      });

      it('taxes high income ($250k MFJ) at flat rate', () => {
        const tax = calculateStateTax(250000, 'PA', 'married');
        expect(tax).toBeCloseTo(250000 * 0.0307, 0);
      });

      it('PA rate is lower than IL rate', () => {
        const paTax = calculateStateTax(100000, 'PA', 'married');
        const ilTax = calculateStateTax(100000, 'IL', 'married');
        expect(paTax).toBeLessThan(ilTax);
      });
    });

    describe('Oregon - high progressive brackets', () => {
      it('taxes moderate income ($80k MFJ)', () => {
        const tax = calculateStateTax(80000, 'OR', 'married');
        expect(tax).toBeGreaterThan(0);
        // OR has high rates, effective rate should be notable
        expect(tax).toBeGreaterThan(80000 * 0.03);
      });

      it('taxes high income ($250k MFJ)', () => {
        const tax = calculateStateTax(250000, 'OR', 'married');
        expect(tax).toBeGreaterThan(0);
        expect(tax).toBeGreaterThan(250000 * 0.05);
      });
    });

    describe('Minnesota - high progressive brackets', () => {
      it('taxes moderate income ($80k MFJ)', () => {
        const tax = calculateStateTax(80000, 'MN', 'married');
        expect(tax).toBeGreaterThan(0);
      });

      it('taxes high income ($250k MFJ)', () => {
        const tax = calculateStateTax(250000, 'MN', 'married');
        expect(tax).toBeGreaterThan(0);
        // Progressive: higher effective rate at $250k than $80k
        const moderateTax = calculateStateTax(80000, 'MN', 'married');
        expect(tax / 250000).toBeGreaterThan(moderateTax / 80000);
      });
    });

    describe('Georgia - graduated brackets', () => {
      it('taxes moderate income ($80k MFJ)', () => {
        const tax = calculateStateTax(80000, 'GA', 'married');
        expect(tax).toBeGreaterThan(0);
      });

      it('taxes high income ($250k MFJ)', () => {
        const tax = calculateStateTax(250000, 'GA', 'married');
        expect(tax).toBeGreaterThan(0);
        expect(tax).toBeGreaterThan(calculateStateTax(80000, 'GA', 'married'));
      });
    });

    describe('Ohio - graduated brackets', () => {
      it('taxes moderate income ($80k MFJ)', () => {
        const tax = calculateStateTax(80000, 'OH', 'married');
        expect(tax).toBeGreaterThan(0);
      });

      it('taxes high income ($250k MFJ)', () => {
        const tax = calculateStateTax(250000, 'OH', 'married');
        expect(tax).toBeGreaterThan(0);
        expect(tax).toBeGreaterThan(calculateStateTax(80000, 'OH', 'married'));
      });
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
