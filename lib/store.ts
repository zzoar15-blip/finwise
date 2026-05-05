'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES } from '@/lib/constants';
import type { FinanceStore } from '@/types/finance';

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
