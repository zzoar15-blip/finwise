'use client';

import { Suspense, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { forecastScenario, findBreakeven, buildConfidenceBands } from '@/lib/calculations/forecast';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2, TrendingUp, Home, Shield, DollarSign, Timer } from 'lucide-react';
import { usePlanStore } from '@/lib/planStore';
import { useFinWiseStore } from '@/lib/store';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';

const SCENARIO_COLORS = ['#3b82f6', '#22c55e', '#f97316'] as const;
const CHART_MARGIN = { top: 8, right: 12, left: 4, bottom: 4 } as const;
const CHART_GRID = '3 3';

function yAxisFormatter(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

function monthTickFormatter(month: number): string {
  if (month <= 0) return '0';
  if (month % 12 === 0) return `Y${month / 12}`;
  return '';
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

function ForecastTooltip({
  active,
  payload,
  label,
  labelPrefix = 'Year',
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
  labelPrefix?: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm text-sm">
      <p className="mb-2 font-semibold text-slate-900">{labelPrefix} {label}</p>
      {sorted.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
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

function ForecastPageContent() {
  const searchParams = useSearchParams();
  const focus = searchParams.get('focus');
  const plan = usePlanStore((s) => s.plan);
  const budget = useFinWiseStore((s) => s.budgetInputs);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const debts = useFinWiseStore((s) => s.debts);
  const scenarios = useFinWiseStore((s) => s.forecastScenarios);
  const setScenarios = useFinWiseStore((s) => s.setForecastScenarios);
  const baselineScenarioId = useFinWiseStore((s) => s.forecastBaselineScenarioId);
  const setBaselineScenarioId = useFinWiseStore((s) => s.setForecastBaselineScenarioId);
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
  const baselineScenario = scenarios.find((s) => s.id === baselineScenarioId) ?? scenarios[0];
  const confidenceBands = useMemo(
    () => (baselineScenario ? buildConfidenceBands(baselineScenario, 10) : []),
    [baselineScenario]
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
    setScenarios(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));
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
    setScenarios([...scenarios, newScenario]);
  }

  function removeScenario(id: string) {
    if (scenarios.length <= 1) return;
    setScenarios(scenarios.filter((s) => s.id !== id));
    if (baselineScenarioId === id) {
      const fallback = scenarios.find((s) => s.id !== id);
      if (fallback) setBaselineScenarioId(fallback.id);
    }
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

  function buildExportRows(): (string | number)[][] {
    const headers = ['Year', ...results.map((r) => `${r.scenario.name} Net Worth ($)`)];
    const rows = Array.from({ length: 10 }, (_, i) => [
      i + 1,
      ...results.map((r) => Math.round((r.points[i]?.netWorth ?? 0) * 100) / 100),
    ]);
    return [
      ['Assumption', 'Value'],
      ['Baseline Scenario', baselineScenario?.name ?? 'Scenario 1'],
      ['Horizon (years)', 10],
      ['Confidence Band Model', 'P10/P50/P90 deterministic stress'],
      [],
      headers,
      ...rows,
    ];
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
              Goal-aware forecast using your current priority cash flow for home savings, with assumption toggles.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Compare in full scenario forecaster</Link>
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
          <Stat label="Priority Monthly Cash Flow" value={formatCurrency(homeForecast.baseMonthly)} />
          <Stat label="Plan Timeline Goal" value={`${homeForecast.timeline} months`} />
          <Stat label="Projected Hit Date" value={homeForecast.reachedMonth ? `${homeForecast.reachedMonth} months` : 'Not reached'} />
        </div>

        <Card className="shadow-sm">
          <CardHeader><CardTitle>Down Payment Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={homeForecast.points} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} interval={5} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip content={<ForecastTooltip labelPrefix="Month" />} />
                <ReferenceLine y={homeForecast.target} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} strokeLinecap="round" />
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
              Goal-aware emergency runway forecast from your current priority cash flow.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Compare in full scenario forecaster</Link>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Assumptions</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScenarioField label="Priority monthly cash flow" value={emergencyForecast.monthly} prefix="$" onChange={() => {}} />
            <ScenarioField label="HYSA/APY (%)" value={emergencyApy} suffix="%" onChange={setEmergencyApy} />
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Target" value={formatCurrency(emergencyForecast.target)} />
          <Stat label="Priority Monthly Cash Flow" value={formatCurrency(emergencyForecast.monthly)} />
          <Stat label="Projected Hit Date" value={emergencyForecast.reachedMonth ? `${emergencyForecast.reachedMonth} months` : 'Not reached'} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Emergency Fund Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={emergencyForecast.points} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} interval={5} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip content={<ForecastTooltip labelPrefix="Month" />} />
                <ReferenceLine y={emergencyForecast.target} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} strokeLinecap="round" />
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
              Forecast based on your synced 401(k), Roth IRA, and brokerage priority cash flow stream.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Compare in full scenario forecaster</Link>
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
          <Stat label="Synced Base Priority Flow" value={formatCurrency(investForecast.baseMonthly)} />
          <Stat label="Total Priority Monthly Flow" value={formatCurrency(investForecast.monthly)} />
          <Stat label="Projected 10Y Value" value={formatCurrency(investForecast.points[investForecast.points.length - 1]?.value ?? 0)} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Investment Trajectory</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={investForecast.points} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} interval={5} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip content={<ForecastTooltip labelPrefix="Month" />} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} strokeLinecap="round" />
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
              Estimate when your current priority cash flow stream reaches your retirement target.
            </p>
            <Link href="/forecast" className="text-sm text-blue-600 hover:underline">Compare in full scenario forecaster</Link>
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
          <Stat label="Priority Monthly Investment Flow" value={formatCurrency(retireForecast.monthly)} />
          <Stat label="Retirement Target" value={formatCurrency(retireTarget)} />
          <Stat label="Estimated Time to Target" value={retireForecast.hitMonth ? `${retireForecast.hitMonth} months` : 'Not reached'} />
        </div>
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Retirement Net Worth Path</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={retireForecast.points} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} interval={11} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yAxisFormatter} width={84} />
                <Tooltip content={<ForecastTooltip labelPrefix="Month" />} />
                <ReferenceLine y={retireTarget} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.75} dot={false} activeDot={{ r: 4 }} strokeLinecap="round" />
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
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 size-6 text-emerald-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Scenario Lab</p>
              <h1 className="mt-1 text-2xl font-semibold">Forecast Outcomes With Confidence</h1>
              <p className="mt-1 text-sm text-slate-300">
                Compare up to 3 scenarios over 10 years, then evaluate downside and upside bands before you commit.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/15 text-white hover:bg-white/15">Focus: {focus || 'net-worth'}</Badge>
            <Badge className="bg-white/15 text-white hover:bg-white/15">Horizon: 10 years</Badge>
            <Badge className="bg-white/15 text-white hover:bg-white/15">Mode: Compare</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'home', label: 'Home Goal' },
          { id: 'emergency', label: 'Emergency Fund' },
          { id: 'invest', label: 'Investing' },
          { id: 'retire', label: 'Retirement' },
          { id: 'net-worth', label: 'Net Worth' },
        ].map((item) => {
          const active =
            item.id === 'net-worth' ? !focus || focus === 'net-worth' : focus === item.id;
          return (
            <Link
              key={item.id}
              href={`/forecast?focus=${item.id}`}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          <Dialog>
            <DialogTrigger>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">Methodology</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>How scenario math works</DialogTitle>
                <DialogDescription>
                  Baseline uses your selected assumptions. Confidence bands show downside and upside paths using reduced/increased raise, savings, and return assumptions.
                </DialogDescription>
              </DialogHeader>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>P10: conservative downside path</li>
                <li>P50: baseline assumptions</li>
                <li>P90: optimistic upside path</li>
                <li>Use this to compare risk before selecting a strategy</li>
              </ul>
            </DialogContent>
          </Dialog>
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
            <Card key={scenario.id} className="border-slate-200/80 shadow-sm">
              <CardHeader className="border-b border-slate-200 pb-3">
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
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <Label className="text-xs text-muted-foreground">Use as baseline</Label>
                  <input
                    type="radio"
                    checked={baselineScenarioId === scenario.id}
                    onChange={() => setBaselineScenarioId(scenario.id)}
                  />
                </div>
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
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
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
              <Tooltip content={<ForecastTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
              {scenarios.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2.75}
                  dot={false}
                  activeDot={{ r: 4 }}
                  strokeLinecap="round"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {confidenceBands.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Confidence Bands ({baselineScenario?.name ?? 'Baseline'})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={confidenceBands} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray={CHART_GRID} className="stroke-border/80" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} width={72} />
                <Tooltip content={<ForecastTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
                <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={2.5} dot={false} name="P10 (Downside)" strokeLinecap="round" />
                <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2.75} dot={false} name="P50 (Base)" strokeLinecap="round" />
                <Line type="monotone" dataKey="p90" stroke="#22c55e" strokeWidth={2.5} dot={false} name="P90 (Upside)" strokeLinecap="round" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Assumption Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Baseline scenario: <span className="font-medium text-foreground">{baselineScenario?.name ?? 'Scenario 1'}</span></p>
          <p>Confidence bands use modified raise, savings rate, and return assumptions around baseline.</p>
          <p>P10 = downside, P50 = baseline, P90 = upside.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ForecastPage() {
  return (
    <Suspense fallback={null}>
      <ForecastPageContent />
    </Suspense>
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
