import { describe, it, expect } from 'vitest';
import {
  calculateFederalTax,
  calculateTaxableSSIncome,
  getStandardDeduction,
  getFederalBrackets,
  getLTCGBrackets,
} from '../data/federalTax';

describe('Federal Tax', () => {
  describe('getStandardDeduction', () => {
    it('returns $15,000 for single', () => {
      expect(getStandardDeduction('single')).toBe(15000);
    });

    it('returns $30,000 for married', () => {
      expect(getStandardDeduction('married')).toBe(30000);
    });
  });

  describe('calculateFederalTax', () => {
    it('returns 0 tax when income is below standard deduction', () => {
      const result = calculateFederalTax(15000, 0, 'single');
      expect(result.incomeTax).toBe(0);
    });

    it('calculates 10% bracket correctly for single', () => {
      // $26,925 ordinary = $11,925 taxable (after $15k deduction), all in 10% bracket
      const result = calculateFederalTax(26925, 0, 'single');
      expect(result.incomeTax).toBeCloseTo(11925 * 0.10, 0);
    });

    it('calculates mixed brackets correctly for married', () => {
      // $100,000 ordinary income, married
      // Taxable: $70,000 (after $30k deduction)
      // 10% on first $23,850 = $2,385
      // 12% on next $46,150 ($23,850-$70,000) = $5,538
      const result = calculateFederalTax(100000, 0, 'married');
      expect(result.incomeTax).toBeCloseTo(2385 + 5538, 0);
    });

    it('calculates LTCG tax at 0% when income is low', () => {
      // Single: $15,000 ordinary (all deducted), $30,000 LTCG
      // Taxable ordinary = $0, LTCG fits in 0% bracket ($0-$48,350)
      const result = calculateFederalTax(15000, 30000, 'single');
      expect(result.capitalGainsTax).toBe(0);
    });

    it('calculates LTCG tax at 15% when stacked above ordinary', () => {
      // Single: $60,000 ordinary, $50,000 LTCG
      // Taxable ordinary: $45,000. LTCG stacks on top.
      // $48,350 - $45,000 = $3,350 at 0%, rest at 15%
      const result = calculateFederalTax(60000, 50000, 'single');
      expect(result.capitalGainsTax).toBeCloseTo(3350 * 0 + (50000 - 3350) * 0.15, 0);
    });

    it('calculates NIIT when AGI exceeds threshold', () => {
      // Single, NIIT threshold = $200,000
      // $150,000 ordinary + $100,000 LTCG = $250,000 AGI
      // Excess AGI = $50,000. NIIT = min($100k LTCG, $50k excess) * 3.8%
      const result = calculateFederalTax(150000, 100000, 'single');
      expect(result.niit).toBeCloseTo(50000 * 0.038, 0);
    });

    it('no NIIT when below threshold', () => {
      const result = calculateFederalTax(50000, 50000, 'single');
      expect(result.niit).toBe(0);
    });

    it('handles zero income', () => {
      const result = calculateFederalTax(0, 0, 'single');
      expect(result.incomeTax).toBe(0);
      expect(result.capitalGainsTax).toBe(0);
      expect(result.niit).toBe(0);
    });
  });

  describe('calculateTaxableSSIncome', () => {
    it('returns 0 when combined income is below low threshold', () => {
      // Married: low threshold = $32,000
      // Combined = otherIncome + 50% SS = $20,000 + $10,000 = $25,000
      expect(calculateTaxableSSIncome(20000, 20000, 'married')).toBe(0);
    });

    it('taxes up to 50% in the middle range', () => {
      // Married: low=$32k, high=$44k
      // $40,000 SS, $20,000 other. Combined = $20,000 + $20,000 = $40,000
      // Excess over $32k = $8,000. Taxable = min($8k * 0.5, $40k * 0.5) = $4,000
      const taxable = calculateTaxableSSIncome(40000, 20000, 'married');
      expect(taxable).toBeCloseTo(4000, 0);
    });

    it('taxes up to 85% in the high range', () => {
      // Single: low=$25k, high=$34k
      // $30,000 SS, $80,000 other. Combined = $80k + $15k = $95k
      // Tier 1: ($34k - $25k) * 0.5 = $4,500
      // Tier 2: ($95k - $34k) * 0.85 = $51,850
      // Total: min($4,500 + $51,850, $30,000 * 0.85) = min($56,350, $25,500) = $25,500
      const taxable = calculateTaxableSSIncome(30000, 80000, 'single');
      expect(taxable).toBeCloseTo(25500, 0);
    });

    it('returns 0 for zero SS income', () => {
      expect(calculateTaxableSSIncome(0, 100000, 'single')).toBe(0);
    });
  });
});
