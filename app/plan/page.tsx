'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Cell,
  LabelList,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Shield,
  Target,
  Zap,
  FileDown,
  RefreshCw,
  Share2,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { usePlanStore } from '@/lib/planStore';
import { computePlanMetrics } from '@/lib/planCalculations';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { PlanMetrics, WaterfallEntry, TaxSuggestion, PriorityCard } from '@/lib/planCalculations';
import type { AIInsight, PlanInputs, PlanExpenses } from '@/types/plan';
import { formatCurrency } from '@/lib/format';
import { exportDomToPdf } from '@/lib/exportPdf';
import { useFinWiseStore } from '@/lib/store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthYear(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function yAxisK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

const safeFormatCurrency = (v: unknown): string =>
  typeof v === 'number' ? formatCurrency(v) : String(v);

const PRIORITY_COLORS: Record<PriorityCard['color'], string> = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#22c55e',
  blue: '#3b82f6',
};

const WATERFALL_COLORS: Record<WaterfallEntry['type'], string> = {
  income: '#22c55e',
  deduction: '#f97316',
  tax: '#ef4444',
  expense: '#f97316',
  result: '#3b82f6',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function savingsRateColor(rate: number): string {
  if (rate >= 20) return 'text-green-600';
  if (rate >= 10) return 'text-yellow-600';
  return 'text-red-500';
}

function buildDataHash(inputs: PlanInputs): string {
  return JSON.stringify({
    salary: Math.round(inputs.annualSalary / 1000) * 1000,
    state: inputs.state,
    debtTotal: inputs.debts.reduce((s, d) => s + d.balance, 0),
    goals: [...inputs.goals].sort(),
    traditional401k: inputs.traditional401kPct,
    hsa: inputs.hsaPerPeriod,
  });
}

// ─── Empty state constants ───────────────────────────────────────────────────

const ZERO_EXPENSES: PlanExpenses = {
  housing: 0, utilities: 0, groceries: 0, dining: 0, transportation: 0,
  subscriptions: 0, phone: 0, health: 0, travel: 0, misc: 0,
};

const EMPTY_INPUTS: PlanInputs = {
  name: '', annualSalary: 0, state: 'CA', payPeriod: 'biweekly', filingStatus: 'single',
  annualBonus: 0, nycResident: false, traditional401kPct: 0, roth401kPct: 0,
  hsaPerPeriod: 0, fsaPerPeriod: 0, healthInsurancePerPeriod: 0, dentalPerPeriod: 0,
  commuterBenefitPerPeriod: 0, otherPreTaxPerPeriod: 0, expenses: ZERO_EXPENSES,
  debts: [], goals: [], emergencyFundTarget: 0, homeTarget: 0, homeTimelineMonths: 0,
};

// ─── Section animation wrapper ──────────────────────────────────────────────

function Section({
  delay,
  children,
  className = '',
}: {
  delay: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Empty section CTA ────────────────────────────────────────────────────────

function EmptySection({ title, desc, ctaLabel, ctaHref }: { title: string; desc: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <Link href={ctaHref} className="inline-flex items-center gap-1 text-sm font-medium text-[#3b82f6] hover:underline">
        {ctaLabel} <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}

// ─── Waterfall custom bar shape ──────────────────────────────────────────────

interface WaterfallBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: WaterfallEntry & { base: number };
  fill?: string;
}

function WaterfallBarShape(props: WaterfallBarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#ccc' } = props;
  if (width <= 0 || Math.abs(height) < 0.5) return null;
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} rx={2} />;
}

// ─── Waterfall chart ─────────────────────────────────────────────────────────

function WaterfallChart({ data }: { data: WaterfallEntry[] }) {
  const chartData = data.map((entry) => {
    const isNegative = entry.value < 0;
    const isResult = entry.type === 'result';
    const barStart = isResult ? 0 : isNegative ? entry.running : entry.running - entry.value;
    const barValue = isResult ? entry.running : Math.abs(entry.value);
    return {
      ...entry,
      base: barStart,
      barValue,
      color: WATERFALL_COLORS[entry.type],
      displayValue: isResult ? entry.running : entry.value,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 0 }} barSize={44}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} interval={0} />
        <YAxis tickFormatter={yAxisK} tick={{ fontSize: 11 }} width={60} />
        <Tooltip
          formatter={(v) => [safeFormatCurrency(v), '']}
          labelFormatter={(l) => String(l)}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="barValue" stackId="wf" isAnimationActive={false} radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
          <LabelList
            dataKey="displayValue"
            position="top"
            formatter={(v: unknown) =>
              typeof v === 'number' ? (Math.abs(v) >= 1000 ? yAxisK(v) : `$${Math.round(v)}`) : ''
            }
            style={{ fontSize: 10, fontWeight: 600, fill: '#374151' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Hero metric card ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueClass = '',
  icon,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold tabular-nums truncate ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-muted/50 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Priority card ────────────────────────────────────────────────────────────

function PriorityCardItem({ card }: { card: PriorityCard }) {
  const router = useRouter();
  const color = PRIORITY_COLORS[card.color];
  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden flex"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="px-4 py-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: color }}
          >
            {card.rank}
          </span>
          <span className="font-semibold text-sm leading-snug">{card.headline}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
        <button
          onClick={() => router.push(card.href)}
          className="self-start flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color }}
        >
          <ChevronRight className="size-3.5" />
          {card.action}
        </button>
      </div>
    </div>
  );
}

// ─── AI Insight card ──────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: AIInsight }) {
  const borderColor =
    insight.type === 'warning'
      ? '#f59e0b'
      : insight.type === 'success'
      ? '#22c55e'
      : '#3b82f6';
  const icon =
    insight.type === 'warning' ? (
      <AlertTriangle className="size-4 text-yellow-500 shrink-0" />
    ) : insight.type === 'success' ? (
      <CheckCircle2 className="size-4 text-green-500 shrink-0" />
    ) : (
      <Lightbulb className="size-4 text-blue-500 shrink-0" />
    );

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 flex gap-3"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {icon}
      <p className="text-sm leading-relaxed">{insight.text}</p>
    </div>
  );
}

function SkeletonInsightCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-3 animate-pulse">
      <div className="size-4 rounded-full bg-muted shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── Tax suggestion row ───────────────────────────────────────────────────────

function TaxSuggestionRow({ s }: { s: TaxSuggestion }) {
  const pct = s.maxAnnual > 0 ? Math.min(s.currentAnnual / s.maxAnnual, 1) : 0;
  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{s.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(s.currentAnnual)}/yr now → {formatCurrency(s.maxAnnual)}/yr max
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3b82f6] transition-all"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-green-600">
            +{formatCurrency(s.additionalSavings)}/yr
          </p>
          <p className="text-xs text-muted-foreground">+{s.points} pts</p>
        </div>
      </div>
    </div>
  );
}

// ─── PDF export ───────────────────────────────────────────────────────────────

async function exportPDF(setExporting: (v: boolean) => void) {
  setExporting(true);
  try {
    await exportDomToPdf({ elementId: 'financial-plan-content', filenamePrefix: 'finwise-plan' });
  } finally {
    setExporting(false);
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter();
  const plan = usePlanStore((s) => s.plan);
  const paycheckProfile = usePlanStore((s) => s.paycheckProfile);
  const debtProfile = usePlanStore((s) => s.debtProfile);
  const investProfile = usePlanStore((s) => s.investProfile);
  const planLastUpdated = usePlanStore((s) => s.planLastUpdated);
  const aiInsightsCache = usePlanStore((s) => s.aiInsightsCache);
  const setAIInsightsCache = usePlanStore((s) => s.setAIInsightsCache);
  const goals = useFinWiseStore((s) => s.goals);
  const rentVsBuyResults = useFinWiseStore((s) => s.rentVsBuyResults);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // 800ms loading splash
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (loading && timerRef.current === null) {
    timerRef.current = setTimeout(() => setLoading(false), 800);
  }

  // Build effective inputs by merging plan + profiles
  const effectiveInputs = useMemo((): PlanInputs => {
    const base: PlanInputs = plan?.inputs ?? EMPTY_INPUTS;

    const paycheckOverride = paycheckProfile ? {
      annualSalary: paycheckProfile.annualSalary,
      payPeriod: paycheckProfile.payPeriod,
      filingStatus: paycheckProfile.filingStatus,
      state: paycheckProfile.state,
      nycResident: paycheckProfile.nycResident,
      traditional401kPct: paycheckProfile.traditional401kPct,
      roth401kPct: paycheckProfile.roth401kPct,
      hsaPerPeriod: paycheckProfile.hsaPerPeriod,
      fsaPerPeriod: paycheckProfile.fsaPerPeriod,
      healthInsurancePerPeriod: paycheckProfile.healthInsurancePerPeriod,
      dentalPerPeriod: paycheckProfile.dentalPerPeriod,
      commuterBenefitPerPeriod: paycheckProfile.commuterBenefitPerPeriod,
      otherPreTaxPerPeriod: paycheckProfile.otherPostTaxPerPeriod,
    } : {};

    const debtOverride = debtProfile ? {
      debts: debtProfile.debts.map(d => ({
        id: d.id, name: d.name, debtType: 'other' as const,
        balance: d.balance, apr: d.apr, minPayment: d.minPayment,
      })),
    } : {};

    return { ...base, ...paycheckOverride, ...debtOverride };
  }, [plan, paycheckProfile, debtProfile]);

  const metrics: PlanMetrics = useMemo(
    () => computePlanMetrics(effectiveInputs),
    [effectiveInputs],
  );

  // Invest metrics: prefer investProfile simulation, else use computed
  const investMetrics = useMemo(() => {
    if (!investProfile) return null;
    return simulateInvestment({
      monthlyBuy: investProfile.monthlyBuy,
      annualBonus: investProfile.annualBonus,
      dividendYield: investProfile.dividendYield,
      taxRate: investProfile.taxRate,
      qualifiedPercent: investProfile.qualifiedPercent,
      payFrequency: investProfile.payFrequency,
      years: investProfile.years,
      annualAppreciation: investProfile.annualAppreciation,
    });
  }, [investProfile]);

  const activeInvestResult = investMetrics ?? metrics.investResult;
  const activeMonthlyInvest = investProfile?.monthlyBuy ?? metrics.monthlyInvestCapacity;

  const hasPaycheckData = effectiveInputs.annualSalary > 0;
  const hasExpenseData = Object.values(effectiveInputs.expenses).some(v => v > 0);
  const hasDebtData = effectiveInputs.debts.some(d => d.balance > 0);
  const hasAnyData = hasPaycheckData || hasDebtData;
  const hasHomeGoal = goals.includes('Save for a home');

  // generateInsights — wrapped in useCallback; does NOT depend on aiInsightsCache to avoid loops
  const generateInsights = useCallback(async () => {
    if (!hasPaycheckData || insightsLoading) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: effectiveInputs, metrics }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: AIInsight[] };
      const cache = {
        items: data.items,
        generatedAt: new Date().toISOString(),
        dataHash: buildDataHash(effectiveInputs),
      };
      setAIInsightsCache(cache);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Failed to generate insights.');
    } finally {
      setInsightsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInputs, metrics, hasPaycheckData, insightsLoading, setAIInsightsCache]);

  // Auto-generate insights once when paycheck data first appears
  const hasTriggeredInsights = useRef(false);
  useEffect(() => {
    if (!hasPaycheckData || hasTriggeredInsights.current) return;
    hasTriggeredInsights.current = true;

    const cache = aiInsightsCache;
    if (cache) {
      const ageMs = Date.now() - new Date(cache.generatedAt).getTime();
      if (ageMs < 60 * 60 * 1000) return; // less than 1 hour old — skip
    }
    generateInsights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPaycheckData]);

  // ── Loading state ──
  if (loading) {
    return (
      <AnimatePresence>
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
        >
          <div className="relative size-14">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-[#3b82f6] border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading your plan&hellip;
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── No data at all — empty state ──
  if (!hasAnyData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <Target className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Build your financial plan</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Start with your paycheck to see your take-home pay, then add debts and goals to complete your plan.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/paycheck"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563eb] transition-colors"
          >
            Set up paycheck <ChevronRight className="size-3.5" />
          </Link>
          {!plan && (
            <button
              onClick={() => router.push('/?wizard=true')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Use wizard
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main plan render ──
  const {
    monthlyTakeHome,
    monthlySurplus,
    savingsRate,
    hasDebts,
    debtFreeDate,
    debtResult,
    totalDebtBalance,
    monthlyInvestCapacity,
    taxEfficiencyScore,
    taxSuggestions,
    waterfallData,
    priorities,
    projection,
  } = metrics;

  const insightItems = aiInsightsCache?.items ?? [];
  const insightsFresh = aiInsightsCache
    ? Date.now() - new Date(aiInsightsCache.generatedAt).getTime() < 24 * 60 * 60 * 1000
    : false;
  const showInsights = insightsFresh && insightItems.length > 0;

  const potentialScoreGain = taxSuggestions.reduce((s, t) => s + t.points, 0);

  const debtSnapshots = debtResult?.snapshots.map(s => ({ date: s.date, totalBalance: s.totalBalance })) ?? [];
  const investAnnual = activeInvestResult?.annual ?? [];

  const projChartData = projection.map((p) => ({
    label: p.label,
    debtBalance: p.debtBalance,
    savingsBalance: p.savingsBalance,
    passiveIncome: Math.round(p.passiveIncome * 10),
    milestone: p.milestone,
  }));

  return (
    <div className="max-w-5xl space-y-8 print:space-y-6">
      <div id="financial-plan-content">
        {/* ── HEADER ── */}
        <Section delay={0}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#0f172a' }}>
                {plan?.inputs.name ? `${plan.inputs.name}'s` : 'Your'} Financial Plan
              </h1>
              {planLastUpdated && (
                <p className="text-sm text-muted-foreground mt-1">
                  Last updated {formatRelativeTime(planLastUpdated)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPDF(setExporting)}
                disabled={exporting}
              >
                <FileDown className="size-3.5" />
                {exporting ? 'Exporting…' : 'Export PDF'}
              </Button>
              <Button
                size="sm"
                onClick={generateInsights}
                disabled={insightsLoading}
                style={{ background: '#3b82f6' }}
              >
                <RefreshCw className={`size-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                Refresh plan
              </Button>
            </div>
          </div>

          {/* Hero metrics */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <MetricCard
              label="Monthly Take-Home"
              value={hasPaycheckData ? formatCurrency(monthlyTakeHome) : '—'}
              valueClass="text-green-600"
              icon={<DollarSign className="size-5 text-green-600" />}
            />
            <MetricCard
              label="Monthly Surplus"
              value={hasPaycheckData && hasExpenseData ? formatCurrency(monthlySurplus) : '—'}
              valueClass={monthlySurplus >= 0 ? 'text-[#3b82f6]' : 'text-red-500'}
              icon={
                monthlySurplus >= 0 ? (
                  <TrendingUp className="size-5 text-[#3b82f6]" />
                ) : (
                  <TrendingDown className="size-5 text-red-500" />
                )
              }
              sub={hasPaycheckData && hasExpenseData && monthlySurplus < 0 ? 'Spending exceeds income' : undefined}
            />
            <MetricCard
              label="Savings Rate"
              value={hasPaycheckData && hasExpenseData ? `${savingsRate.toFixed(1)}%` : '—'}
              valueClass={savingsRateColor(savingsRate)}
              icon={<Shield className="size-5 text-muted-foreground" />}
              sub={
                hasPaycheckData && hasExpenseData
                  ? savingsRate >= 20 ? 'Excellent' : savingsRate >= 10 ? 'Good — aim for 20%' : 'Below target'
                  : undefined
              }
            />
            <MetricCard
              label="Debt-Free Date"
              value={
                !hasDebtData
                  ? (hasPaycheckData ? 'No debts' : '—')
                  : hasDebts && debtFreeDate
                  ? formatMonthYear(debtFreeDate)
                  : '—'
              }
              valueClass={!hasDebtData && hasPaycheckData ? 'text-green-600' : ''}
              icon={<Calendar className="size-5 text-muted-foreground" />}
              sub={hasDebtData && debtResult ? `${debtResult.monthsToPayoff} months away` : undefined}
            />
          </div>
        </Section>

        <div className="h-px bg-border my-2" />

        {/* ── SECTION 1: Where You Stand ── */}
        <Section delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                Where You Stand
              </CardTitle>
              <CardDescription>Monthly money flow — from paycheck to surplus</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasPaycheckData ? (
                <EmptySection
                  title="No paycheck data"
                  desc="Add your salary and deductions to see your monthly money flow."
                  ctaLabel="Set up paycheck"
                  ctaHref="/paycheck"
                />
              ) : (
                <>
                  <WaterfallChart data={waterfallData} />
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {(
                      [
                        { type: 'income', label: 'Income' },
                        { type: 'deduction', label: 'Pre-Tax Deduction / Expense' },
                        { type: 'tax', label: 'Tax' },
                        { type: 'result', label: 'Result' },
                      ] as { type: WaterfallEntry['type']; label: string }[]
                    ).map(({ type, label }) => (
                      <span key={type} className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="inline-block size-3 rounded-sm"
                          style={{ background: WATERFALL_COLORS[type] }}
                        />
                        {label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 2: Priorities ── */}
        <Section delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                Your Priorities
              </CardTitle>
              <CardDescription>
                Ranked action items based on your goals and financial situation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {priorities.length === 0 ? (
                <EmptySection
                  title="No goals selected"
                  desc="Complete the onboarding wizard to set your financial goals."
                  ctaLabel="Set up your plan"
                  ctaHref="/?wizard=true"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {priorities.map((card) => (
                    <PriorityCardItem key={card.goal} card={card} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 3: Debt Plan — always render ── */}
        <Section delay={0.3}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                    Your Debt Plan
                  </CardTitle>
                  <CardDescription>Avalanche strategy: highest APR first</CardDescription>
                </div>
                <Link href="/debt" className="text-xs text-[#3b82f6] hover:underline flex items-center gap-0.5">
                  Edit debts <ChevronRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {!hasDebtData ? (
                <EmptySection
                  title="No debts added"
                  desc="Add your loans and credit cards to see your payoff timeline."
                  ctaLabel="Add your debts"
                  ctaHref="/debt"
                />
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Total Debt</p>
                      <p className="text-lg font-bold tabular-nums text-red-500">
                        {formatCurrency(totalDebtBalance)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Total Interest</p>
                      <p className="text-lg font-bold tabular-nums text-orange-500">
                        {debtResult ? formatCurrency(debtResult.totalInterestPaid) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Debt-Free</p>
                      <p className="text-lg font-bold">
                        {debtFreeDate ? formatMonthYear(debtFreeDate) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Area chart */}
                  {debtSnapshots.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Debt balance over time
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart
                          data={debtSnapshots}
                          margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval={Math.max(0, Math.floor(debtSnapshots.length / 6) - 1)}
                            tickFormatter={(d: string) => {
                              const [y, m] = d.split('-');
                              return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', {
                                month: 'short',
                                year: '2-digit',
                              });
                            }}
                          />
                          <YAxis tickFormatter={yAxisK} tick={{ fontSize: 11 }} width={56} />
                          <Tooltip
                            formatter={(v) => [safeFormatCurrency(v), 'Balance']}
                            labelFormatter={(l) => String(l)}
                          />
                          <Area
                            type="monotone"
                            dataKey="totalBalance"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="url(#debtGrad)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Interest saved */}
                  {debtResult && debtResult.interestSavedVsMinimum > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 dark:bg-green-950/20 dark:border-green-800">
                      <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        Interest saved vs. minimums only:{' '}
                        <span className="font-bold">
                          {formatCurrency(debtResult.interestSavedVsMinimum)}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Section>

        {hasHomeGoal && rentVsBuyResults && (
          <Section delay={0.35}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                  Home Purchase Analysis
                </CardTitle>
                <CardDescription>Rent vs. buy outcome integrated into your plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{rentVsBuyResults.verdictHeadline}</p>
                <p className="text-muted-foreground">
                  Break-even: {rentVsBuyResults.breakEvenYear ? `${rentVsBuyResults.breakEvenYear.toFixed(1)} years` : 'Never'}
                </p>
                <p>
                  At your timeline ({rentVsBuyResults.plannedStayResult.stayYears} years): buyer{' '}
                  <span className="font-medium">{formatCurrency(rentVsBuyResults.plannedStayResult.buyerNetWorth)}</span> vs renter{' '}
                  <span className="font-medium">{formatCurrency(rentVsBuyResults.plannedStayResult.renterNetWorth)}</span>
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <Link href="/tools/rent-vs-buy" className="text-[#3b82f6] hover:underline">
                    View full analysis →
                  </Link>
                  {rentVsBuyResults.plannedStayResult.winner === 'rent' && (
                    <Link href="/invest" className="text-[#3b82f6] hover:underline">
                      Consider redirecting your down payment savings to your investment portfolio →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </Section>
        )}

        {/* ── SECTION 4: Investment Roadmap — always render ── */}
        <Section delay={0.4}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                    Your Investment Roadmap
                  </CardTitle>
                  <CardDescription>
                    {activeMonthlyInvest > 0
                      ? `${formatCurrency(activeMonthlyInvest)}/month · ${investProfile ? 'From investment simulator' : 'From surplus'}`
                      : 'Based on your monthly surplus'}
                  </CardDescription>
                </div>
                <Link href="/invest" className="text-xs text-[#3b82f6] hover:underline flex items-center gap-0.5">
                  Configure <ChevronRight className="size-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {!hasPaycheckData ? (
                <EmptySection
                  title="Set up your paycheck first"
                  desc="Your investment capacity is calculated from your monthly surplus."
                  ctaLabel="Set up paycheck"
                  ctaHref="/paycheck"
                />
              ) : activeMonthlyInvest === 0 ? (
                <EmptySection
                  title="No investment capacity yet"
                  desc={hasDebtData ? 'Pay off high-interest debts first to free up cash for investing.' : 'Add budget expenses to calculate your surplus.'}
                  ctaLabel="Run investment simulator"
                  ctaHref="/invest"
                />
              ) : (
                <>
                  {/* Portfolio value line chart */}
                  {investAnnual.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Portfolio value over {investProfile?.years ?? 5} years
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart
                          data={investAnnual}
                          margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="year"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: number) => `Yr ${v}`}
                          />
                          <YAxis tickFormatter={yAxisK} tick={{ fontSize: 11 }} width={60} />
                          <Tooltip
                            formatter={(v) => [safeFormatCurrency(v), '']}
                            labelFormatter={(l) => `Year ${l}`}
                          />
                          <Legend
                            formatter={(v: string) =>
                              v === 'portfolioValue'
                                ? 'Portfolio Value'
                                : v === 'grossAnnualIncome'
                                ? 'Annual Income'
                                : v
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="portfolioValue"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#3b82f6' }}
                            name="portfolioValue"
                          />
                          <Line
                            type="monotone"
                            dataKey="grossAnnualIncome"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#22c55e' }}
                            name="grossAnnualIncome"
                            strokeDasharray="4 2"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Milestones table */}
                  {activeInvestResult && activeInvestResult.milestones.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Key milestones
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="py-2 pl-3 pr-4 text-left font-medium text-muted-foreground">Date</th>
                              <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Label</th>
                              <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Portfolio Value</th>
                              <th className="py-2 pr-3 text-right font-medium text-muted-foreground">Monthly Income</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeInvestResult.milestones.slice(0, 3).map((m) => (
                              <tr key={m.date + m.label} className="border-b border-border/50 last:border-0">
                                <td className="py-2 pl-3 pr-4 tabular-nums text-muted-foreground">{m.date}</td>
                                <td className="py-2 pr-4 font-medium">{m.label}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(m.portfolioValue)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums font-semibold text-green-600">
                                  {m.grossMonthlyIncome > 0 ? formatCurrency(m.grossMonthlyIncome) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 5: Tax Efficiency ── */}
        <Section delay={0.5}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                Tax Efficiency
              </CardTitle>
              <CardDescription>
                How well you&apos;re using pre-tax accounts to reduce your tax bill
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!hasPaycheckData ? (
                <EmptySection
                  title="No paycheck data"
                  desc="Add your salary and pre-tax benefits to see your tax efficiency score."
                  ctaLabel="Set up paycheck"
                  ctaHref="/paycheck"
                />
              ) : (
                <>
                  {/* Big score */}
                  <div className="flex items-center gap-6">
                    <div className="relative flex size-24 shrink-0 items-center justify-center">
                      <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
                        <circle
                          cx="50" cy="50" r="40" fill="none"
                          stroke={scoreColor(taxEfficiencyScore)}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(taxEfficiencyScore / 100) * 251.2} 251.2`}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(taxEfficiencyScore) }}>
                          {taxEfficiencyScore}
                        </span>
                        <span className="text-xs text-muted-foreground">/ 100</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {taxEfficiencyScore >= 80
                          ? 'Excellent tax efficiency'
                          : taxEfficiencyScore >= 50
                          ? 'Good, but room to improve'
                          : 'Opportunity to save more'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {taxSuggestions.length === 0
                          ? 'All pre-tax accounts are optimized.'
                          : `${taxSuggestions.length} action${taxSuggestions.length > 1 ? 's' : ''} available to reduce your tax burden.`}
                      </p>
                      {potentialScoreGain > 0 && (
                        <p className="text-xs text-[#3b82f6] font-medium mt-2">
                          If you made all changes: {taxEfficiencyScore + potentialScoreGain}/100 (+{potentialScoreGain} points)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Suggestions */}
                  {taxSuggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Actions
                      </p>
                      {taxSuggestions.map((s) => (
                        <TaxSuggestionRow key={s.label} s={s} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 6: 12-Month Projection ── */}
        <Section delay={0.6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                12-Month Projection
              </CardTitle>
              <CardDescription>
                Estimated trajectory based on your current income, expenses, and debts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!hasPaycheckData ? (
                <EmptySection
                  title="Set up your paycheck to see your projection"
                  desc="We'll model your debt payoff, savings growth, and passive income month by month."
                  ctaLabel="Set up paycheck"
                  ctaHref="/paycheck"
                />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={projChartData}
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={1}
                        angle={-30}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis tickFormatter={yAxisK} tick={{ fontSize: 11 }} width={60} />
                      <Tooltip
                        formatter={(v) => [safeFormatCurrency(typeof v === 'number' ? v : 0), '']}
                        labelFormatter={(l) => String(l)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="savingsBalance"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name="Savings"
                      />
                      {hasDebtData && (
                        <Line
                          type="monotone"
                          dataKey="debtBalance"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          name="Debt Balance"
                        />
                      )}
                      {activeMonthlyInvest > 0 && (
                        <Line
                          type="monotone"
                          dataKey="passiveIncome"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          name="Passive Income (×10)"
                          strokeDasharray="4 2"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="py-2 pl-3 pr-4 text-left font-medium text-muted-foreground">Month</th>
                          {hasDebtData && (
                            <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Debt Balance</th>
                          )}
                          <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Savings</th>
                          {activeMonthlyInvest > 0 && (
                            <th className="py-2 pr-3 text-right font-medium text-muted-foreground">Passive Income</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {projection.map((p) => (
                          <tr
                            key={p.month}
                            className={`border-b border-border/50 last:border-0 ${
                              p.milestone ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                            }`}
                          >
                            <td className="py-2 pl-3 pr-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">{p.label}</span>
                                {p.milestone && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-700 border-amber-300 dark:text-amber-400">
                                    {p.milestone}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            {hasDebtData && (
                              <td className="py-2 pr-4 text-right tabular-nums text-red-500 font-medium">
                                {p.debtBalance > 0 ? formatCurrency(p.debtBalance) : '—'}
                              </td>
                            )}
                            <td className="py-2 pr-4 text-right tabular-nums font-semibold text-[#3b82f6]">
                              {formatCurrency(p.savingsBalance)}
                            </td>
                            {activeMonthlyInvest > 0 && (
                              <td className="py-2 pr-3 text-right tabular-nums text-green-600">
                                {p.passiveIncome > 0 ? formatCurrency(p.passiveIncome) : '—'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 7: AI Insights ── */}
        <Section delay={0.7}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2" style={{ color: '#0f172a' }}>
                    <Sparkles className="size-5 text-[#3b82f6]" />
                    AI Insights
                  </CardTitle>
                  <CardDescription>
                    Powered by Claude &middot; personalized to your situation
                    {aiInsightsCache?.generatedAt && insightsFresh && (
                      <> &middot; Generated {formatRelativeTime(aiInsightsCache.generatedAt)}</>
                    )}
                  </CardDescription>
                </div>
                {showInsights && !insightsLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateInsights}
                    className="print:hidden"
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasPaycheckData ? (
                <EmptySection
                  title="Add your paycheck data to unlock AI insights"
                  desc="Claude will analyze your complete financial picture and surface personalized recommendations."
                  ctaLabel="Set up paycheck"
                  ctaHref="/paycheck"
                />
              ) : insightsLoading ? (
                <>
                  <SkeletonInsightCard />
                  <SkeletonInsightCard />
                  <SkeletonInsightCard />
                </>
              ) : showInsights ? (
                insightItems.map((insight, i) => <InsightCard key={i} insight={insight} />)
              ) : (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <Zap className="size-6 text-[#3b82f6]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Get personalized insights</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Claude will analyze your plan and surface actionable tips, warnings, and wins.
                    </p>
                  </div>
                  {insightsError && (
                    <p className="text-xs text-red-500 max-w-xs">{insightsError}</p>
                  )}
                  <Button
                    onClick={generateInsights}
                    style={{ background: '#3b82f6' }}
                    disabled={insightsLoading}
                  >
                    <Sparkles className="size-3.5" />
                    Generate Insights
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </Section>
      </div>

      {/* ── FOOTER ACTIONS ── */}
      <Section delay={0.8}>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6 print:hidden">
          <Button
            onClick={() => router.push('/?update=true')}
            style={{ background: '#0f172a' }}
          >
            <RefreshCw className="size-3.5" />
            Update My Plan
          </Button>
          <Button
            variant="outline"
            onClick={() => exportPDF(setExporting)}
            disabled={exporting}
          >
            <FileDown className="size-3.5" />
            {exporting ? 'Exporting…' : 'Export Plan'}
          </Button>
          <div className="group relative">
            <Button variant="outline" disabled>
              <Share2 className="size-3.5" />
              Share Plan
            </Button>
            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
