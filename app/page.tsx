'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calculator,
  PieChart,
  CreditCard,
  TrendingUp,
  BarChart3,
  Wallet,
  HousePlus,
  ArrowRight,
  Plus,
  Home,
  CarFront,
  PiggyBank,
  Target,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { usePlanStore } from '@/lib/planStore';
import { useFinanceStore, useFinWiseStore } from '@/lib/store';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';
import { computePlanMetrics } from '@/lib/planCalculations';
import { PAY_PERIODS } from '@/lib/calculations/paycheck';
import { formatCurrency, formatDate } from '@/lib/format';
import { CATEGORY_ICONS } from '@/lib/constants';
import type { PlanInputs } from '@/types/plan';
import type { BonusProfile } from '@/lib/bonusProfile';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function savingsRateColor(rate: number): string {
  if (rate >= 20) return 'text-green-600';
  if (rate >= 10) return 'text-amber-600';
  return 'text-red-600';
}

function InstitutionalDisclosurePanel({
  onDismiss,
  onAccept,
}: {
  onDismiss: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 sm:p-8">
      <div className="mx-auto max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 border-b bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">The &quot;Institutional Grade&quot; Disclosure</h2>
          <p className="mt-1 text-sm font-semibold text-gray-700">DISCLOSURES AND TERMS OF USE</p>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-gray-700">
          <p>
            <span className="font-semibold">Educational Purpose Only:</span> This wealth comparison model (the
            &quot;Tool&quot;) is provided by FinWise for informational and illustrative purposes only. The output is
            generated based on user-provided assumptions and is not intended to serve as, and should not be relied upon
            as, investment, tax, legal, or financial advice.
          </p>
          <p>
            <span className="font-semibold">Model Assumptions &amp; Projections:</span> All calculations are hypothetical
            and based on mathematical models. Projections regarding home appreciation, investment returns, and tax implications
            are based on historical averages and current statutory rates which are subject to change. Past performance is not
            indicative of future results. Actual market conditions and financial outcomes may differ significantly from the
            estimates provided by this Tool.
          </p>
          <p>
            <span className="font-semibold">No Fiduciary Relationship:</span> Use of this Tool does not create a fiduciary,
            advisory, or professional relationship. FinWise is not a registered investment advisor, broker-dealer, or tax
            professional.
          </p>
          <p>
            <span className="font-semibold">Risk Disclosure:</span> All financial decisions involve risk, including the
            possible loss of principal. Real estate and equity markets are volatile; home ownership involves significant
            non-recoverable costs (maintenance, taxes, interest, and transaction fees) that may outweigh potential gains.
          </p>
          <p>
            <span className="font-semibold">Tax &amp; Legal Consultation:</span> Tax benefits, including mortgage interest
            deductions, are subject to individual eligibility and complex IRS regulations. Users are strongly encouraged to
            consult with a qualified tax professional or financial advisor before making any significant financial
            commitments.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={onDismiss}>
            Not now
          </Button>
          <Button onClick={onAccept} className="bg-[#3b82f6] hover:bg-[#2563eb]">
            I Understand &amp; Agree
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Static data ────────────────────────────────────────────────────────────

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
    title: 'Debt Simulator',
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
  {
    href: '/tools/rent-vs-buy',
    icon: Home,
    title: 'Rent vs. Buy',
    description: 'Compare the true financial cost of buying vs renting over any time horizon. Includes break-even analysis, opportunity cost, and sensitivity modeling.',
  },
  {
    href: '/tools/net-worth',
    icon: Wallet,
    title: 'Net Worth',
    description: 'Track assets and liabilities over time with monthly snapshots and trend view.',
  },
  {
    href: '/tools/housing-affordability',
    icon: HousePlus,
    title: 'Affordability',
    description: 'See realistic rent and mortgage limits based on your full budget, debts, and savings behavior.',
  },
  {
    href: '/tools/car-affordability',
    icon: CarFront,
    title: 'Car Calculator',
    description: 'Compare loan vs lease affordability with insurance, fuel, and maintenance built in.',
  },
  {
    href: '/tools/sinking-fund',
    icon: PiggyBank,
    title: 'Sinking Fund',
    description: 'Plan monthly saving targets for goals like vacations, weddings, or a home down payment.',
  },
];

const FEATURE_CARDS = [
  {
    icon: BarChart3,
    iconColor: 'text-[#3b82f6]',
    iconBg: 'bg-blue-50',
    title: 'Clear financial snapshot',
    description: 'See exactly where your money goes',
  },
  {
    icon: Target,
    iconColor: 'text-[#16a34a]',
    iconBg: 'bg-green-50',
    title: 'Personalized priorities',
    description: 'Goal-based action cards tailored to you',
  },
  {
    icon: Sparkles,
    iconColor: 'text-[#8b5cf6]',
    iconBg: 'bg-violet-50',
    title: 'AI-powered insights',
    description: 'Claude analyzes your situation and surfaces what matters',
  },
];

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wizardOpen = searchParams.get('wizard') === 'true';

  const { plan, settings, setPlan, updateSettings, actionChecklist } = usePlanStore();
  const debtProfile = usePlanStore((s) => s.debtProfile);
  const transactions = useFinanceStore((s) => s.transactions);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const setPaycheckInputs = useFinWiseStore((s) => s.setPaycheckInputs);
  const setBudgetInputs = useFinWiseStore((s) => s.setBudgetInputs);
  const setDebts = useFinWiseStore((s) => s.setDebts);
  const setGoals = useFinWiseStore((s) => s.setGoals);
  const setBonusProfile = useFinWiseStore((s) => s.setBonusProfile);
  const bonusProfileStore = useFinWiseStore((s) => s.bonusProfile);

  const [showWizard, setShowWizard] = useState(
    (wizardOpen || (!plan && settings.acceptedInstitutionalDisclosure)) && settings.acceptedInstitutionalDisclosure,
  );
  const [showDisclosure, setShowDisclosure] = useState(
    wizardOpen && !settings.acceptedInstitutionalDisclosure,
  );

  const effectivePlanInputs = (() => {
    if (!plan) return null;
    if (debtProfile?.debts?.length) {
      return {
        ...plan.inputs,
        debts: debtProfile.debts.map((d) => ({
          id: d.id,
          name: d.name,
          debtType: 'other' as const,
          balance: d.balance,
          apr: d.apr,
          minPayment: d.minPayment,
        })),
      };
    }
    if (debts.length > 0) {
      return {
        ...plan.inputs,
        debts: debts.map((d) => ({
          id: d.id,
          name: d.name,
          debtType: 'other' as const,
          balance: d.balance,
          apr: d.apr,
          minPayment: d.minPayment,
        })),
      };
    }
    return plan.inputs;
  })();

  const metrics = useMemo(
    () =>
      effectivePlanInputs
        ? computePlanMetrics(effectivePlanInputs, {
          monthlyOverpayment: debtProfile?.monthlyOverpayment ?? 0,
          annualBonus: debtProfile?.annualBonus ?? 0,
          bonusMonth: debtProfile?.bonusMonth ?? 2,
          strategy: debtProfile?.strategy ?? 'avalanche',
        })
        : null,
    [effectivePlanInputs, debtProfile?.monthlyOverpayment, debtProfile?.annualBonus, debtProfile?.bonusMonth, debtProfile?.strategy],
  );

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budgetInputs, debts),
    [paycheckInputs, paycheckResults, budgetInputs, debts],
  );
  const effectivePaycheckResults = flow.paycheck;
  const unifiedSurplus = effectivePaycheckResults.isComplete ? flow.monthlySurplus : null;
  const unifiedSavingsRate = effectivePaycheckResults.isComplete ? flow.savingsRate : null;

  useEffect(() => {
    if (!wizardOpen) return;
    router.replace('/', { scroll: false });
  }, [wizardOpen, router]);

  const handleAcceptDisclosure = useCallback(() => {
    updateSettings({ acceptedInstitutionalDisclosure: true });
    setShowDisclosure(false);
    setShowWizard(true);
  }, [updateSettings]);

  function handleUpdatePlan(inputs: PlanInputs, bonusProfilePatch?: Partial<BonusProfile>) {
    const periods = PAY_PERIODS[inputs.payPeriod] || 26;
    const homeGoalMonthly =
      inputs.goals.includes('save-home') && inputs.homeTarget > 0
        ? Math.ceil(inputs.homeTarget / Math.max(1, inputs.homeTimelineMonths || 36))
        : 0;
    const emergencyGoalMonthly =
      inputs.goals.includes('emergency-fund') && inputs.emergencyFundTarget > 0
        ? Math.ceil(inputs.emergencyFundTarget / 12)
        : 0;
    // Keep Plan and calculator stores synchronized so metrics match across pages.
    setPaycheckInputs({
      annualSalary: inputs.annualSalary,
      state: inputs.state,
      filingStatus: inputs.filingStatus,
      payPeriod: inputs.payPeriod,
      nycResident: inputs.nycResident,
      k401TraditionalPct: inputs.traditional401kPct,
      k401RothPct: inputs.roth401kPct,
      hsaAnnual: inputs.hsaPerPeriod * periods,
      fsaAnnual: inputs.fsaPerPeriod * periods,
      healthInsuranceAnnual: inputs.healthInsurancePerPeriod * periods,
      dentalAnnual: inputs.dentalPerPeriod * periods,
      visionAnnual: 0,
      commuterAnnual: inputs.commuterBenefitPerPeriod * periods,
      otherPreTaxAnnual: inputs.otherPreTaxPerPeriod * periods,
      otherPostTaxAnnual: 0,
      additionalWithholding: 0,
    });
    setBudgetInputs({
      housing: inputs.expenses.housing,
      utilities: inputs.expenses.utilities,
      insurance: 0,
      groceries: inputs.expenses.groceries,
      dining: inputs.expenses.dining,
      carPayment: inputs.expenses.carPayment,
      carInsurance: inputs.expenses.carInsurance,
      gas: inputs.expenses.gas,
      parking: 0,
      publicTransit: 0,
      otherTransport: inputs.expenses.otherTransport,
      subscriptions: inputs.expenses.subscriptions,
      phone: inputs.expenses.phone,
      healthGym: inputs.expenses.health,
      travel: inputs.expenses.travel,
      misc: inputs.expenses.misc,
      emergencyFundMonthly: emergencyGoalMonthly,
      emergencyFundBalance: inputs.currentEmergencyFund,
      homeDownPaymentMonthly: homeGoalMonthly,
    });
    setDebts(
      inputs.debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment,
      })),
    );
    setGoals(inputs.goals as string[]);
    setPlan(inputs);
    if (bonusProfilePatch) {
      setBonusProfile(bonusProfilePatch);
    }
    setShowWizard(false);
  }

  function handleStartPlanning() {
    if (settings.acceptedInstitutionalDisclosure) {
      setShowWizard(true);
      return;
    }
    setShowDisclosure(true);
  }

  function openPlanWizardOrDisclosure() {
    if (settings.acceptedInstitutionalDisclosure) setShowWizard(true);
    else setShowDisclosure(true);
  }

  const disclosureModal = showDisclosure ? (
    <InstitutionalDisclosurePanel
      onDismiss={() => setShowDisclosure(false)}
      onAccept={handleAcceptDisclosure}
    />
  ) : null;

  // ── State A: no plan ─────────────────────────────────────────────────────
  if (!plan) {
    return (
      <>
        {disclosureModal}
        {showWizard && (
          <div className="fixed inset-0 z-50 overflow-auto bg-white">
            <OnboardingWizard onComplete={handleUpdatePlan} />
          </div>
        )}

        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3b82f6] shadow-lg">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              FinWise
            </h1>
            <p className="mt-3 text-lg font-medium text-gray-600">
              Your personal financial planning tool
            </p>
            <p className="mt-2 text-base text-gray-400">
              Build a clear, actionable financial plan in 5 minutes
            </p>
            <Button
              size="lg"
              className="mt-8 gap-2 px-8 text-base"
              onClick={handleStartPlanning}
            >
              Build My Financial Plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {FEATURE_CARDS.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${f.iconBg}`}>
                  <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                </span>
                <p className="mt-3 text-sm font-semibold text-gray-800">{f.title}</p>
                <p className="mt-1 text-xs text-gray-500 leading-snug">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── State B: plan exists ──────────────────────────────────────────────────
  const name = settings.displayName || plan.inputs.name;
  const surplus = unifiedSurplus ?? metrics?.monthlySurplus ?? 0;
  const savingsRate = unifiedSavingsRate ?? metrics?.savingsRate ?? 0;
  const takeHome =
    effectivePaycheckResults.isComplete ?
      effectivePaycheckResults.netPayMonthly
    : metrics?.monthlyTakeHome ?? 0;
  const debtFreeDate = metrics?.debtFreeDate;

  return (
    <>
      {disclosureModal}
      {showWizard && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white">
          <OnboardingWizard
            initialValues={plan.inputs}
            onComplete={handleUpdatePlan}
          />
        </div>
      )}

      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Financial Command Center</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {name ? `${name}, your money game plan` : 'Your money game plan'}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Last updated {timeAgo(plan.updatedAt)}. Review your runway, tackle priorities, and model outcomes.
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Link
                href="/plan"
                className="inline-flex flex-1 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors sm:flex-none"
              >
                Open Full Plan
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
              <Button
                variant="outline"
                className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20 sm:flex-none"
                onClick={openPlanWizardOrDisclosure}
              >
                Update Inputs
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="h-full border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Monthly Take-Home
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[72px] flex-col justify-between">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(takeHome)}</p>
              {effectivePaycheckResults.isComplete && (
                <p className="text-[10px] text-muted-foreground mt-1">Net pay from Paycheck Calculator</p>
              )}
            </CardContent>
          </Card>

          <Card className="h-full border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Monthly Surplus
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[72px] flex-col justify-between">
              <p
                className={`text-2xl font-bold ${
                  surplus >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(surplus)}
              </p>
              {unifiedSurplus != null && (
                <p className="text-[10px] text-muted-foreground mt-1">Aligned with Budget Planner cash flow</p>
              )}
            </CardContent>
          </Card>

          <Card className="h-full border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Savings Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[72px] flex-col justify-between">
              <p className={`text-2xl font-bold ${savingsRateColor(savingsRate)}`}>
                {savingsRate.toFixed(1)}%
              </p>
              {unifiedSavingsRate != null && (
                <p className="text-[10px] text-muted-foreground mt-1">% of gross (payroll + bank savings)</p>
              )}
            </CardContent>
          </Card>

          <Card className="h-full border-slate-200/80 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Debt-Free Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-[72px] items-center">
              {debtFreeDate ? (
                <p className="text-xl font-bold text-gray-900">{debtFreeDate}</p>
              ) : (
                <p className="text-xl font-bold text-green-600">Debt free! ✓</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Guided Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/plan" className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Lock priorities</p>
                <p className="mt-1 text-xs text-slate-600">Confirm goal order and monthly allocation strategy.</p>
              </Link>
              <Link href="/budget" className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Fund your plan</p>
                <p className="mt-1 text-xs text-slate-600">Apply suggested budget amounts and tune surplus.</p>
              </Link>
              <Link href="/forecast" className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Stress test scenarios</p>
                <p className="mt-1 text-xs text-slate-600">Compare baseline vs downside/upside before committing.</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {(() => {
          const expectsBonus =
            (plan?.inputs.annualBonus ?? 0) > 0 || bonusProfileStore.annualBonusAmount > 0;
          const bonusAllocationDone =
            !expectsBonus || bonusProfileStore.annualBonusAmount > 0;
          const checks = [
            { label: 'Paycheck configured', done: !!effectivePaycheckResults.isComplete, href: '/paycheck' },
            { label: 'Budget set up', done: Object.values(budgetInputs).some((v) => typeof v === 'number' && v > 0), href: '/budget' },
            { label: 'Bonus allocation', done: bonusAllocationDone, href: '/settings/bonus' },
            { label: 'Debts added', done: debts.length > 0, href: '/debt' },
            { label: 'Investment goals set', done: budgetInputs.brokerageMonthly > 0 || budgetInputs.rothIraMonthly > 0, href: '/invest' },
            { label: 'Goals selected', done: (plan?.inputs.goals?.length ?? 0) > 0, href: '/plan' },
          ];
          const completed = checks.filter((c) => c.done).length;
          if (completed === checks.length) return null;
          return (
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle>Complete your plan setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(completed / checks.length) * 100}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {completed} of {checks.length} complete ({Math.round((completed / checks.length) * 100)}%)
                </p>
                <div className="space-y-1">
                  {checks.map((c) =>
                    c.done ? (
                      <div key={c.label} className="text-sm text-gray-500 line-through">✓ {c.label}</div>
                    ) : (
                      <Link key={c.label} href={c.href} className="block text-sm font-medium text-slate-900 hover:text-blue-600">→ {c.label}</Link>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Financial Workspace</h2>
          <p className="mb-4 text-sm text-gray-500">Jump to each module with synced assumptions across plan, budget, and forecasting.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-9">
            {QUICK_LINKS.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href} className="group block">
                <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-[#3b82f6] group-hover:shadow-md">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#3b82f6]">
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

        {actionChecklist.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Top Action Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionChecklist.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.rationale}</p>
                    </div>
                    <Link href={item.href} className="text-xs font-medium text-blue-600 hover:underline">
                      Open →
                    </Link>
                  </div>
                ))}
                <Link href="/plan" className="inline-flex text-sm font-medium text-blue-600 hover:underline">
                  See full checklist in your plan →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Recent Transactions</CardTitle>
              <Link
                href="/transactions"
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Transaction
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No transactions yet"
                description="Add your first transaction to start tracking spending and income trends."
                ctaLabel="Add transaction"
                ctaHref="/transactions"
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base">
                      {CATEGORY_ICONS[t.category]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {t.description}
                      </p>
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
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}
