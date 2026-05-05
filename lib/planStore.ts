'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanStore, PlanInputs, PlanAIInsights, AppSettings } from '@/types/plan';

const DEFAULT_SETTINGS: AppSettings = {
  displayName: '',
  defaultState: 'CA',
};

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      plan: null,
      settings: DEFAULT_SETTINGS,

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
    }),
    { name: 'finwise-plan-store' }
  )
);
