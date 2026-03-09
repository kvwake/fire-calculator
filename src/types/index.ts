export interface Person {
  id: string;
  name: string;
  currentAge: number;
  lifeExpectancy: number;
}

export type AccountType = 'traditional' | 'roth' | 'taxable' | 'hsa' | 'cash' | '457b' | 'generic';

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
  dividendYield: number; // percentage, e.g. 1.5 for 1.5%. For taxable accounts, generates taxable MAGI.
}

export interface SocialSecurityConfig {
  personId: string;
  enabled: boolean;
  monthlyBenefitAtFRA: number;
  claimingAge: number; // 62-70
}

export interface PensionConfig {
  id: string;
  personId: string;
  enabled: boolean;
  name: string;
  annualBenefit: number; // in today's dollars
  startAge: number; // age when pension payments begin
  cola: number; // annual cost-of-living adjustment percentage (0 = no inflation adjustment)
}

export interface SpendingPhase {
  id: string;
  label: string;
  startAge: number; // based on primary person
  endAge: number;
  annualAmount: number; // post-tax spending in today's dollars
  budgetEnabled?: boolean; // when true, annualAmount is computed from budget items
}

export type BudgetCategory =
  | 'housing'
  | 'food'
  | 'transport'
  | 'healthcare_budget'
  | 'insurance'
  | 'travel'
  | 'personal'
  | 'entertainment'
  | 'giving'
  | 'other';

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  housing: 'Housing',
  food: 'Food & Groceries',
  transport: 'Transportation',
  healthcare_budget: 'Healthcare',
  insurance: 'Insurance',
  travel: 'Travel',
  personal: 'Personal & Clothing',
  entertainment: 'Entertainment & Hobbies',
  giving: 'Gifts & Charity',
  other: 'Other',
};

export interface BudgetItem {
  id: string;
  category: BudgetCategory;
  description: string;
  monthlyAmount: number;
  startAge?: number | null; // null = use phase start
  endAge?: number | null; // null = use phase end
  isOneTime?: boolean; // one-time expense at startAge
  inflationOverride?: number | null; // null = use general rate, number = custom %
  preTax?: boolean; // true = pre-tax (e.g. HSA medical). default false (post-tax)
}

export interface BudgetPreset {
  name: string;
  description: string;
  items: Omit<BudgetItem, 'id'>[];
}

export interface HealthcareCosts {
  pre65AnnualPerPerson: number;
  post65AnnualPerPerson: number;
  inflationRate: number | null; // null = use general inflation rate, number = separate healthcare inflation %
}

export interface SpendingConfig {
  phases: SpendingPhase[];
  healthcare: HealthcareCosts;
  budgetItems: BudgetItem[]; // single budget, items can have per-item age overrides
}

export type FilingStatus = 'single' | 'married';

export type RothConversionStrategy = 'none' | 'fill12' | 'fill22' | 'fill24';

export interface Settings {
  inflationRate: number; // percentage, e.g. 3 for 3%
  state: string; // state abbreviation
  filingStatus: FilingStatus;
  retirementYear: number; // calendar year the household retires
  cashYearsOfExpenses: number; // years of expenses to keep in cash buffer
  rothConversionStrategy: RothConversionStrategy; // fill tax brackets with Roth conversions
  capitalGainsHarvesting: boolean; // harvest gains at 0% LTCG rate
  hsaContributionInRetirement: boolean; // auto-contribute to HSA pre-65
  withdrawalSoftLimit: number | null; // percentage, e.g. 4 for 4%. null = disabled
  withdrawalHardLimit: number | null; // percentage. null = disabled. Caps investment withdrawals.
  cashFloorYears: number; // minimum years of spending to keep in cash. Below this = failure.
  austerityReduction: number | null; // percentage spending reduction when cash below floor. null = disabled.
  glidePath: {
    enabled: boolean;
    safeYearsStart: number; // years of expenses in bonds+cash at start of retirement
    safeYearsEnd: number;   // years of expenses in bonds+cash at end of retirement
  };
}

export interface AppState {
  people: Person[];
  accounts: Account[];
  socialSecurity: SocialSecurityConfig[];
  pensions: PensionConfig[];
  spending: SpendingConfig;
  settings: Settings;
}

export interface AccountIncomeDetail {
  ordinary: number;
  capitalGains: number;
  taxFree: number;
}

export interface YearResult {
  year: number;
  ages: Record<string, number>;
  startingBalances: Record<string, number>;
  accountBalances: Record<string, number>;
  contributions: Record<string, number>;
  growth: Record<string, number>;
  ssIncome: Record<string, number>;
  pensionIncome: Record<string, number>; // pensionId -> amount
  rmds: Record<string, number>;
  withdrawals: Record<string, number>;
  rothConversions: Record<string, number>;
  seppWithdrawals: Record<string, number>;
  capitalGainsHarvested: Record<string, number>;
  incomeByAccount: Record<string, AccountIncomeDetail>;
  totalIncome: number;
  ordinaryIncome: number;
  capitalGains: number;
  taxableSSIncome: number;
  federalTax: number;
  federalIncomeTax: number;
  federalCapGainsTax: number;
  niit: number;
  stateTax: number;
  irmaaSurcharge: number;
  acaSubsidy: number;
  acaOverCliff: boolean;
  earlyWithdrawalPenalty: number;
  hsaContributions: Record<string, number>;
  acaConstrainedWithdrawals: boolean;
  totalTax: number;
  totalSpending: number;
  baseSpending: number;
  healthcareCost: number;
  netSpending: number;
  deficit: number; // unfunded spending (cash fully exhausted)
  bufferBorrowed: number; // amount cash dipped below target (but still above floor)
  cashBalance: number; // ending cash balance
  cashBelowFloor: boolean; // true if cash dropped below floor this year
  dividendIncome: number; // taxable dividend income from taxable accounts (affects MAGI)
  inAusterity: boolean; // true if spending was reduced due to austerity mode
  totalPortfolioValue: number;
  phase: 'accumulation' | 'retirement';
  annotations: string[];
}

export interface SimulationResult {
  years: YearResult[];
  fireAge: number | null;
  successfulRetirement: boolean;
  totalTaxesPaid: number;
  portfolioDepletionAge: number | null;
  totalRetirementWithdrawals: number;
  totalRetirementSSIncome: number;
  totalRetirementPensionIncome: number;
  firstDeficitAge: number | null; // first year cash was fully exhausted
  firstCashFloorBreachAge: number | null; // first year cash dropped below floor
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  traditional: 'Traditional 401(k)/IRA',
  roth: 'Roth 401(k)/IRA',
  taxable: 'Taxable Brokerage',
  hsa: 'HSA',
  cash: 'Cash / Bonds / HYSA',
  '457b': 'Governmental 457(b)',
  generic: 'Generic/Other',
};
