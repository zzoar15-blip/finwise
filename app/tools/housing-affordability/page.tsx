'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, ChevronLeft } from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import { getPropertyTaxRate } from '@/lib/stateTax';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';
import { computeHousingAffordability } from '@/lib/calculations/housingAffordability';
import { formatCurrency } from '@/lib/format';
import { SyncMeta } from '@/components/SyncMeta';

export default function HousingAffordabilityPage() {
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const plan = usePlanStore((s) => s.plan);

  const [partnerMonthlyIncome, setPartnerMonthlyIncome] = useState(0);
  const [partnerMonthlyGrossIncome, setPartnerMonthlyGrossIncome] = useState(0);
  const [partnerMonthlyDebt, setPartnerMonthlyDebt] = useState(0);
  const [targetMonthlySavings, setTargetMonthlySavings] = useState(300);
  const [annualMortgageRate, setAnnualMortgageRate] = useState(0.0675);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const planHasHomeGoal = plan?.inputs?.goals?.includes('save-home') ?? false;
  const seededDownPaymentCash = planHasHomeGoal && (plan?.inputs?.homeTarget ?? 0) > 0
    ? (plan?.inputs?.homeTarget ?? 0)
    : 80000;
  const [downPaymentCash, setDownPaymentCash] = useState(seededDownPaymentCash);
  const [downPaymentPct, setDownPaymentPct] = useState(0.2);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  const [annualPropertyTaxRate, setAnnualPropertyTaxRate] = useState(() =>
    getPropertyTaxRate(paycheckInputs.state || 'Massachusetts')
  );
  const [annualHomeInsuranceRate, setAnnualHomeInsuranceRate] = useState(0.005);
  const [annualMaintenanceRate, setAnnualMaintenanceRate] = useState(0.01);
  const [pmiRateAnnual, setPmiRateAnnual] = useState(0.008);
  const [closingCostPct, setClosingCostPct] = useState(0.03);

  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budgetInputs, debts),
    [paycheckInputs, paycheckResults, budgetInputs, debts]
  );

  const affordability = useMemo(
    () =>
      computeHousingAffordability({
        flow,
        currentHousing: budgetInputs.housing,
        partnerMonthlyIncome,
        partnerMonthlyGrossIncome,
        partnerMonthlyDebt,
        targetMonthlySavings,
        annualMortgageRate,
        loanTermYears,
        downPaymentCash,
        downPaymentPct,
        annualPropertyTaxRate,
        annualHomeInsuranceRate,
        annualMaintenanceRate,
        monthlyHoa,
        pmiRateAnnual,
        closingCostPct,
      }),
    [
      flow,
      budgetInputs.housing,
      partnerMonthlyIncome,
      partnerMonthlyGrossIncome,
      partnerMonthlyDebt,
      targetMonthlySavings,
      annualMortgageRate,
      loanTermYears,
      downPaymentCash,
      downPaymentPct,
      annualPropertyTaxRate,
      annualHomeInsuranceRate,
      annualMaintenanceRate,
      monthlyHoa,
      pmiRateAnnual,
      closingCostPct,
    ]
  );

  const readiness = affordability.recommendedMonthlyHousing > 0 && flow.paycheck.isComplete;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-6">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white">
            <ChevronLeft className="size-3" /> Tools
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Home className="size-6 text-emerald-300" />
            Housing Affordability Calculator
          </h1>
          <p className="text-sm text-slate-300">
            Realistic rent and mortgage affordability based on synced budget, debt, and plan assumptions.
          </p>
          <div className="pt-1"><SyncMeta updatedAt={planLastUpdated} badges={['Budget + Plan Synced']} /></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Scenario Inputs</h2>
          <Field label="Partner monthly take-home (optional)" value={partnerMonthlyIncome} onChange={setPartnerMonthlyIncome} step={100} />
          <Field label="Partner monthly gross (optional)" value={partnerMonthlyGrossIncome} onChange={setPartnerMonthlyGrossIncome} step={100} />
          <Field label="Partner debt minimums" value={partnerMonthlyDebt} onChange={setPartnerMonthlyDebt} step={25} />
          <Field label="Target extra monthly savings buffer" value={targetMonthlySavings} onChange={setTargetMonthlySavings} step={50} />
          <Field
            label="Mortgage rate"
            value={annualMortgageRate * 100}
            onChange={(n) => setAnnualMortgageRate(n / 100)}
            suffix="%"
            step={0.05}
          />
          <Field
            label={`Down payment cash${planHasHomeGoal && plan?.inputs?.homeTarget ? ' (seeded from plan goal)' : ''}`}
            value={downPaymentCash}
            onChange={setDownPaymentCash}
            step={5000}
          />
          <Field
            label="Down payment % target"
            value={downPaymentPct * 100}
            onChange={(n) => setDownPaymentPct(Math.max(0, Math.min(80, n)) / 100)}
            suffix="%"
            step={1}
          />
          <Field label="HOA (monthly)" value={monthlyHoa} onChange={setMonthlyHoa} step={25} />
          <Field
            label="Property tax rate"
            value={annualPropertyTaxRate * 100}
            onChange={(n) => setAnnualPropertyTaxRate(n / 100)}
            suffix="%"
            step={0.05}
          />
          <Field
            label="Home insurance rate"
            value={annualHomeInsuranceRate * 100}
            onChange={(n) => setAnnualHomeInsuranceRate(n / 100)}
            suffix="%"
            step={0.05}
          />
          <Field
            label="Maintenance reserve rate"
            value={annualMaintenanceRate * 100}
            onChange={(n) => setAnnualMaintenanceRate(n / 100)}
            suffix="%"
            step={0.05}
          />
          <Field
            label="PMI rate (if <20% down)"
            value={pmiRateAnnual * 100}
            onChange={(n) => setPmiRateAnnual(n / 100)}
            suffix="%"
            step={0.05}
          />
          <Field
            label="Closing costs"
            value={closingCostPct * 100}
            onChange={(n) => setClosingCostPct(n / 100)}
            suffix="%"
            step={0.1}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Loan term</span>
            <div className="flex gap-2">
              {[30, 20, 15].map((term) => (
                <button
                  key={term}
                  onClick={() => setLoanTermYears(term)}
                  className={`rounded-md border px-3 py-1 text-xs ${loanTermYears === term ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : ''}`}
                >
                  {term}yr
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Affordable Monthly Housing" value={formatCurrency(affordability.recommendedMonthlyHousing)} />
            <Metric title="Affordable Monthly Rent" value={formatCurrency(affordability.affordableMonthlyRent)} />
            <Metric title="Affordable Home Price" value={formatCurrency(affordability.affordableHomePrice)} />
            <Metric title="Estimated Loan Amount" value={formatCurrency(affordability.affordableLoanAmount)} />
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-base font-semibold">Affordability bands</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <Band label="Conservative" value={affordability.conservativeMonthlyHousing} tone="bg-[#dcefe8] text-[#11443e]" />
              <Band label="Recommended" value={affordability.recommendedMonthlyHousing} tone="bg-[#d8e8ef] text-[#17344a]" />
              <Band label="Stretch" value={affordability.stretchMonthlyHousing} tone="bg-[#f0e6d4] text-[#5f4b1f]" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-base font-semibold">How the limit is calculated</h3>
            <Row label="Cashflow-based max" value={affordability.maxByCashflow} />
            <Row label="28% gross income max (housing)" value={affordability.maxByFrontEndRatio} />
            <Row label="36% gross income max (housing + debt)" value={affordability.maxByBackEndRatio} />
            <Row label="Buffer-adjusted cashflow limit" value={affordability.availableForHousingAfterBuffer} />
            <Row label="Household monthly income" value={affordability.monthlyIncomeHousehold} />
            <Row label="Current non-housing outflows + savings target" value={affordability.nonHousingOutflows} />
            <Row label="Estimated monthly principal + interest" value={affordability.estimatedMonthlyMortgagePI} />
            <Row label="Estimated monthly tax" value={affordability.estimatedMonthlyTax} />
            <Row label="Estimated monthly insurance" value={affordability.estimatedMonthlyInsurance} />
            <Row label="Estimated monthly maintenance reserve" value={affordability.estimatedMonthlyMaintenance} />
            <Row label="Estimated monthly PMI" value={affordability.estimatedMonthlyPmi} />
            <Row label="Estimated total ownership cost" value={affordability.estimatedMonthlyAllInOwnership} />
            <Row label="Estimated cash to close" value={affordability.estimatedCashToClose} />
            <Row label="Max price by cash-to-close" value={affordability.maxPriceByCashToClose} />
            <div className="pt-2 text-sm text-muted-foreground">
              Binding constraint:{' '}
              <span className="font-medium text-foreground">
                {affordability.bindingConstraint === 'cashflow'
                  ? 'Cashflow'
                  : affordability.bindingConstraint === 'front-end-dti'
                    ? 'Front-end DTI'
                    : 'Back-end DTI'}
              </span>
            </div>
            {!readiness ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Complete your paycheck inputs to unlock a more realistic affordability range.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Single or Couple planning</p>
            <p className="mt-1">
              Leave partner income at $0 for a single-person scenario, or add partner take-home and debt minimums for a couple affordability estimate.
            </p>
            <p className="mt-2">
              Want to compare with lifestyle tradeoffs? Continue in{' '}
              <Link href="/tools/rent-vs-buy" className="text-blue-600 hover:underline">Rent vs. Buy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix = '$',
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm text-muted-foreground">{label}</label>
        <div className="flex items-center gap-1">
          {suffix === '$' ? <span className="text-sm">$</span> : null}
          <input
            type="number"
            step={step}
            className="w-28 rounded-md border px-2 py-1 text-right text-sm"
            value={Number(value.toFixed(4))}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          {suffix !== '$' ? <span className="text-sm">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Band({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${tone}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
