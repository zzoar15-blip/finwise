import { useMemo } from 'react';
import { useFinanceStore } from '@/lib/store';
import type { CategorySummary, MonthSummary } from '@/types/finance';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export function useCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function useMonthTransactions(yearMonth: string) {
  const transactions = useFinanceStore((s) => s.transactions);
  return useMemo(
    () => transactions.filter((t) => t.date.startsWith(yearMonth)),
    [transactions, yearMonth]
  );
}

export function useMonthSummary(yearMonth: string): MonthSummary {
  const transactions = useMonthTransactions(yearMonth);
  return useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount;
      else expenses += t.amount;
    }
    return { income, expenses, net: income - expenses };
  }, [transactions]);
}

export function useCategorySummaries(yearMonth: string): CategorySummary[] {
  const transactions = useMonthTransactions(yearMonth);
  const budgets = useFinanceStore((s) => s.budgets);
  return useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => {
        const spent = transactions
          .filter((t) => t.type === 'expense' && t.category === category)
          .reduce((sum, t) => sum + t.amount, 0);
        const budget = budgets.find((b) => b.category === category);
        const budgeted = budget?.monthlyLimit ?? 0;
        const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
        return { category, spent, budgeted, percentage };
      }),
    [transactions, budgets]
  );
}
