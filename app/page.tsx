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
  ArrowRight,
  Plus,
  Home,
  PiggyBank,
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
    href: '/tools/sinking-fund',
    icon: PiggyBank,
    title: 'Sinking Fund',
    description: 'Plan monthly saving targets for goals like vacations, weddings, or a home down payment.',
  },
];

const FEATURE_CARDS = [
  {
    emoji: '📊',
    title: 'Clear financial snapshot',
    description: 'See exactly where your money goes',
  },
  {
    emoji: '🎯',
    title: 'Personalized priorities',
    description: 'Goal-based action cards tailored to you',
  },
  {
    emoji: '🤖',
    title: 'AI-powered insights',
    description: 'Claude analyzes your situation and surfaces what matters',
  },
];

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wizardOpen = searchParams.get('wizard') === 'true';

  const { plan, settings, setPlan, updateSettings } = usePlanStore();
  const transactions = useFinanceStore((s) => s.transactions);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const setPaycheckInputs = useFinWiseStore((s) => s.setPaycheckInputs);
  const setBudgetInputs = useFinWiseStore((s) => s.setBudgetInputs);
  const setDebts = useFinWiseStore((s) => s.setDebts);
  const setGoals = useFinWiseStore((s) => s.setGoals);

  const [showWizard, setShowWizard] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const metrics = useMemo(
    () => (plan ? computePlanMetrics(plan.inputs) : null),
    [plan],
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
    if (settings.acceptedInstitutionalDisclosure) setShowWizard(true);
    else setShowDisclosure(true);
    router.replace('/', { scroll: false });
  }, [wizardOpen, settings.acceptedInstitutionalDisclosure, router]);

  const handleAcceptDisclosure = useCallback(() => {
    updateSettings({ acceptedInstitutionalDisclosure: true });
    setShowDisclosure(false);
    setShowWizard(true);
  }, [updateSettings]);

  function handleUpdatePlan(inputs: PlanInputs) {
    const periods = PAY_PERIODS[inputs.payPeriod] || 26;
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
      transportation: inputs.expenses.transportation,
      subscriptions: inputs.expenses.subscriptions,
      phone: inputs.expenses.phone,
      healthGym: inputs.expenses.health,
      travel: inputs.expenses.travel,
      misc: inputs.expenses.misc,
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
                <span className="text-3xl" role="img" aria-label={f.title}>
                  {f.emoji}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {name ? `Welcome back, ${name}!` : 'Welcome back!'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Last updated: {timeAgo(plan.updatedAt)}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              href="/plan"
              className="inline-flex flex-1 items-center justify-center rounded-md bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563eb] transition-colors sm:flex-none"
            >
              View Full Plan
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={openPlanWizardOrDisclosure}>
              Update Plan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="h-full shadow-sm">
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

          <Card className="h-full shadow-sm">
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

          <Card className="h-full shadow-sm">
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

          <Card className="h-full shadow-sm">
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

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Tools</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-gray-400">No transactions recorded yet.</p>
                <Link
                  href="/transactions"
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add your first transaction
                </Link>
              </div>
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
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
