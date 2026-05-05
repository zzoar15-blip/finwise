'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calculator,
  PieChart,
  CreditCard,
  TrendingUp,
  BarChart3,
  Wallet,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { usePlanStore } from '@/lib/planStore';
import { useFinanceStore } from '@/lib/store';
import { computePlanMetrics } from '@/lib/planCalculations';
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { plan, settings, setPlan } = usePlanStore();
  const transactions = useFinanceStore((s) => s.transactions);

  const [showWizard, setShowWizard] = useState(false);

  const metrics = useMemo(
    () => (plan ? computePlanMetrics(plan.inputs) : null),
    [plan],
  );

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  function handleUpdatePlan(inputs: PlanInputs) {
    setPlan(inputs);
    setShowWizard(false);
  }

  // ── State A: no plan ─────────────────────────────────────────────────────
  if (!plan) {
    return (
      <>
        {showWizard && (
          <div className="fixed inset-0 z-50 overflow-auto bg-white">
            <OnboardingWizard onComplete={handleUpdatePlan} />
          </div>
        )}

        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
          {/* Hero */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a56a8] shadow-lg">
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
              onClick={() => setShowWizard(true)}
            >
              Build My Financial Plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Feature cards */}
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
  const surplus = metrics?.monthlySurplus ?? 0;
  const savingsRate = metrics?.savingsRate ?? 0;
  const takeHome = metrics?.monthlyTakeHome ?? 0;
  const debtFreeDate = metrics?.debtFreeDate;

  return (
    <>
      {showWizard && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white">
          <OnboardingWizard
            initialValues={plan.inputs}
            onComplete={handleUpdatePlan}
          />
        </div>
      )}

      <div className="max-w-6xl space-y-8">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {name ? `Welcome back, ${name}!` : 'Welcome back!'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Last updated: {timeAgo(plan.updatedAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/plan"
              className="inline-flex items-center rounded-md bg-[#1a56a8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1545a0] transition-colors"
            >
              View Full Plan
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
            <Button variant="outline" onClick={() => setShowWizard(true)}>
              Update Plan
            </Button>
          </div>
        </div>

        {/* Hero metric cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Monthly Take-Home */}
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Monthly Take-Home
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(takeHome)}</p>
            </CardContent>
          </Card>

          {/* Monthly Surplus */}
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Monthly Surplus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  surplus >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(surplus)}
              </p>
            </CardContent>
          </Card>

          {/* Savings Rate */}
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Savings Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${savingsRateColor(savingsRate)}`}>
                {savingsRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          {/* Debt-Free Date */}
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Debt-Free Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtFreeDate ? (
                <p className="text-xl font-bold text-gray-900">{debtFreeDate}</p>
              ) : (
                <p className="text-xl font-bold text-green-600">Debt free! ✓</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links grid */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Tools</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_LINKS.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href} className="group block">
                <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all group-hover:border-[#1a56a8] group-hover:shadow-md">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1a56a8]">
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

        {/* Recent Transactions */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
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
