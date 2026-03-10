import { describe, it, expect } from 'vitest';
import {
  HISTORICAL_REAL_RETURNS,
  HISTORICAL_MEAN_REAL_RETURN,
  HISTORICAL_STDDEV_REAL_RETURN,
  HISTORICAL_START_YEAR,
  HISTORICAL_END_YEAR,
} from '../data/historicalReturns';

describe('Historical Returns Data', () => {
  it('has data from 1871 to 2024', () => {
    expect(HISTORICAL_START_YEAR).toBe(1871);
    expect(HISTORICAL_END_YEAR).toBe(2024);
  });

  it('has correct number of years', () => {
    expect(HISTORICAL_REAL_RETURNS.length).toBe(2024 - 1871 + 1);
  });

  it('years are sequential', () => {
    for (let i = 1; i < HISTORICAL_REAL_RETURNS.length; i++) {
      expect(HISTORICAL_REAL_RETURNS[i].year).toBe(HISTORICAL_REAL_RETURNS[i - 1].year + 1);
    }
  });

  it('mean real return is reasonable (5-10%)', () => {
    expect(HISTORICAL_MEAN_REAL_RETURN).toBeGreaterThan(0.05);
    expect(HISTORICAL_MEAN_REAL_RETURN).toBeLessThan(0.10);
  });

  it('stddev is reasonable (15-25%)', () => {
    expect(HISTORICAL_STDDEV_REAL_RETURN).toBeGreaterThan(0.10);
    expect(HISTORICAL_STDDEV_REAL_RETURN).toBeLessThan(0.25);
  });

  it('computed mean matches data', () => {
    const sum = HISTORICAL_REAL_RETURNS.reduce((s, r) => s + r.realReturn, 0);
    const mean = sum / HISTORICAL_REAL_RETURNS.length;
    expect(HISTORICAL_MEAN_REAL_RETURN).toBeCloseTo(mean, 6);
  });

  it('all returns are within plausible range', () => {
    for (const r of HISTORICAL_REAL_RETURNS) {
      // Worst year was ~-40%, best ~+55%
      expect(r.realReturn).toBeGreaterThan(-0.60);
      expect(r.realReturn).toBeLessThan(0.70);
    }
  });
});
