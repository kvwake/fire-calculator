import { FilingStatus } from '../types';
import { calculateFederalTax, calculateTaxableSSIncome } from '../data/federalTax';
import { calculateStateTax } from '../data/stateTax';

export interface TaxSituation {
  ordinaryIncome: number; // 401k withdrawals, taxable SS, SEPP
  capitalGains: number; // from taxable brokerage
  rothWithdrawals: number; // tax-free
  ssIncome: number; // total SS before taxation calc
  filingStatus: FilingStatus;
  state: string;
}

export interface TaxResult {
  federalIncomeTax: number;
  federalCapGainsTax: number;
  niit: number;
  stateTax: number;
  totalFederalTax: number;
  totalTax: number;
  taxableSSIncome: number;
  effectiveRate: number;
  marginalOrdinaryRate: number;
}

export function calculateTotalTax(situation: TaxSituation): TaxResult {
  // Calculate taxable portion of Social Security
  const nonSSIncome = situation.ordinaryIncome + situation.capitalGains;
  const taxableSSIncome = calculateTaxableSSIncome(
    situation.ssIncome,
    nonSSIncome,
    situation.filingStatus
  );

  // Total ordinary income includes taxable SS
  const totalOrdinaryIncome = situation.ordinaryIncome + taxableSSIncome;

  // Federal taxes
  const federal = calculateFederalTax(
    totalOrdinaryIncome,
    situation.capitalGains,
    situation.filingStatus
  );

  const totalFederalTax = federal.incomeTax + federal.capitalGainsTax + federal.niit;

  // State tax (on all taxable income including SS, with state-specific exclusions)
  const totalTaxableIncome = totalOrdinaryIncome + situation.capitalGains;
  const stateTax = calculateStateTax(totalTaxableIncome, situation.state, situation.filingStatus, {
    ssIncome: taxableSSIncome,
    capitalGains: situation.capitalGains,
  });

  const totalTax = totalFederalTax + stateTax;

  // Effective rate on total income (including tax-free)
  const totalIncome =
    situation.ordinaryIncome +
    situation.capitalGains +
    situation.rothWithdrawals +
    situation.ssIncome;
  const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;

  // Estimate marginal ordinary rate (for optimization decisions)
  const marginalCheck = calculateFederalTax(
    totalOrdinaryIncome + 1000,
    situation.capitalGains,
    situation.filingStatus
  );
  const marginalOrdinaryRate =
    (marginalCheck.incomeTax - federal.incomeTax) / 1000;

  return {
    federalIncomeTax: federal.incomeTax,
    federalCapGainsTax: federal.capitalGainsTax,
    niit: federal.niit,
    stateTax,
    totalFederalTax,
    totalTax,
    taxableSSIncome,
    effectiveRate,
    marginalOrdinaryRate,
  };
}

// Calculate gross withdrawal needed to net a specific amount after taxes
// Uses iterative approach since taxes depend on the amount withdrawn
export function grossUpForTaxes(
  netAmountNeeded: number,
  existingTaxSituation: TaxSituation,
  withdrawalType: 'ordinary' | 'capitalGains'
): number {
  // Start with estimate: net / (1 - estimated_rate)
  let gross = netAmountNeeded;
  const maxIterations = 20;

  for (let i = 0; i < maxIterations; i++) {
    const testSituation = { ...existingTaxSituation };
    if (withdrawalType === 'ordinary') {
      testSituation.ordinaryIncome += gross;
    } else {
      testSituation.capitalGains += gross;
    }

    const taxWithWithdrawal = calculateTotalTax(testSituation);
    const taxWithout = calculateTotalTax(existingTaxSituation);
    const additionalTax = taxWithWithdrawal.totalTax - taxWithout.totalTax;

    const newGross = netAmountNeeded + additionalTax;
    if (Math.abs(newGross - gross) < 1) break;
    gross = newGross;
  }

  return gross;
}
