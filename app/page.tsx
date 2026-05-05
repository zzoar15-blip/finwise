'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Calculator, PieChart, CreditCard, TrendingUp, BarChart3 } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useFinanceStore } from '@/lib/store';
import {
  useCurrentMonth,
  useMonthTransactions,
  useMonthSummary,
  useCategorySummaries,
} from '@/lib/hooks';
import { formatCurrency, formatDate, formatMonth, getMonthOptions } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/constants';
import type { Transaction } from '@/types/finance';

const QUICK_LINKS = [
  {
    href: '/paycheck',
    icon: Calculator,
    title: 'Paycheck Calculator',
    description: 'Estimate your take-home pay after taxes and deductions.',
  },
  {
    href: '/budget',
    icon: PieChart,
    title: 'Budget Planner',
    description: 'Set monthly limits per category and track usage.',
  },
  {
    href: '/debt',
    icon: CreditCard,
    title: 'Debt Payoff',
    description: 'Model avalanche or snowball payoff strategies.',
  },
  {
    href: '/invest',
    icon: TrendingUp,
    title: 'Investments',
    description: 'Project portfolio growth with compound returns.',
  },
  {
    href: '/forecast',
    icon: BarChart3,
    title: 'Forecaster',
    description: 'See a 12-month cashflow projection.',
  },
];

export default function DashboardPage() {
  const currentMonth = useCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [formOpen, setFormOpen] = useState(false);
  const monthOptions = getMonthOptions(12);

  const allTransactions = useFinanceStore((s) => s.transactions);
  const summary = useMonthSummary(month);
  const monthTransactions = useMonthTransactions(month);
  const categorySummaries = useCategorySummaries(month);

  // Pie chart data — categories with any spending this month
  const pieData = categorySummaries.filter((cs) => cs.spent > 0);

  // Net worth trend — cumulative running net across all transactions, last 12 months
  const trendData = useMemo(() => {
    if (allTransactions.length === 0) return [];

    // Group by YYYY-MM
    const byMonth: Record<string, number> = {};
    for (const t of allTransactions) {
      const ym = t.date.slice(0, 7);
      const delta = t.type === 'income' ? t.amount : -t.amount;
      byMonth[ym] = (byMonth[ym] ?? 0) + delta;
    }

    const sortedMonths = Object.keys(byMonth).sort();

    // Build cumulative series
    let running = 0;
    const all = sortedMonths.map((ym) => {
      running += byMonth[ym];
      return { ym, net: running };
    });

    // Keep last 12
    const last12 = all.slice(-12);

    return last12.map((d) => ({
      label: formatMonth(d.ym),
      net: Math.round(d.net * 100) / 100,
    }));
  }, [allTransactions]);

  const recentTransactions: Transaction[] = monthTransactions.slice(0, 5);

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Select value={month} onValueChange={(v) => v && setMonth(v)}>
          <SelectTrigger className="w-48">
            <SelectValue>{formatMonth(month)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.income)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.expenses)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Net Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                summary.net >= 0 ? 'text-[#1a56a8]' : 'text-red-600'
              }`}
            >
              {formatCurrency(summary.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Spending by Category */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-gray-400">
                No expenses this month
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    dataKey="spent"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Net Worth Trend */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Net Worth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length < 2 ? (
              <div className="flex h-56 items-center justify-center text-sm text-gray-400">
                Add transactions to see trend
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCurrency(v)}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#1a56a8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#1a56a8' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Tools</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_LINKS.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="group block">
              <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all group-hover:border-[#1a56a8] group-hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1a56a8]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-snug">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-400">No transactions for {formatMonth(month)}.</p>
              <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add your first transaction
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base">
                    {CATEGORY_ICONS[t.category]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{t.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 font-mono text-xs ${
                      t.type === 'income'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '−'}
                    {formatCurrency(t.amount)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Transaction Form Modal */}
      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
