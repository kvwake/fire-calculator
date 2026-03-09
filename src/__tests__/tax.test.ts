import { describe, it, expect } from 'vitest';
import { calculateTotalTax, grossUpForTaxes, TaxSituation } from '../engine/tax';

describe('Tax Engine', () => {
  const baseSituation: TaxSituation = {
    ordinaryIncome: 0,
    capitalGains: 0,
    rothWithdrawals: 0,
    ssIncome: 0,
    filingStatus: 'married',
    state: 'TX', // no state tax
  };

  describe('calculateTotalTax', () => {
    it('returns zero tax for zero income', () => {
      const result = calculateTotalTax(baseSituation);
      expect(result.totalTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('handles only ordinary income', () => {
      const result = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 50000,
      });
      expect(result.federalIncomeTax).toBeGreaterThan(0);
      expect(result.federalCapGainsTax).toBe(0);
      expect(result.stateTax).toBe(0); // TX
    });

    it('correctly taxes Social Security', () => {
      const result = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 30000,
        ssIncome: 30000,
      });
      expect(result.taxableSSIncome).toBeGreaterThan(0);
      // Total ordinary includes taxable SS
      expect(result.federalIncomeTax).toBeGreaterThan(0);
    });

    it('Roth withdrawals are tax-free', () => {
      const withRoth = calculateTotalTax({
        ...baseSituation,
        rothWithdrawals: 50000,
      });
      expect(withRoth.totalTax).toBe(0);
    });

    it('Roth withdrawals do not affect tax on other income', () => {
      const without = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 50000,
      });
      const withRoth = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 50000,
        rothWithdrawals: 100000,
      });
      expect(withRoth.totalTax).toBe(without.totalTax);
    });

    it('calculates effective rate correctly', () => {
      const result = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 100000,
      });
      // Effective rate = tax / total income
      expect(result.effectiveRate).toBeCloseTo(result.totalTax / 100000, 4);
    });

    it('calculates marginal rate', () => {
      const result = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 100000,
      });
      // At $100k married, taxable = $70k, which is in 12% bracket
      expect(result.marginalOrdinaryRate).toBeCloseTo(0.12, 2);
    });

    it('includes state tax for states with income tax', () => {
      const result = calculateTotalTax({
        ...baseSituation,
        ordinaryIncome: 100000,
        state: 'CA',
      });
      expect(result.stateTax).toBeGreaterThan(0);
      expect(result.totalTax).toBeGreaterThan(result.totalFederalTax);
    });
  });

  describe('grossUpForTaxes', () => {
    it('returns more than net amount needed', () => {
      const gross = grossUpForTaxes(50000, {
        ...baseSituation,
        ordinaryIncome: 40000,
      }, 'ordinary');
      expect(gross).toBeGreaterThan(50000);
    });

    it('converges to correct amount', () => {
      const existing: TaxSituation = {
        ...baseSituation,
        ordinaryIncome: 40000,
      };
      const gross = grossUpForTaxes(50000, existing, 'ordinary');

      // Verify: tax on (existing + gross) - tax on existing = gross - 50000
      const taxWithout = calculateTotalTax(existing);
      const taxWith = calculateTotalTax({
        ...existing,
        ordinaryIncome: existing.ordinaryIncome + gross,
      });
      const additionalTax = taxWith.totalTax - taxWithout.totalTax;
      expect(gross - additionalTax).toBeCloseTo(50000, 0);
    });

    it('handles capital gains gross-up', () => {
      const gross = grossUpForTaxes(50000, baseSituation, 'capitalGains');
      // At low income with LTCG at 0%, gross should equal net
      expect(gross).toBeCloseTo(50000, 0);
    });
  });
});
