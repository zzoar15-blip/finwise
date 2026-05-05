'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { InvestInputs, InvestResult } from '@/lib/calculations/invest';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv } from '@/lib/export';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { SimpleRowsPDF } from '@/lib/pdf/SimpleRowsPDF';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCurrency } from '@/lib/format';
import { useFinWiseStore } from '@/lib/store';
import {
  getAnnualCategoryBonusTotal,
  getBonusAmountForMonth,
  getBonusMonths,
  getTotalAnnualBonusPostTax,
  splitBonusAllocations,
} from '@/lib/bonusProfile';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';
import { SyncMeta } from '@/components/SyncMeta';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, Calendar, Percent, Info, TrendingUp } from 'lucide-react';
import { EmptyChart } from '@/components/ui/empty-chart';
import { HelpTooltip } from '@/components/ui/help-tooltip';

type Tab = 'charts' | 'milestones' | 'targets';
type FocusType = 'income' | 'growth';

type InvestScenarioPreset = {
  id: string;
  name: string;
  detail: string;
  values: InvestInputs;
};

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  note,
  disabled,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <span className="text-sm font-semibold tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        className="w-full accent-[#3b82f6] disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && (
        <p className="text-xs text-blue-500 flex items-center gap-1">
          <Info className="size-3" />
          {note}
        </p>
      )}
    </div>
  );
}

function getYearlyTicks(monthly: InvestResult['monthly']): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const pt of monthly) {
    const year = pt.date.slice(0, 4);
    if (!seen.has(year)) {
      seen.add(year);
      ticks.push(pt.date);
    }
  }
  return ticks;
}

function yAxisTickFormatter(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

export default function InvestPage() {
  const investmentInputs = useFinWiseStore((s) => s.investmentInputs);
  const setInvestmentInputs = useFinWiseStore((s) => s.setInvestmentInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const bonusProfile = useFinWiseStore((s) => s.bonusProfile);

  const bonusCalendarDeposits = useMemo(() => {
    if (bonusProfile.frequency === 'none') return undefined;
    const map: Partial<Record<number, number>> = {};
    for (const m of getBonusMonths(bonusProfile)) {
      const lump = getBonusAmountForMonth(m, bonusProfile);
      const br = splitBonusAllocations(lump, bonusProfile.allocations).brokerage;
      if (br > 0) map[m] = (map[m] ?? 0) + br;
    }
    return Object.keys(map).length ? map : undefined;
  }, [bonusProfile]);

  const brokerageBonusAnnual = useMemo(
    () => getAnnualCategoryBonusTotal(bonusProfile, 'brokerage'),
    [bonusProfile],
  );
  const rothBonusAnnual = useMemo(
    () => getAnnualCategoryBonusTotal(bonusProfile, 'rothIra'),
    [bonusProfile],
  );

  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budgetInputs, debts),
    [paycheckInputs, paycheckResults, budgetInputs, debts],
  );
  const availableForInvesting = Math.max(0, flow.monthlySurplus);
  const syncedContributionMonthly =
    (flow.paycheck.k401TraditionalAnnual + flow.paycheck.k401RothAnnual) / 12 +
    budgetInputs.rothIraMonthly +
    budgetInputs.brokerageMonthly;

  // Default tax rate from paycheck if complete
  const defaultTaxRate = flow.paycheck.isComplete
    ? Math.round(flow.paycheck.marginalCombinedRate * 100)
    : investmentInputs.taxRate;

  const [additionalMonthlyBuy, setAdditionalMonthlyBuy] = useState(
    Math.max(
      0,
      (investmentInputs.monthlyBuy > 0 ? investmentInputs.monthlyBuy : Math.round(availableForInvesting / 50) * 50) -
        syncedContributionMonthly
    )
  );
  const [annualBonus, setAnnualBonusState] = useState(investmentInputs.annualBonus);
  const [dividendYield, setDividendYieldState] = useState(investmentInputs.dividendYield);
  const [taxRate, setTaxRateState] = useState(defaultTaxRate);
  const [qualifiedPercent, setQualifiedPercentState] = useState(investmentInputs.qualifiedPercent);
  const [payFrequency, setPayFrequencyState] = useState<'monthly' | 'quarterly'>(investmentInputs.payFrequency);
  const [years, setYearsState] = useState(investmentInputs.years);
  const [annualAppreciation, setAnnualAppreciationState] = useState(investmentInputs.annualAppreciation);
  const [tab, setTab] = useState<Tab>('charts');
  const [focusType, setFocusType] = useState<FocusType>('income');
  const [showTaxDrag, setShowTaxDrag] = useState(true);
  const [holdInRoth, setHoldInRoth] = useState(false);

  const monthlyBuy = Math.max(0, syncedContributionMonthly + additionalMonthlyBuy);
  function setExtraMonthlyBuy(v: number) {
    const safe = Math.max(0, v);
    setAdditionalMonthlyBuy(safe);
    setInvestmentInputs({ monthlyBuy: Math.max(0, syncedContributionMonthly + safe) });
  }
  function setAnnualBonus(v: number) { setAnnualBonusState(v); setInvestmentInputs({ annualBonus: v }); }
  function setDividendYield(v: number) { setDividendYieldState(v); setInvestmentInputs({ dividendYield: v }); }
  function setTaxRate(v: number) { setTaxRateState(v); setInvestmentInputs({ taxRate: v }); }
  function setQualifiedPercent(v: number) { setQualifiedPercentState(v); setInvestmentInputs({ qualifiedPercent: v }); }
  function setPayFrequency(v: 'monthly' | 'quarterly') { setPayFrequencyState(v); setInvestmentInputs({ payFrequency: v }); }
  function setYears(v: number) { setYearsState(v); setInvestmentInputs({ years: v }); }
  function setAnnualAppreciation(v: number) { setAnnualAppreciationState(v); setInvestmentInputs({ annualAppreciation: v }); }

  useEffect(() => {
    setInvestmentInputs({ monthlyBuy: Math.max(0, syncedContributionMonthly + additionalMonthlyBuy) });
  }, [syncedContributionMonthly, additionalMonthlyBuy, setInvestmentInputs]);

  const scenarioPresets = useMemo<InvestScenarioPreset[]>(() => {
    const baseMonthly = Math.max(
      100,
      Math.round(
        (syncedContributionMonthly > 0
          ? syncedContributionMonthly
          : availableForInvesting > 0
            ? availableForInvesting
            : 600) / 50
      ) * 50
    );
    const baseTax = Math.max(10, Math.min(50, defaultTaxRate || 24));
    if (focusType === 'income') {
      return [
        {
          id: 'income-steady',
          name: 'Steady Income',
          detail: 'Higher yield, lower appreciation, monthly distributions',
          values: {
            monthlyBuy: baseMonthly,
            annualBonus: 0,
            dividendYield: 7.5,
            taxRate: baseTax,
            qualifiedPercent: 65,
            payFrequency: 'monthly',
            years: 7,
            annualAppreciation: 2.5,
          },
        },
        {
          id: 'income-hybrid',
          name: 'Income + Growth',
          detail: 'Balanced yield with moderate growth assumptions',
          values: {
            monthlyBuy: baseMonthly,
            annualBonus: 2000,
            dividendYield: 5.5,
            taxRate: baseTax,
            qualifiedPercent: 75,
            payFrequency: 'quarterly',
            years: 8,
            annualAppreciation: 4,
          },
        },
      ];
    }
    return [
      {
        id: 'growth-core',
        name: 'Core Growth',
        detail: 'Lower starting yield, stronger long-run appreciation',
        values: {
          monthlyBuy: baseMonthly,
          annualBonus: 2000,
          dividendYield: 2.2,
          taxRate: baseTax,
          qualifiedPercent: 90,
          payFrequency: 'quarterly',
          years: 10,
          annualAppreciation: 7.5,
        },
      },
      {
        id: 'growth-aggressive',
        name: 'Aggressive Growth',
        detail: 'Max growth tilt with small dividend component',
        values: {
          monthlyBuy: baseMonthly + 100,
          annualBonus: 5000,
          dividendYield: 1.5,
          taxRate: baseTax,
          qualifiedPercent: 95,
          payFrequency: 'quarterly',
          years: 10,
          annualAppreciation: 9,
        },
      },
    ];
  }, [focusType, syncedContributionMonthly, availableForInvesting, defaultTaxRate]);

  function applyScenario(values: InvestInputs) {
    setAdditionalMonthlyBuy(Math.max(0, values.monthlyBuy - syncedContributionMonthly));
    setAnnualBonusState(values.annualBonus);
    setDividendYieldState(values.dividendYield);
    setTaxRateState(values.taxRate);
    setQualifiedPercentState(values.qualifiedPercent);
    setPayFrequencyState(values.payFrequency);
    setYearsState(values.years);
    setAnnualAppreciationState(values.annualAppreciation);
    setInvestmentInputs(values);
  }

  const inputs: InvestInputs = useMemo(
    () => ({
      monthlyBuy,
      annualBonus: bonusCalendarDeposits ? 0 : annualBonus,
      bonusCalendarDeposits,
      dividendYield,
      taxRate: holdInRoth ? 0 : taxRate,
      qualifiedPercent,
      payFrequency,
      years,
      annualAppreciation,
    }),
    [
      monthlyBuy,
      annualBonus,
      bonusCalendarDeposits,
      dividendYield,
      taxRate,
      qualifiedPercent,
      payFrequency,
      years,
      annualAppreciation,
      holdInRoth,
    ]
  );

  const result: InvestResult = useMemo(() => simulateInvestment(inputs), [inputs]);
  const noTaxDragResult: InvestResult = useMemo(
    () => simulateInvestment({ ...inputs, taxRate: 0 }),
    [inputs]
  );

  const totalInvested =
    monthlyBuy * years * 12 +
    (bonusCalendarDeposits ? brokerageBonusAnnual * years : annualBonus * years);
  const yearlyTicks = useMemo(() => getYearlyTicks(result.monthly), [result.monthly]);

  const incomeData = useMemo(
    () => result.monthly.filter((pt) => pt.grossMonthlyIncome > 0),
    [result.monthly]
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'charts', label: 'Charts' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'targets', label: 'Income Targets' },
  ];

  function buildExportRows(): (string | number)[][] {
    return [
      ['Year', 'Portfolio Value ($)', 'Gross Annual Income ($)', 'After-Tax Income ($)', 'Total Invested ($)'],
      ...result.annual.map((pt) => [
        pt.year,
        Math.round(pt.portfolioValue * 100) / 100,
        Math.round(pt.grossAnnualIncome * 100) / 100,
        Math.round(pt.afterTaxAnnualIncome * 100) / 100,
        Math.round(pt.totalInvested * 100) / 100,
      ]),
    ];
  }

  const taxRateNote = flow.paycheck.isComplete
    ? `From your paycheck data (marginal combined: ${(flow.paycheck.marginalCombinedRate * 100).toFixed(1)}%)`
    : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6" id="tool-invest-export">
      {/* Header */}
      <PageHeader
        backHref="/plan"
        title="Investment Income Simulator"
        subtitle="Model growth vs income outcomes with synced contributions from paycheck and budget."
        actions={
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <PDFDownloadButton
              className="flex-1 sm:flex-none"
              label="Export PDF"
              document={<SimpleRowsPDF title="Investment Simulator" rows={buildExportRows()} />}
              fileName={`finwise-invest-${new Date().toISOString().slice(0, 10)}.pdf`}
            />
            <ExportButton
              onExportXlsx={async () => {
                const { exportInvestmentWorkbook } = await import('@/lib/excel/exports/investment');
                exportInvestmentWorkbook(investmentInputs, flow.paycheck);
              }}
              onExportCsv={() => downloadCsv(buildExportRows(), 'finwise-invest')}
            />
          </div>
        }
      />
      <div className="px-8">
        <SyncMeta updatedAt={planLastUpdated} badges={['Unified Flow']} />
        {brokerageBonusAnnual > 0 && bonusCalendarDeposits && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950">
            <span className="font-semibold">✓ Bonus allocation:</span>{' '}
            {formatCurrency(brokerageBonusAnnual)}/yr to brokerage (
            {formatCurrency(getTotalAnnualBonusPostTax(bonusProfile))} total bonus ×{' '}
            {bonusProfile.allocations.brokerage}% brokerage).{' '}
            <Link href="/settings/bonus" className="font-medium text-emerald-800 underline underline-offset-2">
              Adjust →
            </Link>
          </div>
        )}
        {rothBonusAnnual > 0 && (
          <p className="mt-2 text-xs text-cyan-900">
            Your {formatCurrency(rothBonusAnnual)} annual Roth IRA bonus allocation is invested tax-advantaged — not
            included in taxable DRIP above.
          </p>
        )}
        <Link href="/tools/rent-vs-buy" className="mt-1 inline-block text-sm text-blue-600 hover:underline">
          Compare against rent-vs-buy opportunity cost
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT PANEL — Investment Settings */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Investment Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">What are you optimizing for?</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
                <button
                  onClick={() => setFocusType('income')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    focusType === 'income' ? 'bg-[#3b82f6] text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Income Focus
                </button>
                <button
                  onClick={() => setFocusType('growth')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    focusType === 'growth' ? 'bg-[#3b82f6] text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Growth Focus
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested Scenarios
              </p>
              <div className="grid gap-2">
                {scenarioPresets.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => applyScenario(scenario.values)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <p className="text-sm font-semibold">{scenario.name}</p>
                    <p className="text-xs text-muted-foreground">{scenario.detail}</p>
                  </button>
                ))}
              </div>
            </div>

            <SliderRow
              label="Additional Monthly Buy"
              value={additionalMonthlyBuy}
              display={formatCurrency(additionalMonthlyBuy)}
              min={0}
              max={5000}
              step={50}
              onChange={setExtraMonthlyBuy}
              note={availableForInvesting > 0 && flow.paycheck.isComplete
                ? `Budget surplus after debts: ${formatCurrency(availableForInvesting)}/mo`
                : undefined}
            />
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                Synced baseline from Budget/Paycheck:
                <span className="ml-1 font-semibold text-foreground">{formatCurrency(syncedContributionMonthly)}/mo</span>
              </p>
              <p className="mt-1">
                401(k): {formatCurrency((flow.paycheck.k401TraditionalAnnual + flow.paycheck.k401RothAnnual) / 12)} | Roth IRA: {formatCurrency(budgetInputs.rothIraMonthly)} | Brokerage: {formatCurrency(budgetInputs.brokerageMonthly)}
              </p>
              <p className="mt-1">
                Total modeled monthly investment: <span className="font-semibold text-foreground">{formatCurrency(monthlyBuy)}</span>
              </p>
            </div>
            <SliderRow
              label={
                bonusCalendarDeposits
                  ? 'Annual bonus to brokerage (from Settings — slider disabled)'
                  : 'Annual Bonus (February)'
              }
              value={annualBonus}
              display={
                bonusCalendarDeposits ? formatCurrency(brokerageBonusAnnual) : formatCurrency(annualBonus)
              }
              min={0}
              max={50000}
              step={500}
              onChange={setAnnualBonus}
              disabled={!!bonusCalendarDeposits}
              note={
                bonusCalendarDeposits
                  ? 'Timing follows your bonus months; amounts come from Bonus Allocation.'
                  : undefined
              }
            />
            {bonusCalendarDeposits && (
              <p className="text-xs text-muted-foreground">
                Turn off bonus in Settings or set frequency to &quot;none&quot; to use the manual February lump instead.
              </p>
            )}
            <SliderRow
              label="Dividend Yield %"
              value={dividendYield}
              display={`${dividendYield.toFixed(1)}%`}
              min={2}
              max={20}
              step={0.5}
              onChange={setDividendYield}
            />
            <SliderRow
              label="Annual Price Appreciation %"
              value={annualAppreciation}
              display={`${annualAppreciation.toFixed(1)}%`}
              min={0}
              max={15}
              step={0.5}
              onChange={setAnnualAppreciation}
            />
            <SliderRow
              label="Tax Rate (Marginal %)"
              value={taxRate}
              display={`${taxRate}%`}
              min={10}
              max={50}
              step={1}
              onChange={setTaxRate}
              note={taxRateNote}
            />
            <div className="grid grid-cols-1 gap-2 rounded-lg border p-2 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span>Show tax drag comparison</span>
                <input type="checkbox" checked={showTaxDrag} onChange={(e) => setShowTaxDrag(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Hold in Roth IRA (tax-free)</span>
                <input type="checkbox" checked={holdInRoth} onChange={(e) => setHoldInRoth(e.target.checked)} />
              </label>
              {holdInRoth && <p className="text-xs text-green-700">Tax-free growth enabled</p>}
            </div>
            <SliderRow
              label="Qualified Dividends %"
              value={qualifiedPercent}
              display={`${qualifiedPercent}%`}
              min={0}
              max={100}
              step={5}
              onChange={setQualifiedPercent}
            />

            {/* Pay Frequency toggle */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Pay Frequency</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPayFrequency('monthly')}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    payFrequency === 'monthly'
                      ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPayFrequency('quarterly')}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    payFrequency === 'quarterly'
                      ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>

            <SliderRow
              label="Years"
              value={years}
              display={`${years} yr${years !== 1 ? 's' : ''}`}
              min={3}
              max={12}
              step={1}
              onChange={setYears}
            />

            {/* Key stats */}
            <div className="rounded-xl bg-muted/40 p-4 space-y-3 border border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key Stats
              </p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Percent className="size-3.5" />
                  Effective Dividend Tax Rate
                  <HelpTooltip
                    title="Blended tax rate"
                    body="Weighted average of qualified dividend rate and ordinary income rate applied to your dividend income based on the qualified percentage."
                  />
                </span>
                <Badge variant="secondary">
                  {(result.effectiveDividendTaxRate * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <DollarSign className="size-3.5" />
                  Total Invested
                </span>
                <Badge variant="secondary">{formatCurrency(totalInvested)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                  <HelpTooltip
                    title="DRIP"
                    body="Dividend Reinvestment Plan — automatically reinvesting dividends to buy more shares and compound returns over time."
                  />
                  DRIP reinvestment is modeled in both taxable and tax-free paths.
                </p>
                <p className="flex items-center gap-1.5">
                  <HelpTooltip
                    title="Yield on cost"
                    body="Annual dividend income divided by total invested amount. Shows your effective return on original investment."
                  />
                  Yield on cost can improve as dividends compound.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT PANEL — Tabbed results */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Charts tab */}
          {tab === 'charts' && (
            <div className="space-y-4">
              {/* Portfolio Value */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Portfolio Value Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyBuy <= 0 ? (
                    <EmptyChart
                      icon={TrendingUp}
                      title="Configure your investment plan"
                      description="Set a monthly buy amount to see your projected portfolio growth"
                      height={280}
                    />
                  ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={result.monthly} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        ticks={yearlyTicks}
                        tickFormatter={(v: string) => v.slice(0, 4)}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(v) => [typeof v === 'number' ? formatCurrency(v) : String(v), 'Portfolio Value']}
                        labelFormatter={(l) => String(l)}
                      />
                      <Line
                        type="monotone"
                        dataKey="portfolioValue"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name={holdInRoth ? 'Portfolio (Roth tax-free)' : 'Portfolio (with tax drag)'}
                      />
                      {showTaxDrag && !holdInRoth && (
                        <Line
                          type="monotone"
                          data={noTaxDragResult.monthly}
                          dataKey="portfolioValue"
                          stroke="#dc2626"
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                          name="Portfolio (no tax drag)"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                  {showTaxDrag && !holdInRoth && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Roth IRA vs taxable adds{' '}
                      <span className="font-semibold">
                        {formatCurrency(
                          (noTaxDragResult.annual.find((a) => a.year === 5)?.portfolioValue ?? 0) -
                          (result.annual.find((a) => a.year === 5)?.portfolioValue ?? 0)
                        )}
                      </span>{' '}
                      at year 5 and{' '}
                      <span className="font-semibold">
                        {formatCurrency(
                          (noTaxDragResult.annual.find((a) => a.year === 10)?.portfolioValue ?? 0) -
                          (result.annual.find((a) => a.year === 10)?.portfolioValue ?? 0)
                        )}
                      </span>{' '}
                      at year 10.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Income */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>
                    Monthly Income Over Time
                    {payFrequency === 'quarterly' && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (quarterly pay months only)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={incomeData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        interval={payFrequency === 'monthly' ? Math.floor(incomeData.length / 8) : 0}
                        tickFormatter={(v: string) => v.slice(0, 7)}
                      />
                      <YAxis tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(v, name) => [
                          typeof v === 'number' ? formatCurrency(v) : String(v),
                          name === 'grossMonthlyIncome' ? 'Gross Income' : 'After-Tax Income',
                        ]}
                        labelFormatter={(l) => String(l)}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === 'grossMonthlyIncome' ? 'Gross Income' : 'After-Tax Income'
                        }
                      />
                      <Bar dataKey="grossMonthlyIncome" fill="#94a3b8" name="grossMonthlyIncome" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="afterTaxMonthlyIncome" fill="#22c55e" name="afterTaxMonthlyIncome" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Milestones tab */}
          {tab === 'milestones' && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Milestones — February (Bonus) &amp; December (Year-End)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs text-muted-foreground">← Scroll →</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Date</th>
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Label</th>
                        <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Portfolio Value</th>
                        <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Gross Monthly</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">After-Tax Monthly</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.milestones.map((m) => {
                        const isFeb = m.date.slice(5, 7) === '02';
                        const isDec = m.date.slice(5, 7) === '12';
                        return (
                          <tr
                            key={m.date + m.label}
                            className={`border-b border-border/50 ${
                              isFeb
                                ? 'bg-blue-50 dark:bg-blue-950/20'
                                : isDec
                                ? 'bg-slate-50 dark:bg-slate-900/30'
                                : ''
                            }`}
                          >
                            <td className="py-2 pr-4 tabular-nums text-muted-foreground">{m.date}</td>
                            <td className="py-2 pr-4 font-medium">{m.label}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(m.portfolioValue)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">
                              {m.grossMonthlyIncome > 0 ? formatCurrency(m.grossMonthlyIncome) : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums font-medium text-green-700 dark:text-green-400">
                              {m.afterTaxMonthlyIncome > 0 ? formatCurrency(m.afterTaxMonthlyIncome) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Income Targets tab */}
          {tab === 'targets' && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Income Targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Portfolio needed to generate target income at various yields (at your{' '}
                  <strong>{(result.effectiveDividendTaxRate * 100).toFixed(1)}%</strong> effective tax rate)
                </p>
                {result.portfolioTargets.map((target) => (
                  <div key={target.monthlyTarget} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-[#3b82f6]" />
                      <h3 className="font-semibold">
                        {formatCurrency(target.monthlyTarget)}/month target
                      </h3>
                      <Badge variant="outline" className="ml-auto">
                        {formatCurrency(target.monthlyTarget * 12)}/year
                      </Badge>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <p className="px-3 pt-2 text-xs text-muted-foreground">← Scroll →</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="py-2 pl-3 pr-4 text-left font-medium text-muted-foreground">
                              Yield
                            </th>
                            <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                              Gross Portfolio Needed
                            </th>
                            <th className="py-2 pr-3 text-right font-medium text-muted-foreground">
                              After-Tax Portfolio Needed
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {target.byYield.map((row) => (
                            <tr key={row.yield} className="border-b border-border/50 last:border-0">
                              <td className="py-2 pl-3 pr-4 font-medium text-[#3b82f6]">
                                {row.yield}%
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                                {formatCurrency(row.portfolioNeeded)}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                                {formatCurrency(row.afterTaxPortfolioNeeded)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
