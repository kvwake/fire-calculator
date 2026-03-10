// SEPP (Substantially Equal Periodic Payments) / 72(t) calculator
// Uses the Fixed Amortization method (most common, highest payout)
//
// IRS rules (Rev. Ruling 2002-62, modified by Notice 2022-6):
// - Payment is calculated ONCE using the account balance at SEPP start
// - Must use one of three IRS-approved methods (we use Fixed Amortization)
// - Interest rate must not exceed 120% of federal mid-term rate (published monthly)
// - Must use an IRS life expectancy table (we use Single Life Table, Pub 590-B Table I)
// - Payments must continue for the LONGER of 5 years or until age 59½
// - Any modification triggers 10% penalty on ALL prior distributions

// IRS Single Life Expectancy Table (Pub 590-B, Table I, updated 2022)
const SINGLE_LIFE_EXPECTANCY: Record<number, number> = {
  30: 55.3, 31: 54.4, 32: 53.4, 33: 52.5, 34: 51.5,
  35: 50.5, 36: 49.6, 37: 48.6, 38: 47.7, 39: 46.7,
  40: 45.7, 41: 44.8, 42: 43.8, 43: 42.9, 44: 41.9,
  45: 41.0, 46: 40.0, 47: 39.0, 48: 38.1, 49: 37.1,
  50: 36.2, 51: 35.3, 52: 34.3, 53: 33.4, 54: 32.5,
  55: 31.6, 56: 30.6, 57: 29.8, 58: 28.9, 59: 28.0,
  60: 27.1, 61: 26.2, 62: 25.4, 63: 24.5, 64: 23.7,
  65: 22.9, 66: 22.0, 67: 21.2, 68: 20.4, 69: 19.6,
  70: 18.8,
};

// Default interest rate for SEPP (120% of federal mid-term rate)
export const DEFAULT_SEPP_RATE = 0.05;

export function calculateSEPPPayment(
  accountBalance: number,
  age: number,
  interestRate: number = DEFAULT_SEPP_RATE
): number {
  const lifeExpectancy = SINGLE_LIFE_EXPECTANCY[age];
  if (!lifeExpectancy) return 0;

  // Fixed amortization: balance * (r / (1 - (1+r)^-n))
  const r = interestRate;
  const n = lifeExpectancy;

  if (r === 0) return accountBalance / n;

  const payment = accountBalance * (r / (1 - Math.pow(1 + r, -n)));
  return payment;
}

// SEPP must continue for the longer of: 5 years or until age 59.5
export function getSEPPEndAge(startAge: number): number {
  return Math.max(startAge + 5, 59.5);
}

export function isSEPPRequired(startAge: number, currentAge: number): boolean {
  if (currentAge < startAge) return false;
  const endAge = getSEPPEndAge(startAge);
  return currentAge < endAge;
}
