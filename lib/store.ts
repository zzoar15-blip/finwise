'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES } from '@/lib/constants';
import type { FinanceStore } from '@/types/finance';
import {
  computePaycheck,
  type StorePaycheckInputs,
  type StorePaycheckResults,
  type StoreBudgetInputs,
  type StoreInvestmentInputs,
  DEFAULT_PAYCHECK_INPUTS,
  DEFAULT_PAYCHECK_RESULTS,
  DEFAULT_BUDGET_INPUTS,
  DEFAULT_INVESTMENT_INPUTS,
} from '@/lib/calculations';
import {
  computeRentVsBuy,
  type RentVsBuyInputs,
  type RentVsBuyResults,
} from '@/lib/calculations/rentVsBuy';
import {
  computeSinkingFund,
  DEFAULT_SINKING_FUND_INPUTS,
  type SinkingFundInputs,
  type SinkingFundResults,
} from '@/lib/calculations/sinkingFund';
import {
  computeNetWorthTotals,
  currentYearMonth,
  type NetWorthItem,
  type NetWorthSnapshot,
} from '@/lib/calculations/netWorth';
import type { Scenario } from '@/lib/calculations/forecast';

function normalizeGoalOrder(goals: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const goal of goals) {
    if (seen.has(goal)) continue;
    seen.add(goal);
    ordered.push(goal);
  }
  return ordered;
}

interface FinWiseStore {
  paycheckInputs: StorePaycheckInputs;
  paycheckResults: StorePaycheckResults;
  budgetInputs: StoreBudgetInputs;
  investmentInputs: StoreInvestmentInputs;
  debts: Array<{ id: string; name: string; balance: number; apr: number; minPayment: number }>;
  goals: string[];
  planLastUpdated: string | null;
  rentVsBuyInputs: RentVsBuyInputs | null;
  rentVsBuyResults: RentVsBuyResults | null;
  sinkingFundInputs: SinkingFundInputs;
  sinkingFundResults: SinkingFundResults;
  netWorthAssets: NetWorthItem[];
  netWorthLiabilities: NetWorthItem[];
  netWorthHistory: NetWorthSnapshot[];
  forecastScenarios: Scenario[];
  forecastBaselineScenarioId: string | null;

  setPaycheckInputs: (inputs: Partial<StorePaycheckInputs>) => void;
  setBudgetInputs: (inputs: Partial<StoreBudgetInputs>) => void;
  setDebts: (debts: FinWiseStore['debts']) => void;
  setGoals: (goals: string[]) => void;
  setInvestmentInputs: (inputs: Partial<StoreInvestmentInputs>) => void;
  setRentVsBuyInputs: (inputs: Partial<RentVsBuyInputs>) => void;
  setSinkingFundInputs: (inputs: Partial<SinkingFundInputs>) => void;
  setNetWorthAssets: (items: NetWorthItem[]) => void;
  setNetWorthLiabilities: (items: NetWorthItem[]) => void;
  addNetWorthSnapshot: () => void;
  setForecastScenarios: (items: Scenario[]) => void;
  setForecastBaselineScenarioId: (id: string) => void;
}

type PersistedStateV1 = {
  budgetInputs?: {
    transportation?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const DEFAULT_FORECAST_SCENARIOS: Scenario[] = [
  {
    id: '1',
    name: 'Conservative',
    color: '#3b82f6',
    startingSalary: 80000,
    annualRaise: 2,
    savingsRate: 15,
    investmentReturn: 6,
    startingNetWorth: 10000,
  },
  {
    id: '2',
    name: 'Aggressive',
    color: '#22c55e',
    startingSalary: 80000,
    annualRaise: 5,
    savingsRate: 30,
    investmentReturn: 8,
    startingNetWorth: 10000,
  },
];

export const useFinWiseStore = create<FinWiseStore>()(
  persist(
    (set) => ({
      paycheckInputs: DEFAULT_PAYCHECK_INPUTS,
      paycheckResults: DEFAULT_PAYCHECK_RESULTS,
      budgetInputs: DEFAULT_BUDGET_INPUTS,
      investmentInputs: DEFAULT_INVESTMENT_INPUTS,
      debts: [],
      goals: [],
      planLastUpdated: null,
      rentVsBuyInputs: null,
      rentVsBuyResults: null,
      sinkingFundInputs: DEFAULT_SINKING_FUND_INPUTS,
      sinkingFundResults: computeSinkingFund(DEFAULT_SINKING_FUND_INPUTS),
      netWorthAssets: [
        { id: 'asset-cash', name: 'Cash / Checking', amount: 0, category: 'Cash' },
      ],
      netWorthLiabilities: [],
      netWorthHistory: [],
      forecastScenarios: DEFAULT_FORECAST_SCENARIOS,
      forecastBaselineScenarioId: DEFAULT_FORECAST_SCENARIOS[0].id,

      setPaycheckInputs: (inputs) =>
        set((state) => {
          const newInputs = { ...state.paycheckInputs, ...inputs };
          return {
            paycheckInputs: newInputs,
            paycheckResults: computePaycheck(newInputs),
            planLastUpdated: new Date().toISOString(),
          };
        }),

      setBudgetInputs: (inputs) =>
        set((state) => ({
          budgetInputs: { ...state.budgetInputs, ...inputs },
          planLastUpdated: new Date().toISOString(),
        })),

      setDebts: (debts) =>
        set({ debts, planLastUpdated: new Date().toISOString() }),

      setGoals: (goals) =>
        set({ goals: normalizeGoalOrder(goals), planLastUpdated: new Date().toISOString() }),

      setInvestmentInputs: (inputs) =>
        set((state) => ({
          investmentInputs: { ...state.investmentInputs, ...inputs },
          planLastUpdated: new Date().toISOString(),
        })),

      setRentVsBuyInputs: (inputs) =>
        set((state) => {
          const baseInputs = state.rentVsBuyInputs ?? {
            purchasePrice: 600000,
            downPaymentPct: 0.2,
            mortgageRate: 0.065,
            loanTermYears: 30,
            annualPropertyTaxRate: 0.011,
            annualAppreciationRate: 0.035,
            annualMaintenancePct: 0.01,
            hoaMonthly: 0,
            closingCostPct: 0.03,
            sellingCostPct: 0.06,
            pmiRate: 0.008,
            monthlyRent: 3000,
            annualRentIncrease: 0.03,
            rentersInsuranceMonthly: 15,
            investmentReturnRate: 0.07,
            marginalTaxRate: state.paycheckResults?.marginalCombinedRate || 0.28,
            filingStatus: state.paycheckInputs?.filingStatus || 'single',
            itemizeDeductions: false,
            plannedStayYears: 7,
            state: state.paycheckInputs?.state || 'Massachusetts',
          };
          const merged = { ...baseInputs, ...inputs };
          return {
            rentVsBuyInputs: merged,
            rentVsBuyResults: computeRentVsBuy(merged),
            planLastUpdated: new Date().toISOString(),
          };
        }),

      setSinkingFundInputs: (inputs) =>
        set((state) => {
          const merged = { ...state.sinkingFundInputs, ...inputs };
          return {
            sinkingFundInputs: merged,
            sinkingFundResults: computeSinkingFund(merged),
            planLastUpdated: new Date().toISOString(),
          };
        }),

      setNetWorthAssets: (items) =>
        set({
          netWorthAssets: items,
          planLastUpdated: new Date().toISOString(),
        }),

      setNetWorthLiabilities: (items) =>
        set({
          netWorthLiabilities: items,
          planLastUpdated: new Date().toISOString(),
        }),

      addNetWorthSnapshot: () =>
        set((state) => {
          const totals = computeNetWorthTotals(state.netWorthAssets, state.netWorthLiabilities);
          const date = currentYearMonth();
          const next = state.netWorthHistory.filter((h) => h.date !== date);
          next.push({
            date,
            assets: totals.assets,
            liabilities: totals.liabilities,
            netWorth: totals.netWorth,
          });
          next.sort((a, b) => a.date.localeCompare(b.date));
          return {
            netWorthHistory: next,
            planLastUpdated: new Date().toISOString(),
          };
        }),

      setForecastScenarios: (items) =>
        set({
          forecastScenarios: items,
          planLastUpdated: new Date().toISOString(),
        }),
      setForecastBaselineScenarioId: (id) =>
        set({
          forecastBaselineScenarioId: id,
          planLastUpdated: new Date().toISOString(),
        }),
    }),
    {
      name: 'finwise-unified-store',
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as PersistedStateV1;
        const budget = state.budgetInputs ?? {};
        const legacyTransportation =
          typeof budget.transportation === 'number' ? budget.transportation : 0;
        return {
          ...state,
          budgetInputs: {
            ...DEFAULT_BUDGET_INPUTS,
            ...budget,
            otherTransport:
              typeof budget.otherTransport === 'number'
                ? (budget.otherTransport as number)
                : legacyTransportation,
          },
        } as FinWiseStore;
      },
    }
  )
);

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      transactions: [],
      budgets: CATEGORIES.map((c) => ({ category: c, monthlyLimit: 0 })),

      addTransaction: (t) =>
        set((s) => ({
          transactions: [
            { ...t, id: crypto.randomUUID() },
            ...s.transactions,
          ],
        })),

      addTransactionsBulk: (items) =>
        set((s) => {
          if (!items.length) return s;
          const existingKeys = new Set(
            s.transactions.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.type}|${t.description.trim().toLowerCase()}`)
          );
          const next = [...s.transactions];
          let added = 0;
          for (const item of items) {
            const key = `${item.date}|${item.amount.toFixed(2)}|${item.type}|${item.description.trim().toLowerCase()}`;
            if (existingKeys.has(key)) continue;
            next.unshift({ ...item, id: crypto.randomUUID() });
            existingKeys.add(key);
            added += 1;
          }
          return added ? { transactions: next } : s;
        }),

      updateTransaction: (id, updates) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      deleteTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.id !== id),
        })),

      setBudget: (category, limit) =>
        set((s) => ({
          budgets: s.budgets.map((b) =>
            b.category === category ? { ...b, monthlyLimit: limit } : b
          ),
        })),
    }),
    { name: 'finwise-store' }
  )
);
