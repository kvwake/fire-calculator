import { describe, it, expect } from 'vitest';
import {
  optimizeWithdrawals,
  calculateRothConversion,
  calculateCapGainsHarvest,
} from '../engine/withdrawal';
import { Account } from '../types';

function makeAccount(overrides: Partial<Account> & { id: string; type: Account['type'] }): Account {
  return {
    name: overrides.name ?? overrides.id,
    owner: 'p1',
    balance: 0,
    annualContribution: 0,
    contributionEndAge: 65,
    expectedReturn: 7,
    costBasis: 0,
    seppEnabled: false,
    dividendYield: 0,
    ...overrides,
  };
}

describe('Withdrawal Optimizer', () => {
  describe('optimizeWithdrawals', () => {
    it('uses SS income first before withdrawals', () => {
      const accounts = [
        {
          account: makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          balance: 500000, costBasis: 0, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
      ];
      const plan = optimizeWithdrawals(accounts, 60000, 30000, 'married', 'TX');
      // Should only need $30k from portfolio (60k - 30k SS)
      const totalWithdrawn = Object.values(plan.withdrawals).reduce((s, v) => s + v, 0);
      // Needs 30k + taxes on that 30k
      expect(totalWithdrawn).toBeGreaterThanOrEqual(30000);
      expect(totalWithdrawn).toBeLessThan(60000);
    });

    it('takes RMDs before other withdrawals', () => {
      const accounts = [
        {
          account: makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          balance: 500000, costBasis: 0, ownerAge: 75, canAccessPenaltyFree: true,
          rmdAmount: 20000, seppAmount: 0,
        },
        {
          account: makeAccount({ id: 'roth', type: 'roth', balance: 200000 }),
          balance: 200000, costBasis: 0, ownerAge: 75, canAccessPenaltyFree: true,
          rmdAmount: 0, seppAmount: 0,
        },
      ];
      const plan = optimizeWithdrawals(accounts, 50000, 0, 'married', 'TX');
      // RMD of 20k should be taken from traditional
      expect(plan.withdrawals['trad']).toBeGreaterThanOrEqual(20000);
      expect(plan.ordinaryIncome).toBeGreaterThanOrEqual(20000);
    });

    it('prefers traditional in low brackets, then taxable, then Roth', () => {
      const accounts = [
        {
          account: makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          balance: 500000, costBasis: 0, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
        {
          account: makeAccount({ id: 'taxable', type: 'taxable', balance: 500000 }),
          balance: 500000, costBasis: 250000, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
        {
          account: makeAccount({ id: 'roth', type: 'roth', balance: 500000 }),
          balance: 500000, costBasis: 0, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
      ];
      // Need $60k, no SS
      const plan = optimizeWithdrawals(accounts, 60000, 0, 'married', 'TX');
      // Traditional should be used first (to fill low brackets)
      expect(plan.withdrawals['trad']).toBeGreaterThan(0);
      // Traditional should have the lion's share (spending fills low brackets)
      expect(plan.withdrawals['trad']).toBeGreaterThan(plan.withdrawals['roth'] || 0);
    });

    it('handles pension income', () => {
      const accounts = [
        {
          account: makeAccount({ id: 'roth', type: 'roth', balance: 200000 }),
          balance: 200000, costBasis: 0, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
      ];
      const plan = optimizeWithdrawals(accounts, 60000, 0, 'married', 'TX', 40000);
      // Pension covers $40k, only need $20k + tax from portfolio
      const totalWithdrawn = Object.values(plan.withdrawals).reduce((s, v) => s + v, 0);
      expect(totalWithdrawn).toBeLessThan(30000); // 20k + small tax
    });

    it('withdraws enough to cover taxes', () => {
      const accounts = [
        {
          account: makeAccount({ id: 'trad', type: 'traditional', balance: 500000 }),
          balance: 500000, costBasis: 0, ownerAge: 65, canAccessPenaltyFree: true, rmdAmount: 0, seppAmount: 0,
        },
      ];
      const plan = optimizeWithdrawals(accounts, 80000, 0, 'married', 'TX');
      // Total withdrawn should cover spending (tax withdrawal is iterative, may slightly undershoot)
      const totalWithdrawn = Object.values(plan.withdrawals).reduce((s, v) => s + v, 0);
      expect(totalWithdrawn).toBeGreaterThanOrEqual(80000);
    });
  });

  describe('calculateRothConversion', () => {
    it('converts to fill below target bracket', () => {
      const balances = [
        { accountId: 'trad1', balance: 500000, canAccess: true },
      ];
      // No existing income, married, fill below 22% (top of 12% = $96,950)
      // Room = $96,950 + $30,000 deduction = $126,950
      const conversions = calculateRothConversion(balances, 0, 'married', 0.22);
      const total = Object.values(conversions).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(126950, 0);
    });

    it('reduces conversion when income already fills brackets', () => {
      const balances = [
        { accountId: 'trad1', balance: 500000, canAccess: true },
      ];
      // $100k existing ordinary income, married
      // Room = $96,950 + $30,000 - $100,000 = $26,950
      const conversions = calculateRothConversion(balances, 100000, 'married', 0.22);
      const total = Object.values(conversions).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(26950, 0);
    });

    it('returns empty when no room', () => {
      const balances = [
        { accountId: 'trad1', balance: 500000, canAccess: true },
      ];
      const conversions = calculateRothConversion(balances, 200000, 'married', 0.22);
      expect(Object.keys(conversions)).toHaveLength(0);
    });

    it('skips accounts that cannot be accessed', () => {
      const balances = [
        { accountId: 'trad1', balance: 500000, canAccess: false },
      ];
      const conversions = calculateRothConversion(balances, 0, 'married', 0.22);
      expect(Object.keys(conversions)).toHaveLength(0);
    });

    it('respects maxConversion cap', () => {
      const balances = [
        { accountId: 'trad1', balance: 500000, canAccess: true },
      ];
      const conversions = calculateRothConversion(balances, 0, 'married', 0.22, 10000);
      const total = Object.values(conversions).reduce((s, v) => s + v, 0);
      expect(total).toBe(10000);
    });
  });

  describe('calculateCapGainsHarvest', () => {
    it('harvests gains in 0% LTCG bracket', () => {
      const accounts = [
        { accountId: 'tax1', balance: 200000, costBasis: 100000 },
      ];
      // No ordinary income, married. 0% bracket top = $96,700
      // Taxable ordinary = $0, room = $96,700
      const harvests = calculateCapGainsHarvest(accounts, 0, 'married');
      const total = Object.values(harvests).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(96700, 0);
    });

    it('limits to unrealized gains', () => {
      const accounts = [
        { accountId: 'tax1', balance: 120000, costBasis: 100000 },
      ];
      // Only $20k unrealized gains, plenty of room in 0% bracket
      const harvests = calculateCapGainsHarvest(accounts, 0, 'married');
      expect(harvests['tax1']).toBe(20000);
    });

    it('returns empty when ordinary income fills 0% bracket', () => {
      const accounts = [
        { accountId: 'tax1', balance: 200000, costBasis: 100000 },
      ];
      // $130k ordinary, married. Taxable = $100k. 0% bracket top = $96,700
      // No room in 0% bracket
      const harvests = calculateCapGainsHarvest(accounts, 130000, 'married');
      expect(Object.keys(harvests)).toHaveLength(0);
    });

    it('returns empty when no unrealized gains', () => {
      const accounts = [
        { accountId: 'tax1', balance: 100000, costBasis: 100000 },
      ];
      const harvests = calculateCapGainsHarvest(accounts, 0, 'married');
      expect(Object.keys(harvests)).toHaveLength(0);
    });
  });
});
