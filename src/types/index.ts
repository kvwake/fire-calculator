export interface Person {
  id: string;
  name: string;
  currentAge: number;
  lifeExpectancy: number;
}

export type AccountType = 'traditional' | 'roth' | 'taxable' | 'hsa' | 'cash' | 'generic';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owner: string; // person id
  balance: number;
  annualContribution: number;
  contributionEndAge: number; // age of owner when contributions stop (default: retirement age)
  expectedReturn: number; // percentage, e.g. 7 for 7%
  costBasis: number; // for taxable accounts, dollar amount of cost basis
  seppEnabled: boolean; // for traditional accounts pre-59.5
}

export interface SocialSecurityConfig {
  personId: string;
  enabled: boolean;
  monthlyBenefitAtFRA: number;
  claimingAge: number; // 62-70
}

export interface SpendingPhase {
  id: string;
  label: string;
  startAge: number; // based on primary person
  endAge: number;
  annualAmount: number; // post-tax spending in today's dollars
}

export interface HealthcareCosts {
  pre65AnnualPerPerson: number;
  post65AnnualPerPerson: number;
}

export interface SpendingConfig {
  phases: SpendingPhase[];
  healthcare: HealthcareCosts;
}

export type FilingStatus = 'single' | 'married';

export interface Settings {
  inflationRate: number; // percentage, e.g. 3 for 3%
  state: string; // state abbreviation
  filingStatus: FilingStatus;
  retirementAge: number; // shared retirement age for the household
  cashYearsOfExpenses: number; // years of expenses to keep in cash buffer
}

export interface AppState {
  people: Person[];
  accounts: Account[];
  socialSecurity: SocialSecurityConfig[];
  spending: SpendingConfig;
  settings: Settings;
}

export interface YearResult {
  year: number;
  ages: Record<string, number>;
  accountBalances: Record<string, number>;
  ssIncome: Record<string, number>;
  rmds: Record<string, number>;
  withdrawals: Record<string, number>;
  rothConversions: Record<string, number>;
  seppWithdrawals: Record<string, number>;
  totalIncome: number;
  ordinaryIncome: number;
  capitalGains: number;
  taxableSSIncome: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  totalSpending: number;
  netSpending: number;
  deficit: number;
  totalPortfolioValue: number;
  phase: 'accumulation' | 'retirement';
}

export interface SimulationResult {
  years: YearResult[];
  fireAge: number | null;
  successfulRetirement: boolean;
  totalTaxesPaid: number;
  portfolioDepletionAge: number | null;
  totalNeededAtRetirement: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  traditional: 'Traditional 401(k)/IRA',
  roth: 'Roth 401(k)/IRA',
  taxable: 'Taxable Brokerage',
  hsa: 'HSA',
  cash: 'Cash / Bonds / HYSA',
  generic: 'Generic/Other',
};
