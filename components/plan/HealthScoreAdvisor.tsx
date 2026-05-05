'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Landmark,
  CreditCard,
  Shield,
  TrendingUp,
  Gift,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import {
  computePaycheck,
  getEffectivePaycheckResults,
  type StoreBudgetInputs,
  type StorePaycheckInputs,
} from '@/lib/calculations';
import type { Debt } from '@/lib/calculations/debt';
import { computeHealthScore, type ScoreBreakdown } from '@/lib/healthScore';
import {
  generateRecommendations,
  bonusAllocationWithDebtFocus,
  type Recommendation,
} from '@/lib/recommendations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function mergeSimulatedScore(
  paycheckInputs: StorePaycheckInputs,
  paycheckResults: ReturnType<typeof getEffectivePaycheckResults>,
  budgetInputs: StoreBudgetInputs,
  debts: Debt[],
  bonusProfile: ReturnType<typeof useFinWiseStore.getState>['bonusProfile'],
  active: Recommendation[],
): ScoreBreakdown {
  let pi: StorePaycheckInputs = { ...paycheckInputs };
  let bi: StoreBudgetInputs = { ...budgetInputs };
  let debtExtra = 0;
  let modeledDebt: number | undefined;

  for (const r of active) {
    if (r.simulatedChanges.paycheckInputs) {
      pi = { ...pi, ...r.simulatedChanges.paycheckInputs };
    }
    if (r.simulatedChanges.budgetInputs) {
      bi = { ...bi, ...r.simulatedChanges.budgetInputs };
    }
    debtExtra += r.simulatedChanges.debtExtraPayment ?? 0;
    if (r.simulatedChanges.modeledTotalDebt != null) {
      modeledDebt =
        modeledDebt === undefined
          ? r.simulatedChanges.modeledTotalDebt
          : Math.min(modeledDebt, r.simulatedChanges.modeledTotalDebt);
    }
  }

  const pr = pi.annualSalary > 0 ? computePaycheck(pi) : paycheckResults;
  return computeHealthScore(pr, pi, bi, debts, bonusProfile, {
    monthlyDebtExtra: debtExtra,
    modeledTotalDebt: modeledDebt,
  });
}

function CategoryIcon({ cat }: { cat: Recommendation['category'] }) {
  const cls = 'size-4 shrink-0';
  switch (cat) {
    case 'tax':
      return <Landmark className={cls} style={{ color: '#8b5cf6' }} />;
    case 'debt':
      return <CreditCard className={cls} style={{ color: '#dc2626' }} />;
    case 'emergency':
      return <Shield className={cls} style={{ color: '#d97706' }} />;
    case 'savings':
      return <TrendingUp className={cls} style={{ color: '#16a34a' }} />;
    case 'bonus':
      return <Gift className={cls} style={{ color: '#3b82f6' }} />;
    default:
      return <TrendingUp className={cls} style={{ color: '#64748b' }} />;
  }
}

function ScoreRing({
  value,
  accent,
  label,
}: {
  value: number;
  accent: 'current' | 'projected';
  label: string;
}) {
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const offset = RING_C * (1 - pct);
  const stroke = accent === 'projected' ? '#16a34a' : '#94a3b8';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={128} height={128} className="-rotate-90">
          <circle cx={64} cy={64} r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth={10} />
          <circle
            cx={64}
            cy={64}
            r={RING_R}
            fill="none"
            stroke={stroke}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-[600ms] ease-in-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'text-3xl font-bold tabular-nums transition-all duration-300',
              accent === 'projected' ? 'text-green-600' : 'text-slate-600',
            )}
          >
            {Math.round(value)}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

function ComponentRows({
  base,
  sim,
  hasSimulation,
}: {
  base: ScoreBreakdown;
  sim: ScoreBreakdown;
  hasSimulation: boolean;
}) {
  const rows: Array<{
    key: keyof Pick<
      ScoreBreakdown,
      'cashflow' | 'debt' | 'emergencyFund' | 'savingsRate' | 'taxEfficiency'
    >;
    label: string;
    color: string;
  }> = [
    { key: 'cashflow', label: 'Cashflow', color: '#3b82f6' },
    { key: 'debt', label: 'Debt', color: '#dc2626' },
    { key: 'emergencyFund', label: 'Emergency', color: '#d97706' },
    { key: 'savingsRate', label: 'Savings rate', color: '#16a34a' },
    { key: 'taxEfficiency', label: 'Tax efficiency', color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-4">
      {rows.map(({ key, label, color }) => {
        const b = base[key].score;
        const s = sim[key].score;
        const showAfter = hasSimulation && s !== b;
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700">
              <span>{label}</span>
              <span className="tabular-nums text-slate-600">
                {b}/100
                {showAfter ? (
                  <>
                    {' '}
                    <span className="text-slate-400">→</span> {s}/100
                  </>
                ) : null}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${b}%`, backgroundColor: color, opacity: 0.85 }}
                />
              </div>
              {showAfter ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${s}%`, backgroundColor: color }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const GROUP_LABELS: Record<string, { title: string; icon: ReactNode }> = {
  tax: {
    title: 'Tax optimization',
    icon: <Landmark className="size-4 text-violet-600" />,
  },
  debt: {
    title: 'Debt management',
    icon: <CreditCard className="size-4 text-red-600" />,
  },
  emergency: {
    title: 'Emergency fund',
    icon: <Shield className="size-4 text-amber-600" />,
  },
  savings: {
    title: 'Savings & investing',
    icon: <TrendingUp className="size-4 text-green-600" />,
  },
  bonus: {
    title: 'Bonus allocation',
    icon: <Gift className="size-4 text-blue-600" />,
  },
  cashflow: {
    title: 'Cashflow',
    icon: <TrendingUp className="size-4 text-slate-600" />,
  },
};

export function HealthScoreAdvisor() {
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const bonusProfile = useFinWiseStore((s) => s.bonusProfile);
  const setPaycheckInputs = useFinWiseStore((s) => s.setPaycheckInputs);
  const setBudgetInputs = useFinWiseStore((s) => s.setBudgetInputs);
  const setBonusProfile = useFinWiseStore((s) => s.setBonusProfile);
  const debtProfile = usePlanStore((s) => s.debtProfile);
  const setDebtProfile = usePlanStore((s) => s.setDebtProfile);

  const strategy = debtProfile?.strategy ?? 'avalanche';

  const effectiveDebts: Debt[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment,
      })),
    [debts],
  );

  const effectiveResults = useMemo(
    () => getEffectivePaycheckResults(paycheckInputs, paycheckResults),
    [paycheckInputs, paycheckResults],
  );

  const baseScore = useMemo(
    () =>
      computeHealthScore(
        effectiveResults,
        paycheckInputs,
        budgetInputs,
        effectiveDebts,
        bonusProfile,
      ),
    [effectiveResults, paycheckInputs, budgetInputs, effectiveDebts, bonusProfile],
  );

  const recommendations = useMemo(
    () =>
      generateRecommendations(
        baseScore,
        effectiveResults,
        paycheckInputs,
        budgetInputs,
        effectiveDebts,
        bonusProfile,
        strategy,
      ),
    [
      baseScore,
      effectiveResults,
      paycheckInputs,
      budgetInputs,
      effectiveDebts,
      bonusProfile,
      strategy,
    ],
  );

  const [activeToggles, setActiveToggles] = useState<Set<string>>(new Set());
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applySelection, setApplySelection] = useState<Record<string, boolean>>({});
  const [applyNotice, setApplyNotice] = useState<string | null>(null);

  const activeRecs = useMemo(() => {
    return recommendations.filter((r) => activeToggles.has(r.id));
  }, [recommendations, activeToggles]);

  const simScore = useMemo(
    () =>
      activeRecs.length === 0
        ? baseScore
        : mergeSimulatedScore(
            paycheckInputs,
            effectiveResults,
            budgetInputs,
            effectiveDebts,
            bonusProfile,
            activeRecs,
          ),
    [
      activeRecs,
      paycheckInputs,
      effectiveResults,
      budgetInputs,
      effectiveDebts,
      bonusProfile,
    ],
  );

  const delta = simScore.overall - baseScore.overall;

  const grouped = useMemo(() => {
    const m = new Map<string, Recommendation[]>();
    for (const r of recommendations) {
      const list = m.get(r.category) ?? [];
      list.push(r);
      m.set(r.category, list);
    }
    const order = ['tax', 'debt', 'emergency', 'savings', 'bonus', 'cashflow'];
    return order
      .filter((k) => m.has(k))
      .map((k) => ({ key: k, items: m.get(k)! }));
  }, [recommendations]);

  const toggle = useCallback((id: string) => {
    setActiveToggles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setActiveToggles(new Set()), []);

  const openApply = useCallback(() => {
    const sel: Record<string, boolean> = {};
    for (const r of activeRecs) sel[r.id] = true;
    setApplySelection(sel);
    setApplyNotice(null);
    setApplyOpen(true);
  }, [activeRecs]);

  const applySelected = useCallback(() => {
    const selected = activeRecs.filter((r) => applySelection[r.id] !== false);
    let paycheckPatch: Partial<StorePaycheckInputs> = {};
    let budgetPatch: Partial<StoreBudgetInputs> = {};
    let debtExtraSum = 0;
    let applyBonus = false;

    for (const r of selected) {
      if (r.simulatedChanges.paycheckInputs) {
        paycheckPatch = { ...paycheckPatch, ...r.simulatedChanges.paycheckInputs };
      }
      if (r.simulatedChanges.budgetInputs) {
        budgetPatch = { ...budgetPatch, ...r.simulatedChanges.budgetInputs };
      }
      if (r.simulatedChanges.debtExtraPayment) {
        debtExtraSum += r.simulatedChanges.debtExtraPayment;
      }
      if (r.id === 'allocate-bonus-to-debt') applyBonus = true;
    }

    let n = 0;
    if (Object.keys(paycheckPatch).length > 0) {
      setPaycheckInputs(paycheckPatch);
      n++;
    }
    if (Object.keys(budgetPatch).length > 0) {
      setBudgetInputs(budgetPatch);
      n++;
    }
    if (debtExtraSum > 0) {
      const baseDebts =
        debtProfile?.debts?.length ?
          debtProfile.debts
        : debts.map((d) => ({
            id: d.id,
            name: d.name,
            balance: d.balance,
            apr: d.apr,
            minPayment: d.minPayment,
          }));
      setDebtProfile({
        debts: baseDebts,
        monthlyOverpayment: (debtProfile?.monthlyOverpayment ?? 0) + debtExtraSum,
        annualBonus: debtProfile?.annualBonus ?? 0,
        bonusMonth: debtProfile?.bonusMonth ?? bonusProfile.bonusMonth,
        strategy: debtProfile?.strategy ?? strategy,
      });
      n++;
    }
    if (applyBonus) {
      setBonusProfile({
        allocations: bonusAllocationWithDebtFocus(bonusProfile.allocations),
      });
      n++;
    }

    setApplyOpen(false);
    clearAll();
    setApplyNotice(`Plan updated with ${n} change${n === 1 ? '' : 's'}. Review each tool to sync real-world accounts.`);
    setTimeout(() => setApplyNotice(null), 5000);
  }, [
    activeRecs,
    applySelection,
    bonusProfile.allocations,
    bonusProfile.bonusMonth,
    budgetInputs,
    clearAll,
    debtProfile,
    debts,
    setBonusProfile,
    setBudgetInputs,
    setDebtProfile,
    setPaycheckInputs,
    strategy,
  ]);

  const perfect = recommendations.length === 0 && baseScore.overall >= 88;

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#0f172a]">Financial Health Score</h2>
        <p className="mt-1 text-sm text-slate-600">
          Toggle recommendations to see how each action improves your score.
        </p>
      </div>

      {applyNotice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {applyNotice}
        </div>
      )}

      {perfect ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-3xl">🎉</p>
          <p className="text-lg font-semibold text-[#0f172a]">Your financial health looks excellent</p>
          <p className="max-w-md text-sm text-slate-600">
            Major optimizations are largely in place. Keep tracking cashflow and revisit when your income or goals
            change.
          </p>
          <ScoreRing value={baseScore.overall} accent="projected" label="Score" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
          <div className="w-full shrink-0 space-y-6 lg:w-[420px]">
            <ScoreRing value={baseScore.overall} accent="current" label="Your score" />
            <ComponentRows base={baseScore} sim={baseScore} hasSimulation={false} />
          </div>
          <div className="flex flex-1 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-sm text-slate-600">
            No tailored suggestions right now — try completing paycheck and budget inputs, or check back after your next pay
            update.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
          {/* Left */}
          <div className="w-full shrink-0 space-y-6 lg:w-[420px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advisor view</p>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              <ScoreRing value={baseScore.overall} accent="current" label="Current" />
              <ChevronRight className="hidden size-6 text-slate-300 sm:block" />
              <div className="flex flex-col items-center gap-1">
                <ScoreRing value={simScore.overall} accent="projected" label="With changes" />
                {activeRecs.length > 0 && (
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      delta >= 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta} pts
                  </span>
                )}
              </div>
            </div>
            <ComponentRows base={baseScore} sim={simScore} hasSimulation={activeRecs.length > 0} />
            <p className="text-xs italic text-slate-500">
              Toggle recommendations on the right to project category scores. Illustrative only — not advice.
            </p>
          </div>

          {/* Right */}
          <div className="min-w-0 flex-1 space-y-4">
            {grouped.map(({ key, items }, gi) => (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {GROUP_LABELS[key]?.icon}
                  {GROUP_LABELS[key]?.title ?? key}
                </div>
                <div className="space-y-3">
                  {items.map((rec, idx) => {
                    const isFirst = rec.id === recommendations[0]?.id;
                    const on = activeToggles.has(rec.id);
                    const expanded = expandedCard === rec.id;
                    return (
                      <div
                        key={rec.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedCard((e) => (e === rec.id ? null : rec.id))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedCard((x) => (x === rec.id ? null : rec.id));
                          }
                        }}
                        className={cn(
                          'rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-colors',
                          expanded && 'ring-1 ring-slate-300',
                        )}
                      >
                        <div className="flex items-start gap-3 p-4">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            className={cn(
                              'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
                              on ? 'bg-[#3b82f6]' : 'bg-slate-200',
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(rec.id);
                            }}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
                                on && 'translate-x-5',
                              )}
                            />
                          </button>
                          <CategoryIcon cat={rec.category} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isFirst && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                  <Zap className="size-3" /> Highest impact
                                </span>
                              )}
                              <h3 className="text-sm font-semibold text-[#0f172a]">{rec.title}</h3>
                              <span className="ml-auto shrink-0 rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                +{rec.scoreImpact.overall.toFixed(1)} pts
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{rec.description}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                Effort: {rec.effort}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                  rec.impact === 'high' && 'bg-green-100 text-green-800',
                                  rec.impact === 'medium' && 'bg-blue-100 text-blue-800',
                                  rec.impact === 'low' && 'bg-slate-100 text-slate-700',
                                )}
                              >
                                Impact: {rec.impact}
                              </span>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              'size-5 shrink-0 text-slate-400 transition-transform',
                              expanded && 'rotate-180',
                            )}
                          />
                        </div>
                        {expanded && (
                          <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-2">
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full min-w-[280px] text-sm">
                                <thead>
                                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                                    <th className="px-3 py-2 font-medium">Metric</th>
                                    <th className="px-3 py-2 font-medium">Before</th>
                                    <th className="px-3 py-2 font-medium">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rec.metrics.map((m) => (
                                    <tr key={m.label} className="border-b border-slate-50">
                                      <td className="px-3 py-2 text-slate-700">{m.label}</td>
                                      <td className="px-3 py-2 tabular-nums text-slate-600">{m.before}</td>
                                      <td className="px-3 py-2 tabular-nums">
                                        <span className="text-blue-700">{m.after}</span>
                                        <span
                                          className={cn(
                                            'ml-2 text-[11px] font-medium',
                                            m.positive ? 'text-green-600' : 'text-red-600',
                                          )}
                                        >
                                          {m.delta}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {rec.tradeoff && (
                              <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs italic text-amber-950">
                                ⚠ {rec.tradeoff}
                              </div>
                            )}
                            <Link
                              href={rec.ctaHref}
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex')}
                            >
                              {rec.ctaLabel}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {activeRecs.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-[#0f172a]">
                  {activeRecs.length} recommendation{activeRecs.length === 1 ? '' : 's'} active
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Projected score: <span className="font-semibold">{baseScore.overall}</span> →{' '}
                  <span className="font-semibold text-green-700">{simScore.overall}</span>
                  <span className="text-green-700"> ({delta >= 0 ? '+' : ''}{delta} pts)</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={openApply}>
                    Apply all to my plan
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearAll}>
                    Clear all
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply {activeRecs.length} recommendations</DialogTitle>
            <DialogDescription>
              These updates write to your FinWise plan. You still need to implement changes with your employer and
              bank.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {activeRecs.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-lg border border-slate-100 p-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[#3b82f6]"
                  checked={applySelection[r.id] ?? true}
                  onChange={(e) =>
                    setApplySelection((s) => ({ ...s, [r.id]: e.target.checked }))
                  }
                />
                <div>
                  <p className="text-sm font-medium text-[#0f172a]">{r.title}</p>
                  <p className="text-xs text-slate-500">
                    {r.category === 'tax' && 'Paycheck calculator'}
                    {r.category === 'debt' && 'Debt plan'}
                    {r.category === 'emergency' && 'Budget planner'}
                    {r.category === 'savings' && 'Budget planner'}
                    {r.category === 'bonus' && 'Bonus allocation'}
                    : {recApplySummary(r)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applySelected}>Apply selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function recApplySummary(r: Recommendation): string {
  if (r.id === 'max-hsa') return 'Increase HSA toward IRS limit';
  if (r.id === 'increase-401k') return 'Raise traditional 401(k) deferral';
  if (r.id === 'accelerate-debt') return 'Increase monthly debt overpayment in plan';
  if (r.id === 'build-emergency-fund') return 'Set emergency fund monthly transfer';
  if (r.id === 'increase-savings') return 'Increase brokerage monthly savings';
  if (r.id === 'allocate-bonus-to-debt') return 'Shift bonus allocation toward debt payoff';
  return 'Update plan inputs';
}
