'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CarFront, ChevronLeft } from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { computeUnifiedMonthlyFlow } from '@/lib/calculations';
import { computeCarAffordability } from '@/lib/calculations/carAffordability';
import { formatCurrency } from '@/lib/format';
import { SyncMeta } from '@/components/SyncMeta';

export default function CarAffordabilityPage() {
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);

  const [ownershipType, setOwnershipType] = useState<'new' | 'used'>('new');
  const [partnerMonthlyIncome, setPartnerMonthlyIncome] = useState(0);
  const [targetMonthlySavings, setTargetMonthlySavings] = useState(150);
  const [transportIncomeRatio, setTransportIncomeRatio] = useState(0.15);
  const [annualInsurance, setAnnualInsurance] = useState(1900);
  const [monthlyFuel, setMonthlyFuel] = useState(180);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState(80);
  const [loanApr, setLoanApr] = useState(0.069);
  const [loanTermMonths, setLoanTermMonths] = useState(60);
  const [loanDownPayment, setLoanDownPayment] = useState(5000);
  const [tradeInValue, setTradeInValue] = useState(0);
  const [salesTaxRate, setSalesTaxRate] = useState(0.07);
  const [purchaseFees, setPurchaseFees] = useState(1200);
  const [leaseTermMonths, setLeaseTermMonths] = useState(36);
  const [leaseMoneyFactor, setLeaseMoneyFactor] = useState(0.0025);
  const [leaseResidualPct, setLeaseResidualPct] = useState(0.58);
  const [leaseDownPayment, setLeaseDownPayment] = useState(3000);
  const [leaseFees, setLeaseFees] = useState(900);
  const [annualDepreciationNew, setAnnualDepreciationNew] = useState(0.18);
  const [annualDepreciationUsed, setAnnualDepreciationUsed] = useState(0.12);

  const flow = useMemo(
    () => computeUnifiedMonthlyFlow(paycheckInputs, paycheckResults, budgetInputs, debts),
    [paycheckInputs, paycheckResults, budgetInputs, debts]
  );

  const results = useMemo(
    () =>
      computeCarAffordability({
        flow,
        ownershipType,
        currentTransportBudget: budgetInputs.transportation,
        partnerMonthlyIncome,
        targetMonthlySavings,
        transportIncomeRatio,
        annualInsurance,
        monthlyFuel,
        monthlyMaintenance,
        loanApr,
        loanTermMonths,
        loanDownPayment,
        tradeInValue,
        salesTaxRate,
        purchaseFees,
        leaseTermMonths,
        leaseMoneyFactor,
        leaseResidualPct,
        leaseDownPayment,
        leaseFees,
        annualDepreciationNew,
        annualDepreciationUsed,
      }),
    [
      flow,
      ownershipType,
      budgetInputs.transportation,
      partnerMonthlyIncome,
      targetMonthlySavings,
      transportIncomeRatio,
      annualInsurance,
      monthlyFuel,
      monthlyMaintenance,
      loanApr,
      loanTermMonths,
      loanDownPayment,
      tradeInValue,
      salesTaxRate,
      purchaseFees,
      leaseTermMonths,
      leaseMoneyFactor,
      leaseResidualPct,
      leaseDownPayment,
      leaseFees,
      annualDepreciationNew,
      annualDepreciationUsed,
    ]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3" /> Tools
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CarFront className="size-6 text-[#1e3a5f]" />
          Car Purchase Calculator (Loan vs Lease)
        </h1>
        <p className="text-sm text-muted-foreground">
          Realistic car affordability with insurance, fuel, maintenance, and your existing cashflow.
        </p>
        <SyncMeta updatedAt={planLastUpdated} badges={['Budget + Plan Synced']} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[430px_1fr]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Affordability Inputs</h2>
          <Field label="Partner monthly take-home (optional)" value={partnerMonthlyIncome} onChange={setPartnerMonthlyIncome} step={100} />
          <Field label="Extra monthly savings buffer" value={targetMonthlySavings} onChange={setTargetMonthlySavings} step={25} />
          <Field
            label="Transport budget ratio target"
            value={transportIncomeRatio * 100}
            onChange={(n) => setTransportIncomeRatio(Math.max(5, Math.min(30, n)) / 100)}
            suffix="%"
            step={1}
          />
          <Field label="Annual insurance" value={annualInsurance} onChange={setAnnualInsurance} step={100} />
          <Field label="Monthly fuel" value={monthlyFuel} onChange={setMonthlyFuel} step={10} />
          <Field label="Monthly maintenance" value={monthlyMaintenance} onChange={setMonthlyMaintenance} step={10} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vehicle type</span>
            <div className="flex gap-2">
              {(['new', 'used'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOwnershipType(type)}
                  className={`rounded-md border px-3 py-1 text-xs capitalize ${type === ownershipType ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <Field label="New car annual depreciation" value={annualDepreciationNew * 100} onChange={(n) => setAnnualDepreciationNew(n / 100)} suffix="%" step={1} />
          <Field label="Used car annual depreciation" value={annualDepreciationUsed * 100} onChange={(n) => setAnnualDepreciationUsed(n / 100)} suffix="%" step={1} />

          <h3 className="pt-2 text-sm font-semibold text-muted-foreground">Loan assumptions</h3>
          <Field label="APR" value={loanApr * 100} onChange={(n) => setLoanApr(n / 100)} suffix="%" step={0.1} />
          <Field label="Loan down payment" value={loanDownPayment} onChange={setLoanDownPayment} step={500} />
          <Field label="Trade-in value" value={tradeInValue} onChange={setTradeInValue} step={500} />
          <Field label="Sales tax rate" value={salesTaxRate * 100} onChange={(n) => setSalesTaxRate(n / 100)} suffix="%" step={0.1} />
          <Field label="Purchase fees" value={purchaseFees} onChange={setPurchaseFees} step={100} />
          <ButtonGroup
            label="Loan term"
            value={loanTermMonths}
            options={[48, 60, 72]}
            onChange={setLoanTermMonths}
            unit="mo"
          />

          <h3 className="pt-2 text-sm font-semibold text-muted-foreground">Lease assumptions</h3>
          <Field label="Money factor" value={leaseMoneyFactor} onChange={setLeaseMoneyFactor} step={0.0001} suffix="" />
          <Field label="Residual %" value={leaseResidualPct * 100} onChange={(n) => setLeaseResidualPct(n / 100)} suffix="%" step={1} />
          <Field label="Lease due at signing" value={leaseDownPayment} onChange={setLeaseDownPayment} step={250} />
          <Field label="Lease fees" value={leaseFees} onChange={setLeaseFees} step={100} />
          <ButtonGroup
            label="Lease term"
            value={leaseTermMonths}
            options={[24, 36, 48]}
            onChange={setLeaseTermMonths}
            unit="mo"
          />
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Recommended Car Budget" value={formatCurrency(results.recommendedTransportBudget)} />
            <Metric title="Conservative Budget" value={formatCurrency(results.conservativeTransportBudget)} />
            <Metric title="Affordable Loan Car Price" value={formatCurrency(results.affordableLoanCarPrice)} />
            <Metric title="Affordable Lease MSRP" value={formatCurrency(results.affordableLeaseCarPrice)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-base font-semibold">Loan scenario</h3>
              <Row label="Estimated loan-only payment" value={results.loanPaymentOnly} />
              <Row label="All-in monthly (incl. insurance)" value={results.loanMonthlyAllIn} />
              <Row label="Affordable purchase price" value={results.affordableLoanCarPrice} bold />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-base font-semibold">Lease scenario</h3>
              <Row label="Estimated lease-only payment" value={results.leasePaymentOnly} />
              <Row label="All-in monthly (incl. insurance)" value={results.leaseMonthlyAllIn} />
              <Row label="Affordable lease MSRP" value={results.affordableLeaseCarPrice} bold />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-base font-semibold">3-year total cost of ownership</h3>
            <Row label="Loan depreciation loss (3y)" value={results.loanDepreciationLoss3Year} />
            <Row label="Loan total cost (3y)" value={results.loanTotalCost3Year} />
            <Row label="Lease total cost (3y)" value={results.leaseTotalCost3Year} />
            <p className="mt-2 text-sm text-muted-foreground">
              {results.loanTotalCost3Year <= results.leaseTotalCost3Year
                ? 'Based on your assumptions, buying is lower-cost over 3 years.'
                : 'Based on your assumptions, leasing is lower-cost over 3 years.'}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-base font-semibold">What drives this number</h3>
            <Row label="Household monthly income" value={results.monthlyIncomeHousehold} />
            <Row label="Non-transport outflows + savings buffer" value={results.nonTransportOutflows} />
            <Row label="Cashflow-based max" value={results.maxByCashflow} />
            <Row label="Income-ratio max" value={results.maxByIncomeRatio} />
            <Row label="Selected depreciation rate" value={results.selectedDepreciationRate * 100} suffix="%" />
            <p className="mt-3 text-sm text-muted-foreground">
              This model is all-in by design: payment + insurance + fuel + maintenance. That keeps the recommendation realistic.
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
          {suffix !== '$' && suffix ? <span className="text-sm">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}

function ButtonGroup({
  label,
  value,
  options,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (n: number) => void;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-md border px-3 py-1 text-xs ${opt === value ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : ''}`}
          >
            {opt}{unit}
          </button>
        ))}
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

function Row({ label, value, bold = false, suffix = '' }: { label: string; value: number; bold?: boolean; suffix?: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className={bold ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''}`}>
        {suffix ? `${value.toFixed(1)}${suffix}` : formatCurrency(value)}
      </span>
    </div>
  );
}
