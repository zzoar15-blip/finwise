export type Goal =
  | 'pay-debt'
  | 'emergency-fund'
  | 'invest-income'
  | 'save-home'
  | 'retire-early'
  | 'tax-efficiency'
  | 'dividend-income';

export type DebtPresetType =
  | 'personal'
  | 'credit-card'
  | 'student'
  | 'car'
  | 'mortgage'
  | 'other';

export interface PlanDebt {
  id: string;
  name: string;
  debtType: DebtPresetType;
  balance: number;
  apr: number;
  minPayment: number;
}

export interface PlanExpenses {
  housing: number;
  utilities: number;
  groceries: number;
  dining: number;
  transportation: number;
  subscriptions: number;
  phone: number;
  health: number;
  travel: number;
  misc: number;
}

export interface PlanInputs {
  // Step 1 — Income
  name: string;
  annualSalary: number;
  state: string;
  payPeriod: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  filingStatus: 'single' | 'married' | 'hoh';
  annualBonus: number; // post-tax
  nycResident: boolean;

  // Step 2 — Benefits
  traditional401kPct: number;
  roth401kPct: number;
  hsaPerPeriod: number;
  fsaPerPeriod: number;
  healthInsurancePerPeriod: number;
  dentalPerPeriod: number;
  commuterBenefitPerPeriod: number;
  otherPreTaxPerPeriod: number;

  // Step 3 — Expenses
  expenses: PlanExpenses;

  // Step 4 — Debts
  debts: PlanDebt[];

  // Step 5 — Goals
  goals: Goal[];
  emergencyFundTarget: number;
  homeTarget: number;
  homeTimelineMonths: number;
}

export interface AIInsight {
  type: 'tip' | 'warning' | 'success';
  text: string;
}

export interface PlanAIInsights {
  items: AIInsight[];
  generatedAt: string;
}

export interface AppSettings {
  displayName: string;
  defaultState: string;
  acceptedInstitutionalDisclosure?: boolean;
}

export interface FinancialPlan {
  inputs: PlanInputs;
  insights: PlanAIInsights | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaycheckProfile {
  annualSalary: number;
  payPeriod: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  filingStatus: 'single' | 'married' | 'hoh';
  state: string;
  nycResident: boolean;
  traditional401kPct: number;
  roth401kPct: number;
  hsaPerPeriod: number;
  fsaPerPeriod: number;
  healthInsurancePerPeriod: number;
  dentalPerPeriod: number;
  commuterBenefitPerPeriod: number;
  otherPostTaxPerPeriod: number;
}

export interface DebtProfile {
  debts: Array<{
    id: string;
    name: string;
    balance: number;
    apr: number;
    minPayment: number;
  }>;
  monthlyOverpayment: number;
  annualBonus: number;
}

export interface InvestProfile {
  monthlyBuy: number;
  annualBonus: number;
  dividendYield: number;
  taxRate: number;
  qualifiedPercent: number;
  payFrequency: 'monthly' | 'quarterly';
  years: number;
  annualAppreciation: number;
}

export interface AIInsightsCache {
  items: AIInsight[];
  generatedAt: string;
  dataHash: string;
}

export interface PlanStore {
  plan: FinancialPlan | null;
  settings: AppSettings;
  paycheckProfile: PaycheckProfile | null;
  debtProfile: DebtProfile | null;
  investProfile: InvestProfile | null;
  planLastUpdated: string | null;
  aiInsightsCache: AIInsightsCache | null;
  setPlan: (inputs: PlanInputs) => void;
  updatePlanInputs: (partial: Partial<PlanInputs>) => void;
  setPlanInsights: (insights: PlanAIInsights) => void;
  clearPlan: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setPaycheckProfile: (profile: PaycheckProfile) => void;
  setDebtProfile: (profile: DebtProfile) => void;
  setInvestProfile: (profile: InvestProfile) => void;
  setAIInsightsCache: (cache: AIInsightsCache) => void;
}
