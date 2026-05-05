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
}

export interface FinancialPlan {
  inputs: PlanInputs;
  insights: PlanAIInsights | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStore {
  plan: FinancialPlan | null;
  settings: AppSettings;
  setPlan: (inputs: PlanInputs) => void;
  updatePlanInputs: (partial: Partial<PlanInputs>) => void;
  setPlanInsights: (insights: PlanAIInsights) => void;
  clearPlan: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}
