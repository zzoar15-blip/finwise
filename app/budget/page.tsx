'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Home, CreditCard } from 'lucide-react';

interface BudgetData {
  salary: number;
  investmentIncome: number;
  housing: number;
  debtPayments: number;
  k401: number;
  rothIRA: number;
  brokerage: number;
  brokerageNote: string;
  groceries: number;
  dining: number;
  transport: number;
  subscriptions: number;
  phone: number;
  health: number;
  travel: number;
  misc: number;
}

const NOW_DEFAULT: BudgetData = {
  salary: 5000,
  investmentIncome: 0,
  housing: 1800,
  debtPayments: 200,
  k401: 500,
  rothIRA: 583,
  brokerage: 0,
  brokerageNote: '',
  groceries: 400,
  dining: 200,
  transport: 150,
  subscriptions: 50,
  phone: 80,
  health: 100,
  travel: 100,
  misc: 200,
};

const FUTURE_DEFAULT: BudgetData = {
  salary: 7000,
  investmentIncome: 500,
  housing: 2000,
  debtPayments: 0,
  k401: 700,
  rothIRA: 583,
  brokerage: 500,
  brokerageNote: 'JEPI',
  groceries: 400,
  dining: 150,
  transport: 150,
  subscriptions: 50,
  phone: 80,
  health: 100,
  travel: 200,
  misc: 150,
};

const CHART_COLORS = {
  Housing: '#f97316',
  Debt: '#ef4444',
  Savings: '#22c55e',
  Living: '#3b82f6',
  Other: '#8b5cf6',
};

function derive(b: BudgetData) {
  const totalIncome = b.salary + b.investmentIncome;
  const savingsTotal = b.k401 + b.rothIRA + b.brokerage;
  const livingTotal =
    b.groceries + b.dining + b.transport + b.subscriptions + b.phone + b.health + b.travel + b.misc;
  const totalExpenses = b.housing + b.debtPayments + savingsTotal + livingTotal;
  const monthlySurplus = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (savingsTotal / totalIncome) * 100 : 0;
  const annualIncome = totalIncome * 12;
  const annualSurplus = monthlySurplus * 12;
  return { totalIncome, savingsTotal, livingTotal, totalExpenses, monthlySurplus, savingsRate, annualIncome, annualSurplus };
}

function savingsRateColor(rate: number) {
  if (rate >= 20) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (rate >= 10) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function NumericInput({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`w-28 text-right ${className}`}
    />
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Separator className="mt-1" />
    </div>
  );
}

function BudgetRow({
  label,
  value,
  onChange,
  note,
  onNoteChange,
  icon,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  note?: string;
  onNoteChange?: (s: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex items-center gap-1.5 text-sm text-foreground/80 min-w-0 flex-1">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {onNoteChange !== undefined && (
          <Input
            type="text"
            placeholder="ticker"
            value={note ?? ''}
            onChange={(e) => onNoteChange(e.target.value)}
            className="w-20 text-xs text-right"
          />
        )}
        <span className="text-sm text-muted-foreground">$</span>
        <NumericInput value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function BudgetColumn({
  label,
  color,
  data,
  setData,
}: {
  label: string;
  color: 'blue' | 'green';
  data: BudgetData;
  setData: (d: BudgetData) => void;
}) {
  const set = (key: keyof BudgetData) => (v: number | string) =>
    setData({ ...data, [key]: v });

  const {
    totalIncome,
    savingsTotal,
    livingTotal,
    totalExpenses,
    monthlySurplus,
    savingsRate,
  } = derive(data);

  const badgeClass =
    color === 'blue'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';

  return (
    <Card className="flex-1 min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{label === 'Now' ? 'Current Budget' : 'Future Budget'}</span>
          <span
            className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-semibold ${badgeClass}`}
          >
            {label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {/* INCOME */}
        <SectionLabel label="Income" />
        <BudgetRow label="Salary" value={data.salary} onChange={set('salary') as (n: number) => void} icon={<DollarSign className="size-3.5 text-muted-foreground" />} />
        <BudgetRow label="Investment Income" value={data.investmentIncome} onChange={set('investmentIncome') as (n: number) => void} icon={<TrendingUp className="size-3.5 text-muted-foreground" />} />

        {/* HOUSING */}
        <SectionLabel label="Housing" />
        <BudgetRow label="Housing / Rent" value={data.housing} onChange={set('housing') as (n: number) => void} icon={<Home className="size-3.5 text-muted-foreground" />} />

        {/* DEBT PAYMENTS */}
        <SectionLabel label="Debt Payments" />
        <BudgetRow label="Debt Payments" value={data.debtPayments} onChange={set('debtPayments') as (n: number) => void} icon={<CreditCard className="size-3.5 text-muted-foreground" />} />

        {/* SAVINGS & INVESTMENTS */}
        <SectionLabel label="Savings & Investments" />
        <BudgetRow label="401(k)" value={data.k401} onChange={set('k401') as (n: number) => void} icon={<PiggyBank className="size-3.5 text-muted-foreground" />} />
        <BudgetRow label="Roth IRA" value={data.rothIRA} onChange={set('rothIRA') as (n: number) => void} icon={<PiggyBank className="size-3.5 text-muted-foreground" />} />
        <BudgetRow
          label="Brokerage"
          value={data.brokerage}
          onChange={set('brokerage') as (n: number) => void}
          note={data.brokerageNote}
          onNoteChange={set('brokerageNote') as (s: string) => void}
          icon={<PiggyBank className="size-3.5 text-muted-foreground" />}
        />

        {/* LIVING EXPENSES */}
        <SectionLabel label="Living Expenses" />
        <BudgetRow label="Groceries" value={data.groceries} onChange={set('groceries') as (n: number) => void} />
        <BudgetRow label="Dining Out" value={data.dining} onChange={set('dining') as (n: number) => void} />
        <BudgetRow label="Transport" value={data.transport} onChange={set('transport') as (n: number) => void} />
        <BudgetRow label="Subscriptions" value={data.subscriptions} onChange={set('subscriptions') as (n: number) => void} />
        <BudgetRow label="Phone" value={data.phone} onChange={set('phone') as (n: number) => void} />
        <BudgetRow label="Health" value={data.health} onChange={set('health') as (n: number) => void} />
        <BudgetRow label="Travel" value={data.travel} onChange={set('travel') as (n: number) => void} />
        <BudgetRow label="Misc" value={data.misc} onChange={set('misc') as (n: number) => void} />

        {/* TOTALS FOOTER */}
        <div className="mt-4 rounded-lg bg-muted/50 p-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Income</span>
            <span className="font-medium">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-medium">{formatCurrency(totalExpenses)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm font-semibold">
            <span>Monthly Surplus</span>
            <span className={monthlySurplus >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {monthlySurplus >= 0 ? '+' : ''}{formatCurrency(monthlySurplus)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Savings Rate</span>
            <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold ${savingsRateColor(savingsRate)}`}>
              {savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span>Savings / mo</span>
            <span>{formatCurrency(savingsTotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Living / mo</span>
            <span>{formatCurrency(livingTotal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpendingPie({ data, title }: { data: BudgetData; title: string }) {
  const { savingsTotal, livingTotal } = derive(data);
  const pieData = [
    { name: 'Housing', value: data.housing, color: CHART_COLORS.Housing },
    { name: 'Debt', value: data.debtPayments, color: CHART_COLORS.Debt },
    { name: 'Savings', value: savingsTotal, color: CHART_COLORS.Savings },
    { name: 'Living', value: livingTotal, color: CHART_COLORS.Living },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex-1 min-w-0">
      <p className="mb-2 text-center text-sm font-medium text-muted-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function BudgetPage() {
  const [nowData, setNowData] = useState<BudgetData>(NOW_DEFAULT);
  const [futureData, setFutureData] = useState<BudgetData>(FUTURE_DEFAULT);

  const nowDerived = derive(nowData);
  const futureDerived = derive(futureData);

  // Bar chart comparing major categories
  const barData = [
    {
      category: 'Housing',
      Now: nowData.housing,
      Future: futureData.housing,
    },
    {
      category: 'Debt',
      Now: nowData.debtPayments,
      Future: futureData.debtPayments,
    },
    {
      category: 'Savings',
      Now: nowDerived.savingsTotal,
      Future: futureDerived.savingsTotal,
    },
    {
      category: 'Living',
      Now: nowDerived.livingTotal,
      Future: futureDerived.livingTotal,
    },
  ];

  // Annual projections table rows
  type ProjectionRow = {
    metric: string;
    nowVal: number;
    futureVal: number;
    higherIsBetter: boolean;
  };

  const projectionRows: ProjectionRow[] = [
    {
      metric: 'Income',
      nowVal: nowDerived.annualIncome,
      futureVal: futureDerived.annualIncome,
      higherIsBetter: true,
    },
    {
      metric: 'Expenses',
      nowVal: nowDerived.totalExpenses * 12,
      futureVal: futureDerived.totalExpenses * 12,
      higherIsBetter: false,
    },
    {
      metric: 'Surplus',
      nowVal: nowDerived.annualSurplus,
      futureVal: futureDerived.annualSurplus,
      higherIsBetter: true,
    },
    {
      metric: 'Savings Invested',
      nowVal: nowDerived.savingsTotal * 12,
      futureVal: futureDerived.savingsTotal * 12,
      higherIsBetter: true,
    },
  ];

  function changeColor(row: ProjectionRow): string {
    const diff = row.futureVal - row.nowVal;
    if (diff === 0) return 'text-muted-foreground';
    const positive = row.higherIsBetter ? diff > 0 : diff < 0;
    return positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <h1 className="text-2xl font-bold">Budget Planner</h1>

      {/* Two-column grid */}
      <div className="flex gap-4 flex-col lg:flex-row">
        <BudgetColumn label="Now" color="blue" data={nowData} setData={setNowData} />
        <BudgetColumn label="Future" color="green" data={futureData} setData={setFutureData} />
      </div>

      {/* Analysis section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Analysis</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Donut charts */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <SpendingPie data={nowData} title="Now" />
                <SpendingPie data={futureData} title="Future" />
              </div>
            </CardContent>
          </Card>

          {/* Grouped bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Category Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
                  <Legend iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Bar dataKey="Now" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Future" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Annual Projections table */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium text-right">Now (Annual)</th>
                  <th className="pb-2 font-medium text-right">Future (Annual)</th>
                  <th className="pb-2 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {projectionRows.map((row) => {
                  const diff = row.futureVal - row.nowVal;
                  const pct = row.nowVal !== 0 ? (diff / Math.abs(row.nowVal)) * 100 : 0;
                  return (
                    <tr key={row.metric}>
                      <td className="py-2.5 font-medium">{row.metric}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(row.nowVal)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(row.futureVal)}</td>
                      <td className={`py-2.5 text-right tabular-nums font-medium ${changeColor(row)}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        <span className="ml-1 text-xs opacity-70">
                          ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
