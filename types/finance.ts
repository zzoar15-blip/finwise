export type TransactionType = 'income' | 'expense';

export type Category =
  | 'Food'
  | 'Transport'
  | 'Housing'
  | 'Entertainment'
  | 'Health'
  | 'Shopping'
  | 'Income'
  | 'Other';

export interface Transaction {
  id: string;
  date: string; // ISO: "2026-05-04"
  amount: number; // always positive
  type: TransactionType;
  category: Category;
  description: string;
}

export interface Budget {
  category: Category;
  monthlyLimit: number;
}

export interface CategorySummary {
  category: Category;
  spent: number;
  budgeted: number;
  percentage: number;
}

export interface MonthSummary {
  income: number;
  expenses: number;
  net: number;
}

export interface FinanceStore {
  transactions: Transaction[];
  budgets: Budget[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  addTransactionsBulk: (items: Array<Omit<Transaction, 'id'>>) => void;
  updateTransaction: (id: string, t: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: Category, limit: number) => void;
}
