import type { Category } from '@/types/finance';

export const CATEGORIES: Category[] = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Health',
  'Shopping',
  'Income',
  'Other',
];

export const EXPENSE_CATEGORIES: Category[] = CATEGORIES.filter(
  (c) => c !== 'Income'
);

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: '#f97316',
  Transport: '#3b82f6',
  Housing: '#8b5cf6',
  Entertainment: '#ec4899',
  Health: '#22c55e',
  Shopping: '#eab308',
  Income: '#14b8a6',
  Other: '#94a3b8',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Food: '🍔',
  Transport: '🚗',
  Housing: '🏠',
  Entertainment: '🎬',
  Health: '💊',
  Shopping: '🛍️',
  Income: '💰',
  Other: '📦',
};
