'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
  Target,
  Zap,
  RefreshCw,
  Share2,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { usePlanStore } from '@/lib/planStore';
import { computePlanMetrics, mergePlanMetricsWithUnifiedBudget } from '@/lib/planCalculations';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { WaterfallEntry, TaxSuggestion, PriorityCard } from '@/lib/planCalculations';
import type { AIInsight, PlanInputs, PlanExpenses } from '@/types/plan';
import { formatCurrency } from '@/lib/format';
import { useFinWiseStore } from '@/lib/store';
import type { Debt } from '@/lib/calculations/debt';
import { calcDebtAcceleration } from '@/lib/calculations/debtAcceleration';
import { futureValueMonthlyContributions } from '@/lib/calculations/futureValueMonthly';
import type { StoreBudgetInputs } from '@/lib/calculations';
import { getEffectivePaycheckResults, getTotalTransportation } from '@/lib/calculations';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { PlanPDF } from '@/lib/pdf/PlanPDF';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ActionChecklistItem } from '@/types/plan';
import LZString from 'lz-string';

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

function formatMonthYearFromDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function findBiggestBudgetLine(b: StoreBudgetInputs): { name: string; amount: number } {
  const transport = getTotalTransportation(b);
  const pairs: [string, number][] = [
    ['Housing / rent', b.housing],
    ['Utilities', b.utilities],
    ['Insurance', b.insurance],
    ['Groceries', b.groceries],
    ['Dining out', b.dining],
    ['Transportation', transport],
    ['Subscriptions', b.subscriptions],
    ['Phone', b.phone],
    ['Health / gym', b.healthGym],
    ['Travel', b.travel],
    ['Miscellaneous', b.misc],
  ];
  return pairs.reduce<{ name: string; amount: number }>(
    (best, [name, amount]) => (amount > best.amount ? { name, amount } : best),
    { name: pairs[0][0], amount: pairs[0][1] },
  );
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

/** Health breakdown bar + ring fill (0–100 subscores and overall). */
function getHealthBarFillColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function healthOverallMessage(score: number): string {
  if (score <= 40) return 'Your finances need attention — focus on the priorities below.';
  if (score <= 60) return 'Building a foundation — a few changes make a big difference.';
  if (score <= 80) return "You're on solid ground — optimize to accelerate.";
  return 'Excellent financial health — stay the course and keep growing.';
}

function OverallHealthRing({ score }: { score: number }) {
  const color = getHealthBarFillColor(score);
  const r = 56;
  const c = 2 * Math.PI * r;
  const progress = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative mx-auto h-[140px] w-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="absolute inset-0">
        <circle cx="70" cy="70" r={r} stroke="#e2e8f0" strokeWidth={10} fill="none" />
        <circle
          cx="70"
          cy="70"
          r={r}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeDasharray={`${progress} ${c - progress}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="text-[32px] font-bold leading-none text-[#0f172a]">{score}</span>
        <span className="mt-1 text-sm text-[#94a3b8]">/ 100</span>
      </div>
    </div>
  );
}

function HealthScoreBar({ score }: { score: number }) {
  const w = Math.max(0, Math.min(100, score));
  const fill = getHealthBarFillColor(score);
  return (
    <div className="relative" style={{ marginTop: 8, marginBottom: 4 }}>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: '#e2e8f0',
          width: '100%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 8,
          borderRadius: 4,
          width: `${w}%`,
          backgroundColor: fill,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  );
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
    // Preserve selected goal order so hierarchy changes invalidate stale insights.
    goals: inputs.goals,
    traditional401k: inputs.traditional401kPct,
    hsa: inputs.hsaPerPeriod,
  });
}

// ─── Empty state constants ───────────────────────────────────────────────────

const ZERO_EXPENSES: PlanExpenses = {
  housing: 0, utilities: 0, groceries: 0, dining: 0, carPayment: 0, carInsurance: 0, gas: 0, otherTransport: 0,
  subscriptions: 0, phone: 0, health: 0, travel: 0, misc: 0,
};

const EMPTY_INPUTS: PlanInputs = {
  name: '', annualSalary: 0, state: 'CA', payPeriod: 'biweekly', filingStatus: 'single',
  annualBonus: 0, nycResident: false, traditional401kPct: 0, roth401kPct: 0,
  hsaPerPeriod: 0, fsaPerPeriod: 0, healthInsurancePerPeriod: 0, dentalPerPeriod: 0,
  commuterBenefitPerPeriod: 0, otherPreTaxPerPeriod: 0, expenses: ZERO_EXPENSES,
  debts: [], goals: [], currentEmergencyFund: 0, emergencyFundTarget: 0, homeTarget: 0, homeTimelineMonths: 0,
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
  accent = 'neutral',
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  accent?: 'green' | 'red' | 'blue' | 'neutral';
  sub?: string;
}) {
  const accentClass =
    accent === 'green'
      ? 'border-l-[#16a34a]'
      : accent === 'red'
      ? 'border-l-[#dc2626]'
      : accent === 'blue'
      ? 'border-l-[#3b82f6]'
      : 'border-l-[#3b82f6]';
  return (
    <Card className={`flex-1 min-w-0 h-full border-l-[3px] ${accentClass}`}>
      <CardContent className="pt-5 pb-5 min-h-[108px] px-6">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
            {label}
          </p>
          <p className={`text-[28px] font-bold tabular-nums leading-tight text-[#0f172a] ${valueClass}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-[#64748b] leading-snug">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthScoreRing({
  score,
  cashflow,
  debt,
  emergency,
}: {
  score: number;
  cashflow: number;
  debt: number;
  emergency: number;
}) {
  const color = getHealthBarFillColor(score);
  const r = 34;
  const c = 2 * Math.PI * r;
  const progress = (Math.max(0, Math.min(100, score)) / 100) * c;
  const pill = (label: string, value: number) => (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      {label} {value}
    </span>
  );
  return (
    <Card className="flex-1 min-w-0 h-full border-l-[3px] border-l-[#3b82f6]">
      <CardContent className="pt-5 pb-5 px-6">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={r} stroke="#e2e8f0" strokeWidth="6" fill="none" />
              <circle
                cx="40"
                cy="40"
                r={r}
                stroke={color}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${progress} ${c - progress}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-[#0f172a]">
              {score}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">Financial Health</p>
            <div className="mt-2 flex items-center gap-2">
              {pill('Cashflow', cashflow)}
              {pill('Debt', debt)}
              {pill('Emergency', emergency)}
            </div>
          </div>
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

function ActionChecklistCard({ item }: { item: ActionChecklistItem }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>
        </div>
        <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'secondary' : 'outline'}>
          {item.priority}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Estimated monthly impact: <span className="font-semibold text-foreground">{formatCurrency(item.monthlyImpact)}</span>
        </p>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger>
              <Button size="sm" variant="outline">Why</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{item.title}</DialogTitle>
                <DialogDescription>{item.rationale}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>Estimated monthly impact: <span className="font-semibold">{formatCurrency(item.monthlyImpact)}</span></p>
                <p className="text-muted-foreground">
                  This recommendation is generated from your current plan metrics (surplus, debt, savings, and selected goals).
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Link href={item.href} className="text-sm font-medium text-[#3b82f6] hover:underline">
            Do it →
          </Link>
        </div>
      </div>
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
  const setActionChecklist = usePlanStore((s) => s.setActionChecklist);
  const goals = useFinWiseStore((s) => s.goals);
  const rentVsBuyResults = useFinWiseStore((s) => s.rentVsBuyResults);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const finWiseDebts = useFinWiseStore((s) => s.debts);
  const investmentInputsStore = useFinWiseStore((s) => s.investmentInputs);

  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [whatIfExtraPay, setWhatIfExtraPay] = useState(0);
  const [debtSliderUserTouched, setDebtSliderUserTouched] = useState(false);
  const debtSliderSeededRef = useRef(false);
  const [whatIfExpenseCutPct, setWhatIfExpenseCutPct] = useState(10);
  const [whatIfInvestBoost, setWhatIfInvestBoost] = useState(150);

  // 800ms loading splash
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [loading]);

  // Build effective inputs by merging plan + profiles
  const effectiveInputs = useMemo((): PlanInputs => {
    const base: PlanInputs = plan?.inputs ?? EMPTY_INPUTS;

    const paycheckOverride = paycheckResults.isComplete
      ? (() => {
          const periodMap = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 } as const;
          const periods = periodMap[paycheckInputs.payPeriod] ?? 26;
          return {
            annualSalary: paycheckInputs.annualSalary,
            payPeriod: paycheckInputs.payPeriod,
            filingStatus: paycheckInputs.filingStatus,
            state: paycheckInputs.state,
            nycResident: paycheckInputs.nycResident,
            traditional401kPct: paycheckInputs.k401TraditionalPct,
            roth401kPct: paycheckInputs.k401RothPct,
            hsaPerPeriod: paycheckInputs.hsaAnnual / periods,
            fsaPerPeriod: paycheckInputs.fsaAnnual / periods,
            healthInsurancePerPeriod: paycheckInputs.healthInsuranceAnnual / periods,
            dentalPerPeriod: paycheckInputs.dentalAnnual / periods,
            commuterBenefitPerPeriod: paycheckInputs.commuterAnnual / periods,
            otherPreTaxPerPeriod: paycheckInputs.otherPreTaxAnnual / periods,
          };
        })()
      : paycheckProfile
        ? {
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
            // Legacy profile only persisted post-tax misc; keep fallback for backward compatibility.
            otherPreTaxPerPeriod: paycheckProfile.otherPostTaxPerPeriod,
          }
        : {};

    const debtOverride = debtProfile ? {
      debts: debtProfile.debts.map(d => ({
        id: d.id, name: d.name, debtType: 'other' as const,
        balance: d.balance, apr: d.apr, minPayment: d.minPayment,
      })),
    } : {};

    return { ...base, ...paycheckOverride, ...debtOverride };
  }, [plan, paycheckResults.isComplete, paycheckInputs, paycheckProfile, debtProfile]);

  const baseMetrics = useMemo(
    () =>
      computePlanMetrics(effectiveInputs, {
        monthlyOverpayment: debtProfile?.monthlyOverpayment ?? 0,
        annualBonus: debtProfile?.annualBonus ?? 0,
        bonusMonth: debtProfile?.bonusMonth ?? 2,
        strategy: debtProfile?.strategy ?? 'avalanche',
      }),
    [effectiveInputs, debtProfile?.monthlyOverpayment, debtProfile?.annualBonus, debtProfile?.bonusMonth, debtProfile?.strategy],
  );
  const effectivePaycheckResults = useMemo(
    () => getEffectivePaycheckResults(paycheckInputs, paycheckResults),
    [paycheckInputs, paycheckResults],
  );

  const metrics = useMemo(
    () =>
      mergePlanMetricsWithUnifiedBudget(
        baseMetrics,
        effectivePaycheckResults,
        paycheckInputs,
        budgetInputs,
        finWiseDebts,
        effectiveInputs,
        {
          monthlyOverpayment: debtProfile?.monthlyOverpayment ?? 0,
          annualBonus: debtProfile?.annualBonus ?? 0,
          bonusMonth: debtProfile?.bonusMonth ?? 2,
          strategy: debtProfile?.strategy ?? 'avalanche',
        },
      ),
    [
      baseMetrics,
      effectivePaycheckResults,
      paycheckInputs,
      budgetInputs,
      finWiseDebts,
      effectiveInputs,
      debtProfile?.monthlyOverpayment,
      debtProfile?.annualBonus,
      debtProfile?.bonusMonth,
      debtProfile?.strategy,
    ],
  );

  useEffect(() => {
    setActionChecklist(metrics.actionChecklist);
  }, [metrics.actionChecklist, setActionChecklist]);

  const whatIfDebtsForAccel = useMemo<Debt[]>(
    () =>
      finWiseDebts
        .filter((d) => (d.balance ?? 0) > 0 && (d.minPayment ?? 0) >= 0)
        .map((d) => ({
          id: d.id,
          name: d.name,
          balance: d.balance,
          apr: typeof d.apr === 'number' ? d.apr : 0,
          minPayment: Math.max(0, d.minPayment ?? 0),
        })),
    [finWiseDebts],
  );

  const debtAcceleration = useMemo(
    () => calcDebtAcceleration(whatIfDebtsForAccel, whatIfExtraPay),
    [whatIfDebtsForAccel, whatIfExtraPay],
  );

  const unifiedBudgetHeroForSeed = effectivePaycheckResults.isComplete;

  useEffect(() => {
    if (debtSliderUserTouched || debtSliderSeededRef.current) return;
    if (!(unifiedBudgetHeroForSeed || metrics.monthlySurplus > 0)) return;
    debtSliderSeededRef.current = true;
    const capped = Math.min(500, Math.max(0, metrics.monthlySurplus));
    const snapped = Math.min(2000, Math.floor(capped / 50) * 50);
    const t = window.setTimeout(() => {
      setWhatIfExtraPay(snapped);
    }, 0);
    return () => window.clearTimeout(t);
  }, [metrics.monthlySurplus, unifiedBudgetHeroForSeed, debtSliderUserTouched]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('What-if debts:', finWiseDebts);
    }
  }, [finWiseDebts]);

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
  const unifiedBudgetHero = effectivePaycheckResults.isComplete;
  /** Income / surplus cards: show synced numbers when paycheck store is filled, even if wizard expenses are blank. */
  const heroIncomeVisible = hasPaycheckData || unifiedBudgetHero;
  const heroCashflowVisible =
    unifiedBudgetHero || (hasPaycheckData && hasExpenseData);
  const hasDebtData = unifiedBudgetHero
    ? finWiseDebts.some((d) => d.balance > 0)
    : effectiveInputs.debts.some((d) => d.balance > 0);
  const hasAnyData = hasPaycheckData || hasDebtData;
  const hasHomeGoal = goals.includes('Save for a home') || goals.includes('save-home');

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
  }, [effectiveInputs, metrics, hasPaycheckData, insightsLoading, setAIInsightsCache]);

  // ── Loading state ──
  if (loading && hasAnyData) {
    return <PageSkeleton />;
  }

  // ── No data at all — empty state ──
  if (!hasAnyData) {
    return (
      <EmptyState
        icon={Target}
        title="No plan yet"
        description="Start with your paycheck and goals so FinWise can build your personalized plan."
        ctaLabel="Start onboarding"
        ctaHref="/?wizard=true"
      />
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
    effectiveTotalRate,
    taxEfficiencyScore,
    taxSuggestions,
    emergencyFundMonthsCovered,
    waterfallData,
    priorities,
    projection,
    financialHealthScore,
    healthScoreBreakdown,
    healthScoreTips,
    goalWarnings,
    actionChecklist,
  } = metrics;

  const whatIfExpenseBase = metrics.totalMonthlyExpenses;
  const whatIfExpenseCutDollars = Math.max(0, (whatIfExpenseBase * whatIfExpenseCutPct) / 100);
  const whatIfSurplusAfterExpenseTrim = monthlySurplus + whatIfExpenseCutDollars;
  const whatIfExpenseAnnualImpact = whatIfExpenseCutDollars * 12;

  const investGrowthRatePct =
    investmentInputsStore.annualAppreciation > 0 ? investmentInputsStore.annualAppreciation : 8;
  const whatIfInvestmentFv5Y = futureValueMonthlyContributions(
    whatIfInvestBoost,
    investGrowthRatePct,
    60,
  );

  const debtMinMonthlyTotal = whatIfDebtsForAccel.reduce((s, d) => s + d.minPayment, 0);
  const whatIfSurplusAfterDebtPaidOff = monthlySurplus + debtMinMonthlyTotal + whatIfExtraPay;

  const biggestBudgetExpense = findBiggestBudgetLine(budgetInputs);

  const whatIfAnnualCombined =
    whatIfExpenseCutDollars * 12 + whatIfInvestBoost * 12;

  const insightItems = aiInsightsCache?.items ?? [];
  const insightsFresh = Boolean(aiInsightsCache);
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
  const institutionalSummaryRows: Array<{ label: string; value: string }> = [
    { label: 'Monthly income', value: heroIncomeVisible ? formatCurrency(monthlyTakeHome) : '—' },
    { label: 'Living expenses', value: heroCashflowVisible ? formatCurrency(metrics.totalMonthlyExpenses) : '—' },
    { label: 'Monthly surplus', value: heroCashflowVisible ? formatCurrency(monthlySurplus) : '—' },
    { label: 'Savings rate', value: heroCashflowVisible ? `${savingsRate.toFixed(1)}%` : '—' },
    { label: 'Debt balance', value: hasDebts ? formatCurrency(totalDebtBalance) : 'No debts' },
    {
      label: 'Debt-free date',
      value: hasDebts && debtFreeDate ? formatMonthYear(debtFreeDate) : '—',
    },
    {
      label: 'Investment capacity',
      value: heroCashflowVisible ? formatCurrency(monthlyInvestCapacity) : '—',
    },
    {
      label: 'Emergency runway',
      value: heroCashflowVisible ? `${emergencyFundMonthsCovered.toFixed(1)} months` : '—',
    },
    {
      label: 'Tax efficiency score',
      value: heroIncomeVisible ? `${taxEfficiencyScore}/100` : '—',
    },
  ];
  if ((budgetInputs.carPayment ?? 0) > 0) {
    institutionalSummaryRows.splice(2, 0, {
      label: 'Transportation',
      value: `${formatCurrency(getTotalTransportation(budgetInputs))}/mo (car ${formatCurrency(budgetInputs.carPayment)} + insurance ${formatCurrency(budgetInputs.carInsurance)} + gas ${formatCurrency(budgetInputs.gas)})`,
    });
  }
  const sharePayload = {
    name: effectiveInputs.name || 'FinWise User',
    annualSalary: effectiveInputs.annualSalary,
    monthlySurplus,
    savingsRate,
    goals: effectiveInputs.goals,
    debtFreeDate,
    totalDebtBalance,
    projection: projection.slice(0, 12).map((p) => ({ label: p.label, netWorth: p.savingsBalance - p.debtBalance })),
    debts: effectiveInputs.debts.map((d, i) => ({ id: `Debt ${i + 1}`, balance: d.balance, apr: d.apr })),
  };
  const shareUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/plan/view?d=${LZString.compressToEncodedURIComponent(JSON.stringify(sharePayload))}`;
  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  const debtAccelBanner =
    whatIfExtraPay <= 0
      ? {
          className: 'border-slate-200 bg-slate-50 text-slate-600',
          label: 'Add an extra monthly payment to see payoff acceleration.',
        }
      : debtAcceleration.monthsSaved > 12
        ? {
            className: 'border-green-200 bg-green-50 text-green-800',
            label: 'Great acceleration',
          }
        : debtAcceleration.monthsSaved > 6
          ? {
              className: 'border-blue-200 bg-blue-50 text-blue-800',
              label: 'Good progress',
            }
          : debtAcceleration.monthsSaved > 0
            ? {
                className: 'border-amber-200 bg-amber-50 text-amber-900',
                label: 'Some benefit',
              }
            : {
                className: 'border-amber-100 bg-amber-50/80 text-amber-950',
                label: 'No extra months saved at this payment versus minimums alone.',
              };

  return (
    <div className="mx-auto max-w-5xl space-y-8 print:space-y-6">
      <div id="financial-plan-content">
        {/* ── HEADER ── */}
        <Section delay={0}>
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Master Plan</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {plan?.inputs.name ? `${plan.inputs.name}'s` : 'Your'} Financial Plan
                </h1>
                {planLastUpdated && (
                  <p className="mt-1 text-sm text-slate-300">
                    Last updated {formatRelativeTime(planLastUpdated)}
                  </p>
                )}
              </div>
              <div className="flex w-full items-center gap-2 print:hidden sm:w-auto">
                <PDFDownloadButton
                  className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20 sm:flex-none"
                  label="Export PDF"
                  loadingLabel="Generating PDF..."
                  document={
                    <PlanPDF
                      data={{
                        name: plan?.inputs.name,
                        annualSalary: plan?.inputs.annualSalary ?? 0,
                        monthlyTakeHome,
                        effectiveTaxRate: effectiveTotalRate,
                        monthlySurplus,
                        savingsRate,
                        totalDebt: totalDebtBalance,
                        debtFreeDate: debtFreeDate ? formatMonthYear(debtFreeDate) : null,
                        monthlyInvestment: monthlyInvestCapacity,
                        goals: goals.map((g) => String(g)),
                        priorities: priorities.map((p) => ({
                          title: p.headline,
                          description: p.body,
                          impact: p.action,
                        })),
                        debtRows: (plan?.inputs.debts ?? []).map((d) => ({
                          name: d.name,
                          balance: d.balance,
                          rate: d.apr,
                          minPayment: d.minPayment,
                        })),
                        taxEfficiencyScore,
                        taxRows: taxSuggestions.map((t) => ({
                          benefit: t.label,
                          yourContribution: t.currentAnnual,
                          max: t.maxAnnual,
                          gap: Math.max(0, t.maxAnnual - t.currentAnnual),
                          savings: t.additionalSavings,
                        })),
                        insights: insightItems.map((i) => i.text),
                      }}
                    />
                  }
                  fileName={`finwise-plan-${new Date().toISOString().slice(0, 10)}.pdf`}
                />
                <Button
                  size="sm"
                  className="flex-1 bg-white text-slate-900 hover:bg-slate-100 sm:flex-none"
                  onClick={generateInsights}
                  disabled={insightsLoading}
                >
                  <RefreshCw className={`size-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                  Refresh plan
                </Button>
              </div>
            </div>
          </div>

          {/* Hero metrics */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <HealthScoreRing
              score={financialHealthScore}
              cashflow={healthScoreBreakdown.cashflow}
              debt={healthScoreBreakdown.debt}
              emergency={healthScoreBreakdown.emergency}
            />
            <MetricCard
              label={unifiedBudgetHero ? 'Monthly income' : 'Monthly Take-Home'}
              value={heroIncomeVisible ? formatCurrency(monthlyTakeHome) : '—'}
              valueClass="text-[#0f172a]"
              accent="green"
              sub={
                unifiedBudgetHero
                  ? 'Net pay + investment income · matches Budget Planner'
                  : undefined
              }
            />
            <MetricCard
              label="Monthly Surplus"
              value={heroCashflowVisible ? formatCurrency(monthlySurplus) : '—'}
              valueClass={monthlySurplus >= 0 ? 'text-[#3b82f6]' : 'text-red-500'}
              accent={monthlySurplus >= 0 ? 'blue' : 'red'}
              sub={
                !heroCashflowVisible ? undefined
                : monthlySurplus < 0 ? 'Spending exceeds income'
                : unifiedBudgetHero ?
                  'After expenses, bank savings & debt minimums'
                : undefined
              }
            />
            <MetricCard
              label="Savings Rate"
              value={heroCashflowVisible ? `${savingsRate.toFixed(1)}%` : '—'}
              valueClass={savingsRateColor(savingsRate)}
              accent="blue"
              sub={
                !heroCashflowVisible ? undefined
                : unifiedBudgetHero ?
                  (savingsRate >= 25 ? 'Strong'
                  : savingsRate >= 15 ? 'Good — many aim for ~20%+ of gross'
                  : 'Consider increasing payroll or bank savings')
                : savingsRate >= 20 ? 'Excellent'
                : savingsRate >= 10 ? 'Good — aim for 20%'
                : 'Below target'
              }
            />
            <MetricCard
              label="Debt-Free Date"
              value={
                !hasDebts
                  ? (heroIncomeVisible ? 'No debts' : '—')
                  : debtFreeDate
                  ? formatMonthYear(debtFreeDate)
                  : '—'
              }
              valueClass={!hasDebts && heroIncomeVisible ? 'text-green-600' : ''}
              accent={hasDebts ? 'red' : 'green'}
              sub={hasDebts && debtResult ? `${debtResult.monthsToPayoff} months away` : undefined}
            />
          </div>

          <div className="mt-4 rounded-xl border border-solid border-[#e2e8f0] bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
              Health score breakdown
            </p>
            <p className="mt-2 text-base font-semibold text-[#0f172a]">
              {healthOverallMessage(financialHealthScore)}
            </p>
            <div className="mt-6 flex justify-center border-b border-[#e2e8f0] pb-6">
              <OverallHealthRing score={Math.round(financialHealthScore)} />
            </div>
            <div>
              {(
                [
                  { label: 'Cashflow', score: healthScoreBreakdown.cashflow, tip: healthScoreTips.cashflow },
                  { label: 'Debt', score: healthScoreBreakdown.debt, tip: healthScoreTips.debt },
                  { label: 'Emergency fund', score: healthScoreBreakdown.emergency, tip: healthScoreTips.emergency },
                  { label: 'Savings rate', score: healthScoreBreakdown.savings, tip: healthScoreTips.savings },
                  { label: 'Tax efficiency', score: healthScoreBreakdown.tax, tip: healthScoreTips.tax },
                ] as const
              ).map((item, idx) => {
                const s = Math.max(0, Math.min(100, Math.round(item.score)));
                const barColor = getHealthBarFillColor(s);
                return (
                  <div
                    key={item.label}
                    className={`border-[#e2e8f0] py-5 ${idx > 0 ? 'border-t border-solid' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium text-[#0f172a]">{item.label}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="text-sm font-bold" style={{ color: barColor }}>
                          {s}
                        </span>
                        <span className="text-sm font-semibold text-[#94a3b8]">/100</span>
                      </span>
                    </div>
                    <HealthScoreBar score={s} />
                    <p className="mt-1 text-xs italic leading-relaxed text-[#64748b]">{item.tip}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your next actions</p>
            <div className="mt-2 space-y-2">
              {(actionChecklist.length > 0 ? actionChecklist.slice(0, 3) : [
                { title: 'Complete paycheck setup', rationale: 'Add salary and deductions to unlock all downstream calculators.', href: '/paycheck' },
                { title: 'Set your core goals', rationale: 'Goals drive plan priorities and forecast recommendations.', href: '/?wizard=true' },
                { title: 'Connect budget assumptions', rationale: 'Budget sync ensures plan cashflow and debt projections stay accurate.', href: '/budget' },
              ]).map((item, idx) => (
                <Link key={item.title + idx} href={item.href} className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-blue-300">
                  <p className="text-sm font-semibold text-slate-900">→ {item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.rationale}</p>
                </Link>
              ))}
            </div>
          </div>

          {goalWarnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {goalWarnings.map((warning) => (
                <div key={warning.id} className={`rounded-lg border px-3 py-2 text-sm ${warning.level === 'risk' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{warning.title}</p>
                      <p className="mt-0.5">{warning.detail}</p>
                    </div>
                    <Link href={warning.href} className="shrink-0 font-medium underline underline-offset-2">Review</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plan Summary
                </p>
                <p className="text-sm text-slate-700 mt-0.5">
                  Safe-for-print snapshot used in PDF reports.
                </p>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                For informational use
              </Badge>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <p className="px-3 pt-2 text-xs text-muted-foreground">← Scroll →</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {institutionalSummaryRows.map((row) => (
                    <tr key={row.label} className="bg-white">
                      <td className="px-3 py-2 text-slate-600">{row.label}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Educational use only. Outputs are model-based estimates, not investment, tax, or legal advice.
            </p>
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
              <CardDescription>
                {unifiedBudgetHero ?
                  'Payroll withholdings are already in net pay. Outflows mirror Budget Planner (living expenses + bank transfers + debt minimums).'
                : 'Monthly money flow — from paycheck to surplus'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!heroIncomeVisible ? (
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

        <Section delay={0.25}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                Action Checklist
              </CardTitle>
              <CardDescription>
                Deterministic next steps generated from your current financial picture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionChecklist.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions yet — complete your plan inputs to generate checklist items.</p>
              ) : (
                <div className="space-y-3">
                  {actionChecklist.map((item) => (
                    <ActionChecklistCard key={item.id} item={item} />
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
              {!heroIncomeVisible ? (
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
                        <p className="px-3 pt-2 text-xs text-muted-foreground">← Scroll →</p>
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
              {!heroIncomeVisible ? (
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
              {!heroIncomeVisible ? (
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
                    <p className="px-3 pt-2 text-xs text-muted-foreground">← Scroll →</p>
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
        <Section delay={0.65}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold" style={{ color: '#0f172a' }}>
                What-If Quick Calculators
              </CardTitle>
              <CardDescription>
                Test a few high-impact adjustments before committing to a larger plan change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-border p-3 flex flex-col gap-3">
                  <p className="text-sm font-semibold">Debt acceleration</p>
                  {whatIfDebtsForAccel.length === 0 ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Add your debts to see payoff acceleration.</p>
                      <Link href="/debt" className="text-[#3b82f6] font-medium hover:underline inline-flex items-center gap-1">
                        Go to Debt
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Extra monthly payment</p>
                        <input
                          type="range"
                          min={0}
                          max={2000}
                          step={50}
                          value={whatIfExtraPay}
                          onChange={(e) => {
                            setDebtSliderUserTouched(true);
                            setWhatIfExtraPay(Number(e.target.value));
                          }}
                          className="w-full accent-[#3b82f6]"
                        />
                      </div>
                      <p className="text-lg font-bold tabular-nums" style={{ color: '#0f172a' }}>
                        {formatCurrency(whatIfExtraPay)}/mo extra
                      </p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Debt-free by</p>
                          <p className="font-semibold tabular-nums">
                            {formatMonthYearFromDate(debtAcceleration.newPayoffDate)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {debtAcceleration.monthsSaved > 0
                              ? `${debtAcceleration.monthsSaved} months sooner than minimum payments`
                              : whatIfExtraPay <= 0
                                ? 'Same as minimum-payment schedule until you add extra.'
                                : 'Same timeline as minimums at this extra amount.'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Interest saved</p>
                          <p className="font-semibold tabular-nums text-green-700">
                            {formatCurrency(debtAcceleration.interestSaved)}
                          </p>
                          <p className="text-xs text-muted-foreground">vs. paying minimums only</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">New monthly surplus after payoff</p>
                          <p className="font-semibold tabular-nums">
                            {formatCurrency(whatIfSurplusAfterDebtPaidOff)}/mo freed up starting{' '}
                            {formatMonthYearFromDate(debtAcceleration.newPayoffDate)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium ${debtAccelBanner.className}`}
                      >
                        {debtAccelBanner.label}
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-sm font-semibold">Expense optimization</p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trim total expenses by</p>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={1}
                      value={whatIfExpenseCutPct}
                      onChange={(e) => setWhatIfExpenseCutPct(Number(e.target.value))}
                      className="w-full accent-[#3b82f6]"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trim expenses by:{' '}
                    <span className="font-semibold text-foreground tabular-nums">
                      {whatIfExpenseCutPct}%
                    </span>{' '}
                    ({formatCurrency(whatIfExpenseCutDollars)}/mo saved)
                  </p>
                  <div>
                    <p className="text-xs text-muted-foreground">New monthly surplus</p>
                    <p className="text-base font-bold tabular-nums" style={{ color: '#0f172a' }}>
                      {formatCurrency(whatIfSurplusAfterExpenseTrim)}/mo
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual impact</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(whatIfExpenseAnnualImpact)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Biggest trim opportunity:{' '}
                    <span className="font-medium text-foreground">
                      {biggestBudgetExpense.name} ({formatCurrency(biggestBudgetExpense.amount)}/mo)
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-sm font-semibold">Investment contribution</p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Additional monthly invest</p>
                    <input
                      type="range"
                      min={0}
                      max={1500}
                      step={25}
                      value={whatIfInvestBoost}
                      onChange={(e) => setWhatIfInvestBoost(Number(e.target.value))}
                      className="w-full accent-[#3b82f6]"
                    />
                  </div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#0f172a' }}>
                    {formatCurrency(whatIfInvestBoost)}/mo
                  </p>
                  <div>
                    <p className="text-xs text-muted-foreground">Rough 5-year added value</p>
                    <p className="text-base font-semibold tabular-nums text-green-700">
                      {formatCurrency(whatIfInvestmentFv5Y)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      @ {investGrowthRatePct}% annual, compounded monthly (60 mo)
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Combined annual impact if applied together:{' '}
                <span className="font-semibold">{formatCurrency(whatIfAnnualCombined)}</span>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* ── SECTION 8: AI Insights ── */}
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
              {!heroIncomeVisible ? (
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
          <PDFDownloadButton
            label="Export Plan"
            loadingLabel="Generating PDF..."
            document={
              <PlanPDF
                data={{
                  name: plan?.inputs.name,
                  annualSalary: plan?.inputs.annualSalary ?? 0,
                  monthlyTakeHome,
                  effectiveTaxRate: effectiveTotalRate,
                  monthlySurplus,
                  savingsRate,
                  totalDebt: totalDebtBalance,
                  debtFreeDate: debtFreeDate ? formatMonthYear(debtFreeDate) : null,
                  monthlyInvestment: monthlyInvestCapacity,
                  goals: goals.map((g) => String(g)),
                  priorities: priorities.map((p) => ({
                    title: p.headline,
                    description: p.body,
                    impact: p.action,
                  })),
                  debtRows: (plan?.inputs.debts ?? []).map((d) => ({
                    name: d.name,
                    balance: d.balance,
                    rate: d.apr,
                    minPayment: d.minPayment,
                  })),
                  taxEfficiencyScore,
                  taxRows: taxSuggestions.map((t) => ({
                    benefit: t.label,
                    yourContribution: t.currentAnnual,
                    max: t.maxAnnual,
                    gap: Math.max(0, t.maxAnnual - t.currentAnnual),
                    savings: t.additionalSavings,
                  })),
                  insights: insightItems.map((i) => i.text),
                }}
              />
            }
            fileName={`finwise-plan-${new Date().toISOString().slice(0, 10)}.pdf`}
          />
          <Dialog>
            <DialogTrigger>
              <Button variant="outline">
                <Share2 className="size-3.5" />
                Share Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share your financial plan</DialogTitle>
                <DialogDescription>
                  Anyone with this link can view your plan. No account information is shared.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <input readOnly className="w-full rounded-md border px-3 py-2 text-sm" value={shareUrl} />
                <Button onClick={copyShareLink}>{shareCopied ? 'Copied ✓' : 'Copy link'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Section>
    </div>
  );
}
