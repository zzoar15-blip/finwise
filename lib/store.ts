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

  setPaycheckInputs: (inputs: Partial<StorePaycheckInputs>) => void;
  setBudgetInputs: (inputs: Partial<StoreBudgetInputs>) => void;
  setDebts: (debts: FinWiseStore['debts']) => void;
  setGoals: (goals: string[]) => void;
  setInvestmentInputs: (inputs: Partial<StoreInvestmentInputs>) => void;
  setRentVsBuyInputs: (inputs: Partial<RentVsBuyInputs>) => void;
}

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
        set({ goals, planLastUpdated: new Date().toISOString() }),

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
    }),
    { name: 'finwise-unified-store' }
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
