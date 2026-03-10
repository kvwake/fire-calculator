import { describe, it, expect } from 'vitest';
import {
  calculateSEPPPayment,
  getSEPPEndAge,
  isSEPPRequired,
  DEFAULT_SEPP_RATE,
} from '../engine/sepp';

describe('SEPP / 72(t)', () => {
  describe('calculateSEPPPayment', () => {
    it('calculates fixed amortization payment', () => {
      // $1M at age 50, default 5% rate, life expectancy 36.2
      const payment = calculateSEPPPayment(1000000, 50);
      // PMT = PV * (r / (1 - (1+r)^-n))
      const r = 0.05;
      const n = 36.2;
      const expected = 1000000 * (r / (1 - Math.pow(1 + r, -n)));
      expect(payment).toBeCloseTo(expected, 2);
    });

    it('returns 0 for ages outside the table', () => {
      expect(calculateSEPPPayment(1000000, 25)).toBe(0);
      expect(calculateSEPPPayment(1000000, 75)).toBe(0);
    });

    it('handles zero interest rate', () => {
      const payment = calculateSEPPPayment(1000000, 50, 0);
      // At 0% rate, simple division: balance / life expectancy
      expect(payment).toBeCloseTo(1000000 / 36.2, 2);
    });

    it('returns 0 for zero balance', () => {
      expect(calculateSEPPPayment(0, 50)).toBe(0);
    });

    it('scales linearly with balance', () => {
      const p1 = calculateSEPPPayment(500000, 55);
      const p2 = calculateSEPPPayment(1000000, 55);
      expect(p2).toBeCloseTo(p1 * 2, 2);
    });
  });

  describe('getSEPPEndAge', () => {
    it('returns startAge + 5 when older than 54.5', () => {
      expect(getSEPPEndAge(55)).toBe(60);
      expect(getSEPPEndAge(57)).toBe(62);
    });

    it('returns 59.5 when starting young enough', () => {
      expect(getSEPPEndAge(50)).toBe(59.5);
      expect(getSEPPEndAge(40)).toBe(59.5);
    });

    it('returns 59.5 for start at 54.5 (5 years = 59.5)', () => {
      expect(getSEPPEndAge(54.5)).toBe(59.5);
    });
  });

  describe('isSEPPRequired', () => {
    it('returns true during SEPP period', () => {
      expect(isSEPPRequired(50, 53)).toBe(true);
      expect(isSEPPRequired(50, 58)).toBe(true);
    });

    it('returns false after SEPP period', () => {
      expect(isSEPPRequired(50, 60)).toBe(false); // ended at 59.5
    });

    it('returns false before SEPP started', () => {
      expect(isSEPPRequired(50, 49)).toBe(false);
    });

    it('requires 5 years minimum even past 59.5', () => {
      // Started at 56, must go until 61
      expect(isSEPPRequired(56, 59)).toBe(true);
      expect(isSEPPRequired(56, 60)).toBe(true);
      expect(isSEPPRequired(56, 61)).toBe(false);
    });
  });

  it('DEFAULT_SEPP_RATE is 5%', () => {
    expect(DEFAULT_SEPP_RATE).toBe(0.05);
  });
});
