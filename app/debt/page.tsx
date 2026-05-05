'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { simulateDebtPayoff, buildSensitivityTable } from '@/lib/calculations/debt';
import type { Debt, DebtResult, SensitivityRow } from '@/lib/calculations/debt';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv } from '@/lib/export';
import { exportDomToPdf } from '@/lib/exportPdf';
import { formatCurrency } from '@/lib/format';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';
import { SyncMeta } from '@/components/SyncMeta';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2, Calendar, Clock, TrendingDown, Sparkles, ChevronLeft, Lightbulb } from 'lucide-react';

const DEBT_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDebtFreeDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [year, month] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatChartDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function shouldShowDate(dateStr: string, index: number): boolean {
  const [, month] = dateStr.split('-');
  return Number(month) % 6 === 1 || index === 0;
}

export default function DebtPage() {
  const storeDebts = useFinWiseStore((s) => s.debts);
  const setStoreDebts = useFinWiseStore((s) => s.setDebts);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const setDebtProfile = usePlanStore((s) => s.setDebtProfile);
  const debtProfile = usePlanStore((s) => s.debtProfile);

  const debts = storeDebts;
  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budgetInputs, debts),
    [paycheckInputs, paycheckResults, budgetInputs, debts],
  );
  const surplus = flow.monthlySurplus;
  const surplusRounded = Math.max(0, Math.min(2000, Math.round(surplus / 100) * 100));

  const [monthlyOverpayment, setMonthlyOverpayment] = useState(
    debtProfile?.monthlyOverpayment ?? surplusRounded,
  );
  const [annualBonus, setAnnualBonus] = useState(debtProfile?.annualBonus ?? 0);
  const [bonusMonth, setBonusMonth] = useState(debtProfile?.bonusMonth ?? 2);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>(debtProfile?.strategy ?? 'avalanche');
  const hydratedDebtProfileRef = useRef(false);

  useEffect(() => {
    if (hydratedDebtProfileRef.current || !debtProfile) return;
    hydratedDebtProfileRef.current = true;
    setMonthlyOverpayment(Math.max(0, debtProfile.monthlyOverpayment ?? 0));
    setAnnualBonus(Math.max(0, debtProfile.annualBonus ?? 0));
    setBonusMonth(Math.min(12, Math.max(1, debtProfile.bonusMonth ?? 2)));
    setStrategy(debtProfile.strategy ?? 'avalanche');
    if (storeDebts.length === 0 && debtProfile.debts.length > 0) {
      setStoreDebts(debtProfile.debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment,
      })));
    }
  }, [debtProfile, setStoreDebts, storeDebts.length]);

  useEffect(() => {
    setDebtProfile({
      debts: debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment,
      })),
      monthlyOverpayment,
      annualBonus,
      bonusMonth,
      strategy,
    });
  }, [debts, monthlyOverpayment, annualBonus, bonusMonth, strategy, setDebtProfile]);

  const result: DebtResult = useMemo(
    () => simulateDebtPayoff(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy),
    [debts, monthlyOverpayment, annualBonus, bonusMonth, strategy],
  );

  const sensitivity: SensitivityRow[] = useMemo(
    () =>
      debts.length > 0 && debts.some((d) => d.balance > 0)
        ? buildSensitivityTable(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy)
        : [],
    [debts, monthlyOverpayment, annualBonus, bonusMonth, strategy],
  );

  const chartData = useMemo(() => {
    return result.snapshots.map((s) => {
      const row: Record<string, number | string> = { date: s.date };
      for (const d of debts) row[d.name] = s.balances[d.id] ?? 0;
      return row;
    });
  }, [result.snapshots, debts]);

  function addDebt() {
    if (debts.length >= 5) return;
    const newDebt: Debt = {
      id: Date.now().toString(),
      name: 'New Debt',
      balance: 0,
      apr: 0,
      minPayment: 0,
    };
    setStoreDebts([...debts, newDebt]);
  }

  function removeDebt(id: string) {
    setStoreDebts(debts.filter((d) => d.id !== id));
  }

  function updateDebt(id: string, field: keyof Debt, value: string | number) {
    setStoreDebts(debts.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  const hasDebts = debts.length > 0 && debts.some((d) => d.balance > 0);

  function buildExportRows(): (string | number)[][] {
    const headers = ['Month', 'Date', ...debts.map((d) => d.name), 'Total Balance ($)', 'Cumulative Interest ($)'];
    const dataRows = result.snapshots.map((s) => [
      s.month,
      s.date,
      ...debts.map((d) => Math.round((s.balances[d.id] ?? 0) * 100) / 100),
      Math.round(s.totalBalance * 100) / 100,
      Math.round(s.cumulativeInterest * 100) / 100,
    ]);
    return [headers, ...dataRows];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" id="tool-debt-export">
      <div className="space-y-3">
        <Link href="/plan" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-3" /> My Plan
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Debt Payoff Simulator</h1>
            <SyncMeta updatedAt={planLastUpdated} badges={['Unified Flow']} />
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() =>
                exportDomToPdf({ elementId: 'tool-debt-export', filenamePrefix: `finwise-debt-${strategy}` })
              }
            >
              Export PDF
            </Button>
            {hasDebts && (
              <ExportButton
                onExportXlsx={async () => {
                  const { exportDebtWorkbook } = await import('@/lib/excel/exports/debt');
                  exportDebtWorkbook(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);
                }}
                onExportCsv={() => downloadCsv(buildExportRows(), `finwise-debt-${strategy}`)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Debts Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Your Debts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {debts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No debts added yet. Click &quot;+ Add Debt&quot; to get started.
            </p>
          )}

          {debts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium text-right">Balance ($)</th>
                    <th className="pb-2 font-medium text-right">APR (%)</th>
                    <th className="pb-2 font-medium text-right">Min Payment ($)</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {debts.map((debt, i) => (
                    <tr key={debt.id}>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: DEBT_COLORS[i % DEBT_COLORS.length] }}
                          />
                          <Input
                            value={debt.name}
                            onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                            className="h-7 w-36 text-sm"
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={100}
                          value={debt.balance || ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateDebt(debt.id, 'balance', parseFloat(e.target.value) || 0)
                          }
                          className="h-7 w-28 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={debt.apr || ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateDebt(debt.id, 'apr', parseFloat(e.target.value) || 0)
                          }
                          className="h-7 w-24 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={10}
                          value={debt.minPayment || ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateDebt(debt.id, 'minPayment', parseFloat(e.target.value) || 0)
                          }
                          className="h-7 w-28 text-right text-sm"
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeDebt(debt.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {debts.length < 5 && (
            <Button variant="outline" size="sm" onClick={addDebt}>
              <Plus />
              Add Debt
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Payment Strategy */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Payment Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Strategy toggle */}
          <div className="space-y-2">
            <Label>Payoff Strategy</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStrategy('avalanche')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  strategy === 'avalanche'
                    ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                    : 'border-border bg-transparent text-foreground hover:bg-muted'
                }`}
              >
                Avalanche (Highest Rate First)
              </button>
              <button
                type="button"
                onClick={() => setStrategy('snowball')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  strategy === 'snowball'
                    ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                    : 'border-border bg-transparent text-foreground hover:bg-muted'
                }`}
              >
                Snowball (Lowest Balance First)
              </button>
            </div>
          </div>

          {/* Budget surplus callout */}
          {flow.paycheck.isComplete && surplus > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
              <Lightbulb className="size-4 shrink-0 mt-0.5 text-blue-600" />
              <p>
                Based on your budget you have ~<strong>{formatCurrency(surplus)}</strong> available for extra payments
              </p>
            </div>
          )}

          {/* Monthly overpayment slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="overpayment">Monthly Overpayment</Label>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(monthlyOverpayment)}
              </span>
            </div>
            <input
              id="overpayment"
              type="range"
              min={0}
              max={2000}
              step={25}
              value={monthlyOverpayment}
              onChange={(e) => setMonthlyOverpayment(Number(e.target.value))}
              className="w-full h-2 rounded-full bg-border accent-[#3b82f6] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$0</span>
              <span>$2,000</span>
            </div>
          </div>

          {/* Annual bonus and month */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bonus">Annual Bonus Lump Sum</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="bonus"
                  type="number"
                  min={0}
                  step={100}
                  value={annualBonus || ''}
                  placeholder="0"
                  onChange={(e) => setAnnualBonus(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bonus Month</Label>
              <Select
                value={String(bonusMonth)}
                onValueChange={(v) => v && setBonusMonth(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{MONTH_NAMES[bonusMonth - 1]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Debt-Free Date</p>
                <p className="mt-1 text-base font-semibold">
                  {hasDebts ? formatDebtFreeDate(result.debtFreeDate) : '—'}
                </p>
              </div>
              <Calendar className="size-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Months to Payoff</p>
                <p className="mt-1 text-base font-semibold">
                  {hasDebts ? `${result.monthsToPayoff} mo` : '—'}
                </p>
              </div>
              <Clock className="size-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Interest Paid</p>
                <p className="mt-1 text-base font-semibold text-red-600 dark:text-red-400">
                  {hasDebts ? formatCurrency(result.totalInterestPaid) : '—'}
                </p>
              </div>
              <TrendingDown className="size-4 text-red-400 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Interest Saved vs Minimums</p>
                <p className="mt-1 text-base font-semibold text-green-600 dark:text-green-400">
                  {hasDebts ? formatCurrency(result.interestSavedVsMinimum) : '—'}
                </p>
              </div>
              <Sparkles className="size-4 text-green-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payoff Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payoff Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasDebts || chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Add debts above to see the payoff chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val: string, index: number) =>
                    shouldShowDate(val, index) ? formatChartDate(val) : ''
                  }
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v, n) => [typeof v === 'number' ? formatCurrency(v) : String(v), String(n)]}
                  labelFormatter={(l) => String(l)}
                />
                <Legend iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
                {debts.map((d, i) => (
                  <Area
                    key={d.id}
                    type="monotone"
                    dataKey={d.name}
                    stackId="1"
                    stroke={DEBT_COLORS[i % DEBT_COLORS.length]}
                    fill={DEBT_COLORS[i % DEBT_COLORS.length]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Sensitivity Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {sensitivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Add debts above to see sensitivity analysis.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Extra / Month</th>
                    <th className="pb-2 font-medium text-right">Payoff Date</th>
                    <th className="pb-2 font-medium text-right">Total Interest</th>
                    <th className="pb-2 font-medium text-right">Interest Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sensitivity.map((row, i) => {
                    const incrementAmounts = [0, 100, 200, 300, 400, 500];
                    const isCurrentRow = incrementAmounts[i] === 0;
                    return (
                      <tr
                        key={i}
                        className={isCurrentRow ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : ''}
                      >
                        <td className="py-2.5">
                          <span className="flex items-center gap-2">
                            {formatCurrency(row.extraPerMonth)}
                            {isCurrentRow && (
                              <Badge variant="secondary" className="text-xs">
                                current
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {row.monthsToPayoff > 0
                            ? `${row.monthsToPayoff} mo`
                            : '—'}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(row.totalInterest)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">
                          {formatCurrency(row.interestSaved)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
