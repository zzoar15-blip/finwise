'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ChevronLeft, PiggyBank, Calendar, Target, Wallet } from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import type { SinkingFundGoalType } from '@/lib/calculations/sinkingFund';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv, downloadXlsxFromAoa } from '@/lib/export';
import { exportDomToPdf } from '@/lib/exportPdf';
import { SyncMeta } from '@/components/SyncMeta';

const PRESETS: Array<{
  type: SinkingFundGoalType;
  label: string;
  targetAmount: number;
  months: number;
  annualYieldPct: number;
}> = [
  { type: 'vacation', label: 'Vacation', targetAmount: 6000, months: 12, annualYieldPct: 4 },
  { type: 'down-payment', label: 'House Down Payment', targetAmount: 50000, months: 36, annualYieldPct: 4.5 },
  { type: 'custom', label: 'Custom Goal', targetAmount: 10000, months: 18, annualYieldPct: 4 },
];

function addMonths(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsToLabel(months: number | null): string {
  if (months === null) return 'Not reached';
  if (months === 0) return 'Already funded';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} years` : `${years}y ${rem}m`;
}

export default function SinkingFundPage() {
  const inputs = useFinWiseStore((s) => s.sinkingFundInputs);
  const results = useFinWiseStore((s) => s.sinkingFundResults);
  const setInputs = useFinWiseStore((s) => s.setSinkingFundInputs);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const plan = usePlanStore((s) => s.plan);

  useEffect(() => {
    if (inputs.goalType !== 'down-payment') return;
    if (!plan?.inputs.homeTarget || plan.inputs.homeTarget <= 0) return;
    const timelineMonths = Math.max(1, plan.inputs.homeTimelineMonths || 36);
    const syncedTargetDate = addMonths(currentYm(), timelineMonths);
    if (inputs.targetAmount === plan.inputs.homeTarget && inputs.targetDate === syncedTargetDate) return;
    setInputs({
      targetAmount: plan.inputs.homeTarget,
      targetDate: syncedTargetDate,
      goalName: 'House Down Payment',
    });
  }, [inputs.goalType, inputs.targetAmount, inputs.targetDate, plan?.inputs.homeTarget, plan?.inputs.homeTimelineMonths, setInputs]);

  const chartData = useMemo(
    () =>
      results.schedule
        .filter((p) => p.month === 1 || p.month % 3 === 0 || p.month === results.schedule.length)
        .map((p) => ({
          month: p.month,
          balance: p.balance,
          target: inputs.targetAmount,
        })),
    [results.schedule, inputs.targetAmount],
  );

  const rows = useMemo<(string | number)[][]>(
    () => [
      ['Month', 'Date', 'Contribution', 'Interest', 'Balance', 'Progress %'],
      ...results.schedule.map((s) => [s.month, s.date, s.contribution, s.interest, s.balance, s.progressPct]),
    ],
    [results.schedule],
  );

  function applyPreset(type: SinkingFundGoalType) {
    const preset = PRESETS.find((p) => p.type === type);
    if (!preset) return;
    const date = addMonths(currentYm(), preset.months);
    setInputs({
      goalType: preset.type,
      goalName: preset.label,
      targetAmount: preset.targetAmount,
      annualYieldPct: preset.annualYieldPct,
      currentSavings: 0,
      targetDate: date,
      mode: 'target-date',
    });
  }

  return (
    <div id="sinking-fund-content" className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3" /> Tools
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <PiggyBank className="size-6 text-[#3b82f6] mt-0.5" />
            <div>
              <h1 className="text-2xl font-bold">Sinking Fund Planner</h1>
              <SyncMeta updatedAt={planLastUpdated} badges={['Unified Flow']} />
              <p className="text-sm text-muted-foreground">
                Plan purchases like vacations or a home down payment with a dedicated monthly funding path.
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => exportDomToPdf({ elementId: 'sinking-fund-content', filenamePrefix: 'finwise-sinking-fund' })}
            >
              Export PDF
            </Button>
            <ExportButton
              onExportCsv={() => downloadCsv(rows, 'finwise-sinking-fund')}
              onExportXlsx={() =>
                downloadXlsxFromAoa(
                  'Sinking Fund',
                  rows,
                  [8, 10, 14, 12, 14, 10],
                  'finwise-sinking-fund',
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goal Presets</p>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  onClick={() => applyPreset(preset.type)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    inputs.goalType === preset.type
                      ? 'border-[#3b82f6] bg-blue-50 text-blue-900'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(preset.targetAmount)} in {preset.months} months
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funding Inputs</p>
            <Field label="Goal name" value={inputs.goalName} onText={(v) => setInputs({ goalName: v })} />
            <Field label="Target amount" value={inputs.targetAmount} prefix="$" min={0} step={100} onValue={(n) => setInputs({ targetAmount: n })} />
            <Field label="Current savings" value={inputs.currentSavings} prefix="$" min={0} step={100} onValue={(n) => setInputs({ currentSavings: n })} />
            <Field label="Expected APY" value={inputs.annualYieldPct} suffix="%" min={0} max={12} step={0.1} onValue={(n) => setInputs({ annualYieldPct: n })} />

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
              <button
                onClick={() => setInputs({ mode: 'target-date' })}
                className={`rounded-md px-2 py-1.5 text-xs font-medium ${inputs.mode === 'target-date' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
              >
                Target Date
              </button>
              <button
                onClick={() => setInputs({ mode: 'monthly-contribution' })}
                className={`rounded-md px-2 py-1.5 text-xs font-medium ${inputs.mode === 'monthly-contribution' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
              >
                Monthly Amount
              </button>
            </div>

            {inputs.mode === 'target-date' ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Target date</label>
                <input
                  type="month"
                  className="w-full rounded-md border px-2 py-1.5 text-sm"
                  value={inputs.targetDate}
                  onChange={(e) => setInputs({ targetDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Required monthly contribution: <span className="font-semibold text-foreground">{formatCurrency(results.requiredMonthlyContribution)}</span>
                </p>
              </div>
            ) : (
              <Field
                label="Monthly contribution"
                value={inputs.monthlyContribution}
                prefix="$"
                min={0}
                step={25}
                onValue={(n) => setInputs({ monthlyContribution: n })}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Target className="size-4 text-blue-600" />} label="Target Amount" value={formatCurrency(inputs.targetAmount)} />
            <StatCard icon={<Wallet className="size-4 text-green-600" />} label="Current Saved" value={formatCurrency(inputs.currentSavings)} />
            <StatCard icon={<Calendar className="size-4 text-amber-600" />} label="Time to Goal" value={monthsToLabel(results.monthsToGoal)} />
            <StatCard icon={<PiggyBank className="size-4 text-purple-600" />} label="Projected Interest" value={formatCurrency(results.totalInterest)} />
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold mb-2">Funding Trajectory</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={yTick} tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : String(v))} />
                <ReferenceLine y={inputs.targetAmount} stroke="#ef4444" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="balance" name="Fund balance" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Mode" value={inputs.mode === 'target-date' ? 'Target date' : 'Monthly contribution'} />
              <Row label="Projected completion" value={results.projectedCompletionDate ?? 'Not reached'} />
              <Row label="Total contributions" value={formatCurrency(results.totalContributions)} />
              <Row label="Final balance" value={formatCurrency(results.finalBalance)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function yTick(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

function Field({
  label,
  value,
  onValue,
  onText,
  prefix,
  suffix,
  min,
  max,
  step,
}: {
  label: string;
  value: number | string;
  onValue?: (n: number) => void;
  onText?: (v: string) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          className="w-full rounded-md border px-2 py-1.5 text-sm"
          type={onValue ? 'number' : 'text'}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            if (onValue) onValue(Number(e.target.value));
            if (onText) onText(e.target.value);
          }}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold mt-1 tabular-nums">{value}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-1.5">{icon}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
