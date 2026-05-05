'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanStore, PlanInputs, PlanAIInsights, AppSettings, PaycheckProfile, DebtProfile, InvestProfile, AIInsightsCache } from '@/types/plan';

const DEFAULT_SETTINGS: AppSettings = {
  displayName: '',
  defaultState: 'CA',
  acceptedInstitutionalDisclosure: false,
};

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      plan: null,
      settings: DEFAULT_SETTINGS,
      paycheckProfile: null,
      debtProfile: null,
      investProfile: null,
      planLastUpdated: null,
      aiInsightsCache: null,
      actionChecklist: [],

      setPlan: (inputs: PlanInputs) =>
        set({
          plan: {
            inputs,
            insights: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),

      updatePlanInputs: (partial: Partial<PlanInputs>) =>
        set((s) =>
          s.plan
            ? {
                plan: {
                  ...s.plan,
                  inputs: { ...s.plan.inputs, ...partial },
                  updatedAt: new Date().toISOString(),
                },
              }
            : {}
        ),

      setPlanInsights: (insights: PlanAIInsights) =>
        set((s) =>
          s.plan ? { plan: { ...s.plan, insights } } : {}
        ),

      clearPlan: () => set({ plan: null }),

      updateSettings: (partial: Partial<AppSettings>) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      setPaycheckProfile: (profile: PaycheckProfile) =>
        set({ paycheckProfile: profile, planLastUpdated: new Date().toISOString() }),

      setDebtProfile: (profile: DebtProfile) =>
        set({ debtProfile: profile, planLastUpdated: new Date().toISOString() }),

      setInvestProfile: (profile: InvestProfile) =>
        set({ investProfile: profile, planLastUpdated: new Date().toISOString() }),

      setAIInsightsCache: (cache: AIInsightsCache) =>
        set({ aiInsightsCache: cache }),

      setActionChecklist: (items) =>
        set({ actionChecklist: items, planLastUpdated: new Date().toISOString() }),
    }),
    { name: 'finwise-plan-store' }
  )
);
