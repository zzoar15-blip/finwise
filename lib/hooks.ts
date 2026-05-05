import { useFinanceStore } from '@/lib/store';
import type { CategorySummary, MonthSummary } from '@/types/finance';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export function useCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

export function useMonthTransactions(yearMonth: string) {
  return useFinanceStore((s) =>
    s.transactions.filter((t) => t.date.startsWith(yearMonth))
  );
}

export function useMonthSummary(yearMonth: string): MonthSummary {
  const transactions = useMonthTransactions(yearMonth);
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, net: income - expenses };
}

export function useCategorySummaries(yearMonth: string): CategorySummary[] {
  const transactions = useMonthTransactions(yearMonth);
  const budgets = useFinanceStore((s) => s.budgets);

  return EXPENSE_CATEGORIES.map((category) => {
    const spent = transactions
      .filter((t) => t.type === 'expense' && t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);
    const budget = budgets.find((b) => b.category === category);
    const budgeted = budget?.monthlyLimit ?? 0;
    const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
    return { category, spent, budgeted, percentage };
  });
}
