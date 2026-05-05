'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { forecastScenario, findBreakeven } from '@/lib/calculations/forecast';
import type { Scenario, ScenarioResult } from '@/lib/calculations/forecast';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv, downloadXlsxFromAoa } from '@/lib/export';
import { exportDomToPdf } from '@/lib/exportPdf';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2, TrendingUp, Home, Shield, DollarSign, Timer } from 'lucide-react';
import { usePlanStore } from '@/lib/planStore';
import { useFinWiseStore } from '@/lib/store';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';

const SCENARIO_COLORS = ['#3b82f6', '#22c55e', '#f97316'] as const;

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: '1',
    name: 'Conservative',
    color: '#3b82f6',
    startingSalary: 80000,
    annualRaise: 2,
    savingsRate: 15,
    investmentReturn: 6,
    startingNetWorth: 10000,
  },
  {
    id: '2',
    name: 'Aggressive',
    color: '#22c55e',
    startingSalary: 80000,
    annualRaise: 5,
    savingsRate: 30,
    investmentReturn: 8,
    startingNetWorth: 10000,
  },
];

function yAxisFormatter(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

// Light tint backgrounds for summary table cells
const CELL_BG: Record<string, string> = {
  '#3b82f6': 'rgba(26, 86, 168, 0.08)',
  '#22c55e': 'rgba(34, 197, 94, 0.08)',
  '#f97316': 'rgba(249, 115, 22, 0.08)',
};

interface ScenarioFieldProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function ScenarioField({ label, value, prefix, suffix, onChange }: ScenarioFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onChange(n);
          }}
          className={prefix ? 'pl-6' : suffix ? 'pr-8' : ''}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const searchParams = useSearchParams();
  const focus = searchParams.get('focus');
  const plan = usePlanStore((s) => s.plan);
  const budget = useFinWiseStore((s) => s.budgetInputs);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const debts = useFinWiseStore((s) => s.debts);
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [homeExtraSavings, setHomeExtraSavings] = useState(0);
  const [homeApy, setHomeApy] = useState(4.5);
  const [homeMonthlyGrowth, setHomeMonthlyGrowth] = useState(0);
  const [emergencyApy, setEmergencyApy] = useState(3.5);
  const [investMonthlyExtra, setInvestMonthlyExtra] = useState(0);
  const [investReturn, setInvestReturn] = useState(7);
  const [retireTarget, setRetireTarget] = useState(1_500_000);
  const [retireReturn, setRetireReturn] = useState(7);

  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budget, debts),
    [paycheckInputs, paycheckResults, budget, debts]
  );

  const results: ScenarioResult[] = useMemo(
    () => scenarios.map((s) => ({ scenario: s, points: forecastScenario(s, 10) })),
    [scenarios]
  );

  // Build chart data: one entry per year, with each scenario's net worth
  const chartData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const entry: Record<string, number | string> = { year };
      for (const r of results) {
        entry[r.scenario.name] = r.points[i]?.netWorth ?? 0;
      }
      return entry;
    });
  }, [results]);

  function updateScenario(id: string, patch: Partial<Scenario>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addScenario() {
    if (scenarios.length >= 3) return;
    const idx = scenarios.length;
    const newScenario: Scenario = {
      id: String(Date.now()),
      name: `Scenario ${idx + 1}`,
      color: SCENARIO_COLORS[idx],
      startingSalary: 80000,
      annualRaise: 3,
      savingsRate: 20,
      investmentReturn: 7,
      startingNetWorth: 10000,
    };
    setScenarios((prev) => [...prev, newScenario]);
  }

  function removeScenario(id: string) {
    if (scenarios.length <= 1) return;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }

  // Breakeven pairs
  const breakevens = useMemo(() => {
    const pairs: Array<{ a: ScenarioResult; b: ScenarioResult; year: number | null }> = [];
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        pairs.push({
          a: results[i],
          b: results[j],
          year: findBreakeven(results[i].points, results[j].points),
        });
      }
    }
    return pairs;
  }, [results]);

  // Custom tooltip for the line chart
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-md text-sm">
        <p className="mb-2 font-semibold">Year {label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  function buildExportRows(): (string | number)[][] {
    const headers = ['Year', ...results.map((r) => `${r.scenario.name} Net Worth ($)`)];
    const rows = Array.from({ length: 10 }, (_, i) => [
      i + 1,
      ...results.map((r) => Math.round((r.points[i]?.netWorth ?? 0) * 100) / 100),
    ]);
    return [headers, ...rows];
  }

  const homeForecast = useMemo(() => {
    const target = plan?.inputs.homeTarget ?? 0;
    const timeline = Math.max(1, plan?.inputs.homeTimelineMonths || 36);
    const baseMonthly = (budget.homeDownPaymentMonthly || 0) + homeExtraSavings;
    const monthlyRate = Math.max(0, homeApy) / 100 / 12;
    const growthRate = Math.max(0, homeMonthlyGrowth) / 100;
    let balance = 0;
    const points: Array<{ month: number; balance: number; target: number }> = [];
    let reachedMonth: number | null = null;
    for (let month = 1; month <= 120; month++) {
      const contribution = baseMonthly * Math.pow(1 + growthRate, month - 1);
      balance = (balance + contribution) * (1 + monthlyRate);
      if (reachedMonth === null && target > 0 && balance >= target) reachedMonth = month;
      points.push({ month, balance, target });
    }
    return { target, timeline, baseMonthly, points, reachedMonth };
  }, [plan?.inputs.homeTarget, plan?.inputs.homeTimelineMonths, budget.homeDownPaymentMonthly, homeExtraSavings, homeApy, homeMonthlyGrowth]);

  const emergencyForecast = useMemo(() => {
    const target = plan?.inputs.emergencyFundTarget ?? 0;
    const monthly = budget.emergencyFundMonthly || 0;
    const monthlyRate = Math.max(0, emergencyApy) / 100 / 12;
    let balance = 0;
    const points: Array<{ month: number; balance: number; target: number }> = [];
    let reachedMonth: number | null = null;
    for (let month = 1; month <= 120; month++) {
      balance = (balance + monthly) * (1 + monthlyRate);
      if (reachedMonth === null && target > 0 && balance >= target) reachedMonth = month;
      points.push({ month, balance, target });
    }
    return { target, monthly, points, reachedMonth };
  }, [plan?.inputs.emergencyFundTarget, budget.emergencyFundMonthly, emergencyApy]);

  const investForecast = useMemo(() => {
    const baseMonthly =
      (flow.paycheck.k401TraditionalAnnual + flow.paycheck.k401RothAnnual) / 12 +
      budget.rothIraMonthly +
      budget.brokerageMonthly;
    const monthly = Math.max(0, baseMonthly + investMonthlyExtra);
    const monthlyRate = Math.max(0, investReturn) / 100 / 12;
    let balance = 0;
    const points: Array<{ month: number; value: number }> = [];
    for (let month = 1; month <= 120; month++) {
      balance = (balance + monthly) * (1 + monthlyRate);
      points.push({ month, value: balance });
    }
    return { baseMonthly, monthly, points };
  }, [flow.paycheck.k401TraditionalAnnual, flow.paycheck.k401RothAnnual, budget.rothIraMonthly, budget.brokerageMonthly, investMonthlyExtra, investReturn]);

  const retireForecast = useMemo(() => {
    const monthly = Math.max(
      0,
      (flow.paycheck.k401TraditionalAnnual + flow.paycheck.k401RothAnnual) / 12 +
        budget.rothIraMonthly +
        budget.brokerageMonthly
    );
    const monthlyRate = Math.max(0, retireReturn) / 100 / 12;
    let balance = 0;
    const points: Array<{ month: number; value: number; target: number }> = [];
    let hitMonth: number | null = null;
    for (let month = 1; month <= 480; month++) {
      balance = (balance + monthly) * (1 + monthlyRate);
      if (hitMonth === null && balance >= retireTarget) hitMonth = month;
      points.push({ month, value: balance, target: retireTarget });
    }
    return { monthly, points, hitMonth };
  }, [flow.paycheck.k401TraditionalAnnual, flow.paycheck.k401RothAnnual, budget.rothIraMonthly, budget.brokerageMonthly, retireTarget, retireReturn]);

  if (focus === 'home') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <Home className="size-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Home Down Payment Forecast</h1>
            <p className="text-sm text-muted-foreground">
              Goal-aware forecast using your current home savings plan with assumption toggles.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Open generic scenario forecaster</Link>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <ScenarioField label="Extra monthly savings" value={homeExtraSavings} prefix="$" onChange={setHomeExtraSavings} />
            <ScenarioField label="HYSA/APY (%)" value={homeApy} suffix="%" onChange={setHomeApy} />
            <ScenarioField label="Monthly savings growth (%)" value={homeMonthlyGrowth} suffix="%" onChange={setHomeMonthlyGrowth} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Target" value={formatCurrency(homeForecast.target)} />
          <Stat label="Current Monthly Plan" value={formatCurrency(homeForecast.baseMonthly)} />
          <Stat label="Plan Timeline Goal" value={`${homeForecast.timeline} months`} />
          <Stat label="Projected Hit Date" value={homeForecast.reachedMonth ? `${homeForecast.reachedMonth} months` : 'Not reached'} />
        </div>

        <Card className="shadow-sm">
          <CardHeader><CardTitle>Down Payment Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={homeForecast.points}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <ReferenceLine y={homeForecast.target} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (focus === 'emergency') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <Shield className="size-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Emergency Fund Forecast</h1>
            <p className="text-sm text-muted-foreground">
              Goal-aware emergency runway forecast from your current monthly contribution.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Open generic scenario forecaster</Link>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScenarioField label="Monthly contribution" value={emergencyForecast.monthly} prefix="$" onChange={() => {}} />
            <ScenarioField label="HYSA/APY (%)" value={emergencyApy} suffix="%" onChange={setEmergencyApy} />
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Target" value={formatCurrency(emergencyForecast.target)} />
          <Stat label="Monthly Contribution" value={formatCurrency(emergencyForecast.monthly)} />
          <Stat label="Projected Hit Date" value={emergencyForecast.reachedMonth ? `${emergencyForecast.reachedMonth} months` : 'Not reached'} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Emergency Fund Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={emergencyForecast.points}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <ReferenceLine y={emergencyForecast.target} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (focus === 'invest') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <DollarSign className="size-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Investment Growth Forecast</h1>
            <p className="text-sm text-muted-foreground">
              Forecast based on your synced 401(k), Roth IRA, and brokerage contribution stream.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Open generic scenario forecaster</Link>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScenarioField label="Extra monthly investing" value={investMonthlyExtra} prefix="$" onChange={setInvestMonthlyExtra} />
            <ScenarioField label="Annual return (%)" value={investReturn} suffix="%" onChange={setInvestReturn} />
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Synced Base Contribution" value={formatCurrency(investForecast.baseMonthly)} />
          <Stat label="Total Monthly Contribution" value={formatCurrency(investForecast.monthly)} />
          <Stat label="Projected 10Y Value" value={formatCurrency(investForecast.points[investForecast.points.length - 1]?.value ?? 0)} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Investment Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={investForecast.points}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (focus === 'retire') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <Timer className="size-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Retirement Timeline Forecast</h1>
            <p className="text-sm text-muted-foreground">
              Estimate when your current contribution stream reaches your retirement target.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Open generic scenario forecaster</Link>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScenarioField label="Retirement target" value={retireTarget} prefix="$" onChange={setRetireTarget} />
            <ScenarioField label="Annual return (%)" value={retireReturn} suffix="%" onChange={setRetireReturn} />
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Monthly Investment Stream" value={formatCurrency(retireForecast.monthly)} />
          <Stat label="Retirement Target" value={formatCurrency(retireTarget)} />
          <Stat label="Estimated Time to Target" value={retireForecast.hitMonth ? `${retireForecast.hitMonth} months` : 'Not reached'} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Retirement Net Worth Path</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={retireForecast.points}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <ReferenceLine y={retireTarget} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" id="tool-forecast-export">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <TrendingUp className="size-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Scenario Forecaster</h1>
            <p className="text-sm text-muted-foreground">
              Compare up to 3 financial scenarios over 10 years
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() =>
              exportDomToPdf({ elementId: 'tool-forecast-export', filenamePrefix: 'finwise-forecast' })
            }
          >
            Export PDF
          </Button>
          <ExportButton
            onExportXlsx={() => {
              const rows = buildExportRows();
              downloadXlsxFromAoa('Forecast', rows, rows[0].map((_, i) => i === 0 ? 8 : 24), 'finwise-forecast');
            }}
            onExportCsv={() => downloadCsv(buildExportRows(), 'finwise-forecast')}
          />
          {scenarios.length < 3 && (
            <Button onClick={addScenario} variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Plus className="size-4" />
              Add Scenario
            </Button>
          )}
        </div>
      </div>

      {/* Scenario cards */}
      <div
        className={`grid gap-4 ${
          scenarios.length === 1
            ? 'grid-cols-1 max-w-sm'
            : scenarios.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {scenarios.map((scenario) => {
          const year10 = results.find((r) => r.scenario.id === scenario.id)?.points[9]?.netWorth ?? 0;
          return (
            <Card key={scenario.id} className="shadow-sm">
              <CardHeader className="border-b pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ background: scenario.color }}
                  />
                  <input
                    type="text"
                    value={scenario.name}
                    onChange={(e) => updateScenario(scenario.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-semibold outline-none focus:border-b focus:border-[#3b82f6]"
                  />
                  <button
                    onClick={() => removeScenario(scenario.id)}
                    disabled={scenarios.length <= 1}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-30 transition-colors"
                    aria-label="Delete scenario"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <ScenarioField
                  label="Starting Net Worth ($)"
                  value={scenario.startingNetWorth}
                  prefix="$"
                  onChange={(v) => updateScenario(scenario.id, { startingNetWorth: v })}
                />
                <ScenarioField
                  label="Starting Salary ($/year)"
                  value={scenario.startingSalary}
                  prefix="$"
                  onChange={(v) => updateScenario(scenario.id, { startingSalary: v })}
                />
                <ScenarioField
                  label="Annual Raise (%)"
                  value={scenario.annualRaise}
                  suffix="%"
                  onChange={(v) => updateScenario(scenario.id, { annualRaise: v })}
                />
                <ScenarioField
                  label="Savings Rate (%)"
                  value={scenario.savingsRate}
                  suffix="%"
                  onChange={(v) => updateScenario(scenario.id, { savingsRate: v })}
                />
                <ScenarioField
                  label="Investment Return (%)"
                  value={scenario.investmentReturn}
                  suffix="%"
                  onChange={(v) => updateScenario(scenario.id, { investmentReturn: v })}
                />
                <div className="rounded-lg bg-muted/40 px-3 py-2 mt-2">
                  <p className="text-xs text-muted-foreground">Year 10 Net Worth</p>
                  <p
                    className="text-lg font-bold tabular-nums mt-0.5"
                    style={{ color: scenario.color }}
                  >
                    {formatCurrency(year10)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 10-Year Net Worth Projection Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>10-Year Net Worth Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="year"
                label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 12 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={yAxisFormatter}
                tick={{ fontSize: 12 }}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {scenarios.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Breakeven Analysis */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Breakeven Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {breakevens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a second scenario to see breakeven analysis.
            </p>
          ) : (
            <div className="space-y-3">
              {breakevens.map(({ a, b, year }) => (
                <div
                  key={`${a.scenario.id}-${b.scenario.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ background: a.scenario.color }}
                  />
                  <span className="font-medium text-sm">{a.scenario.name}</span>
                  <span className="text-sm text-muted-foreground">vs.</span>
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ background: b.scenario.color }}
                  />
                  <span className="font-medium text-sm">{b.scenario.name}</span>
                  <span className="ml-auto">
                    {year !== null ? (
                      <Badge variant="secondary">
                        Crossover in Year {year}
                      </Badge>
                    ) : (
                      (() => {
                        // Determine which leads at year 10
                        const aFinal = a.points[9]?.netWorth ?? 0;
                        const bFinal = b.points[9]?.netWorth ?? 0;
                        const leader = aFinal > bFinal ? a.scenario.name : b.scenario.name;
                        return (
                          <Badge variant="outline" className="text-muted-foreground">
                            {leader} leads — no crossover within 10 years
                          </Badge>
                        );
                      })()
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10-Year Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>10-Year Summary Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Year</th>
                  {scenarios.map((s) => (
                    <th
                      key={s.id}
                      className="py-2 px-3 text-right font-medium"
                      style={{ color: s.color }}
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = i + 1;
                  return (
                    <tr key={year} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium tabular-nums">{year}</td>
                      {results.map((r) => (
                        <td
                          key={r.scenario.id}
                          className="py-2 px-3 text-right tabular-nums font-medium"
                          style={{ background: CELL_BG[r.scenario.color] ?? undefined }}
                        >
                          {formatCurrency(r.points[i]?.netWorth ?? 0)}
                        </td>
                      ))}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
