'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { STATE_CONFIGS } from '@/lib/stateTax';
import { calculatePaycheck, PAY_PERIODS } from '@/lib/calculations/paycheck';
import { formatCurrency } from '@/lib/format';

import type { PlanInputs, PlanDebt, PlanExpenses, Goal, DebtPresetType } from '@/types/plan';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  initialValues?: Partial<PlanInputs>;
  onComplete: (inputs: PlanInputs) => void;
}

const STEP_LABELS = ['Income', 'Benefits', 'Expenses', 'Debts', 'Goals'] as const;
const TOTAL_STEPS = STEP_LABELS.length;

const DEFAULT_INPUTS: PlanInputs = {
  name: '',
  annualSalary: 85000,
  state: 'CA',
  payPeriod: 'biweekly',
  filingStatus: 'single',
  annualBonus: 0,
  nycResident: false,
  traditional401kPct: 6,
  roth401kPct: 0,
  hsaPerPeriod: 0,
  fsaPerPeriod: 0,
  healthInsurancePerPeriod: 0,
  dentalPerPeriod: 0,
  commuterBenefitPerPeriod: 0,
  otherPreTaxPerPeriod: 0,
  expenses: {
    housing: 1800,
    utilities: 150,
    groceries: 400,
    dining: 200,
    transportation: 150,
    subscriptions: 50,
    phone: 80,
    health: 50,
    travel: 100,
    misc: 150,
  },
  debts: [],
  goals: [],
  currentEmergencyFund: 0,
  emergencyFundTarget: 10000,
  homeTarget: 0,
  homeTimelineMonths: 36,
};

const DEBT_PRESETS: Record<
  string,
  { label: string; debtType: DebtPresetType; apr: number; minPaymentFn: (bal: number) => number }
> = {
  'credit-card': {
    label: 'Credit Card',
    debtType: 'credit-card',
    apr: 22,
    minPaymentFn: (bal) => Math.max(25, bal * 0.02),
  },
  student: {
    label: 'Student Loan',
    debtType: 'student',
    apr: 6.5,
    minPaymentFn: (bal) => Math.max(50, bal * 0.01),
  },
  personal: {
    label: 'Personal Loan',
    debtType: 'personal',
    apr: 12,
    minPaymentFn: (bal) => Math.max(25, bal * 0.02),
  },
  car: {
    label: 'Car Loan',
    debtType: 'car',
    apr: 7,
    minPaymentFn: (bal) => Math.max(100, bal * 0.02),
  },
  mortgage: {
    label: 'Mortgage',
    debtType: 'mortgage',
    apr: 7,
    minPaymentFn: (bal) => Math.max(500, bal * 0.005),
  },
};

const GOAL_CARDS: {
  id: Goal;
  icon: string;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'pay-debt',
    icon: '🔴',
    label: 'Pay off debt fast',
    description: 'Eliminate high-interest debt with a proven payoff strategy.',
    color: 'border-red-200 bg-red-50',
  },
  {
    id: 'emergency-fund',
    icon: '🟡',
    label: 'Build emergency fund',
    description: 'Create a 3–6 month safety net for unexpected expenses.',
    color: 'border-yellow-200 bg-yellow-50',
  },
  {
    id: 'invest-income',
    icon: '🟢',
    label: 'Grow investment income',
    description: 'Put surplus cash to work in diversified investments.',
    color: 'border-green-200 bg-green-50',
  },
  {
    id: 'save-home',
    icon: '🏠',
    label: 'Save for a home',
    description: 'Build a down payment on your own timeline.',
    color: 'border-blue-200 bg-blue-50',
  },
  {
    id: 'retire-early',
    icon: '⚡',
    label: 'Retire early',
    description: 'Maximize savings rate and reach financial independence sooner.',
    color: 'border-purple-200 bg-purple-50',
  },
  {
    id: 'tax-efficiency',
    icon: '💰',
    label: 'Maximize tax efficiency',
    description: 'Use every available tax-advantaged account and deduction.',
    color: 'border-amber-200 bg-amber-50',
  },
  {
    id: 'dividend-income',
    icon: '📈',
    label: 'Build passive income',
    description: 'Generate dividend streams that cover your living expenses.',
    color: 'border-teal-200 bg-teal-50',
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function numericValue(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Shared field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function PaycheckPreviewRow({
  label,
  value,
  muted,
  indent,
}: {
  label: string;
  value: number;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${indent ? 'pl-3 text-gray-500' : ''}`}
    >
      <span className={`text-sm ${muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</span>
      <span className={`tabular-nums text-sm ${muted ? 'text-gray-500' : 'text-gray-700'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function BenefitsSliderField({
  label,
  value,
  max,
  field,
  hint,
  summary,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  field: keyof PlanInputs;
  hint?: string;
  summary?: string;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">{label}</Label>
        <span className="rounded bg-blue-50 px-2 py-0.5 text-sm font-semibold text-[#3b82f6]">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange({ [field]: parseFloat(e.target.value) })}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#3b82f6]"
      />
      {summary && <p className="text-xs font-medium text-gray-600">{summary}</p>}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function BenefitsDollarField({
  label,
  value,
  field,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  field: keyof PlanInputs;
  hint?: string;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          $
        </span>
        <Input
          type="number"
          min={0}
          step={10}
          className="pl-6"
          value={value || ''}
          onChange={(e) => onChange({ [field]: numericValue(e.target.value) })}
        />
      </div>
    </Field>
  );
}

function ExpenseField({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: keyof PlanExpenses;
  value: number;
  onChange: (field: keyof PlanExpenses, value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          $
        </span>
        <Input
          type="number"
          min={0}
          step={10}
          className="pl-6"
          value={value || ''}
          onChange={(e) => onChange(field, numericValue(e.target.value))}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Income
// ---------------------------------------------------------------------------

function StepIncome({
  inputs,
  onChange,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  const sortedStates = useMemo(
    () => [...STATE_CONFIGS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Tell us about your income</h2>
        <p className="mt-1 text-sm text-gray-500">
          We use this to calculate your actual take-home pay.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <Field label="Your name (optional)">
          <Input
            type="text"
            placeholder="e.g. Alex"
            value={inputs.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>

        {/* Annual salary */}
        <Field label="Annual salary ($)">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              $
            </span>
            <Input
              type="number"
              min={0}
              step={1000}
              className="pl-6"
              value={inputs.annualSalary || ''}
              onChange={(e) => onChange({ annualSalary: numericValue(e.target.value) })}
            />
          </div>
        </Field>

        {/* State */}
        <Field label="State">
          <Select
            value={inputs.state}
            onValueChange={(v) => v && onChange({ state: v, nycResident: false })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {sortedStates.map((s) => (
                <SelectItem key={s.abbr} value={s.abbr}>
                  {s.abbr} – {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Pay period */}
        <Field label="Pay period">
          <Select
            value={inputs.payPeriod}
            onValueChange={(v) =>
              v && onChange({ payPeriod: v as PlanInputs['payPeriod'] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly (52×/yr)</SelectItem>
              <SelectItem value="biweekly">Biweekly (26×/yr)</SelectItem>
              <SelectItem value="semimonthly">Semimonthly (24×/yr)</SelectItem>
              <SelectItem value="monthly">Monthly (12×/yr)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* Filing status */}
        <Field label="Filing status">
          <Select
            value={inputs.filingStatus}
            onValueChange={(v) =>
              v && onChange({ filingStatus: v as PlanInputs['filingStatus'] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married (MFJ)</SelectItem>
              <SelectItem value="hoh">Head of Household</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* Annual bonus */}
        <Field label="Annual bonus (post-tax, $)" hint="Optional — enter 0 if none">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              $
            </span>
            <Input
              type="number"
              min={0}
              step={500}
              className="pl-6"
              value={inputs.annualBonus || ''}
              onChange={(e) => onChange({ annualBonus: numericValue(e.target.value) })}
            />
          </div>
        </Field>
      </div>

      {/* NYC resident — only visible when NY is selected */}
      {inputs.state === 'NY' && (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-[#3b82f6] accent-[#3b82f6]"
            checked={inputs.nycResident}
            onChange={(e) => onChange({ nycResident: e.target.checked })}
          />
          <span className="text-sm font-medium text-gray-800">
            I live in New York City (NYC local tax applies)
          </span>
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Benefits & Deductions
// ---------------------------------------------------------------------------

function PaycheckPreview({ inputs }: { inputs: PlanInputs }) {
  const result = useMemo(() => {
    try {
      return calculatePaycheck({
        annualSalary: inputs.annualSalary,
        payPeriod: inputs.payPeriod,
        filingStatus: inputs.filingStatus,
        state: inputs.state,
        nycResident: inputs.nycResident,
        traditional401kPct: inputs.traditional401kPct,
        hsaPerPeriod: inputs.hsaPerPeriod,
        fsaPerPeriod: inputs.fsaPerPeriod,
        healthInsurancePerPeriod: inputs.healthInsurancePerPeriod,
        dentalPerPeriod: inputs.dentalPerPeriod,
        commuterBenefitPerPeriod: inputs.commuterBenefitPerPeriod,
        roth401kPct: inputs.roth401kPct,
        otherPreTaxPerPeriod: inputs.otherPreTaxPerPeriod,
        otherPostTaxPerPeriod: 0,
      });
    } catch {
      return null;
    }
  }, [inputs]);

  const periods = PAY_PERIODS[inputs.payPeriod];
  const periodLabel: Record<PlanInputs['payPeriod'], string> = {
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    semimonthly: 'Semimonthly',
    monthly: 'Monthly',
  };

  if (!result) {
    return (
      <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
        Enter your income details to see a preview.
      </div>
    );
  }

  const annualNet = result.netPay * periods;

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {periodLabel[inputs.payPeriod]} Paycheck Preview
      </p>

      <PaycheckPreviewRow label="Gross pay" value={result.grossPay} />

      <div className="my-2 border-t border-dashed border-gray-100" />

      <p className="mb-1 text-xs font-medium text-gray-400">Pre-tax deductions</p>
      {result.traditional401k > 0 && (
        <PaycheckPreviewRow label="401(k) Traditional" value={-result.traditional401k} indent muted />
      )}
      {result.hsa > 0 && <PaycheckPreviewRow label="HSA" value={-result.hsa} indent muted />}
      {result.fsa > 0 && <PaycheckPreviewRow label="FSA" value={-result.fsa} indent muted />}
      {result.healthInsurance > 0 && (
        <PaycheckPreviewRow label="Health insurance" value={-result.healthInsurance} indent muted />
      )}
      {result.dental > 0 && <PaycheckPreviewRow label="Dental/Vision" value={-result.dental} indent muted />}
      {result.commuterBenefit > 0 && (
        <PaycheckPreviewRow label="Commuter benefit" value={-result.commuterBenefit} indent muted />
      )}
      {result.totalPreTax > 0 && (
        <PaycheckPreviewRow label="Total pre-tax" value={-result.totalPreTax} muted />
      )}

      <div className="my-2 border-t border-dashed border-gray-100" />

      <p className="mb-1 text-xs font-medium text-gray-400">Taxes</p>
      <PaycheckPreviewRow label="Federal income tax" value={-result.federalIncomeTax} indent muted />
      <PaycheckPreviewRow label="Social Security" value={-result.socialSecurity} indent muted />
      <PaycheckPreviewRow label="Medicare" value={-result.medicare} indent muted />
      {result.stateTax > 0 && (
        <PaycheckPreviewRow label={`${inputs.state} state tax`} value={-result.stateTax} indent muted />
      )}
      {result.localTax > 0 && <PaycheckPreviewRow label="NYC local tax" value={-result.localTax} indent muted />}
      {result.additionalPayrollTaxes.map((t) => (
        <PaycheckPreviewRow key={t.name} label={t.name} value={-t.amount} indent muted />
      ))}

      {result.roth401k > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-gray-100" />
          <PaycheckPreviewRow label="Roth 401(k)" value={-result.roth401k} muted />
        </>
      )}

      <div className="my-3 border-t border-gray-200" />

      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">Net pay</span>
        <span className="text-xl font-bold text-[#3b82f6]">{formatCurrency(result.netPay)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-500">Annual net (excl. bonus)</span>
        <span className="text-sm font-medium text-gray-600">{formatCurrency(annualNet)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-blue-50 p-3">
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Effective rate</p>
          <p className="text-sm font-semibold text-gray-700">
            {(result.effectiveFederalRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Marginal rate</p>
          <p className="text-sm font-semibold text-gray-700">
            {(result.marginalFederalRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function StepBenefits({
  inputs,
  onChange,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  const total401k = inputs.traditional401kPct + inputs.roth401kPct;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Benefits & deductions</h2>
        <p className="mt-1 text-sm text-gray-500">
          See how pre-tax benefits reduce your taxable income.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT — inputs */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              401(k) Contributions
            </p>
            <div className="flex flex-col gap-4">
              <BenefitsSliderField
                label="Traditional 401(k)"
                value={inputs.traditional401kPct}
                max={30}
                field="traditional401kPct"
                summary={`Current: ${inputs.traditional401kPct}% | Max: $23,500`}
                hint="Pre-tax — lowers your taxable income now"
                onChange={onChange}
              />
              <BenefitsSliderField
                label="Roth 401(k)"
                value={inputs.roth401kPct}
                max={30}
                field="roth401kPct"
                summary={`Current: ${inputs.roth401kPct}% | Max: $23,500`}
                hint="Post-tax — grows tax-free"
                onChange={onChange}
              />
              {total401k > 23500 / (inputs.annualSalary / 100) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Combined 401(k) contributions may exceed IRS limits. The 2025 limit is $23,500.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pre-tax benefits (per pay period)
            </p>
            <div className="flex flex-col gap-4">
              <BenefitsDollarField
                label="HSA contribution"
                value={inputs.hsaPerPeriod}
                field="hsaPerPeriod"
                hint="Health Savings Account — triple tax advantage"
                onChange={onChange}
              />
              <BenefitsDollarField
                label="FSA contribution"
                value={inputs.fsaPerPeriod}
                field="fsaPerPeriod"
                hint="Flexible Spending Account"
                onChange={onChange}
              />
              <BenefitsDollarField
                label="Health insurance premium"
                value={inputs.healthInsurancePerPeriod}
                field="healthInsurancePerPeriod"
                onChange={onChange}
              />
              <BenefitsDollarField
                label="Dental / Vision premium"
                value={inputs.dentalPerPeriod}
                field="dentalPerPeriod"
                onChange={onChange}
              />
              <BenefitsDollarField
                label="Commuter benefit"
                value={inputs.commuterBenefitPerPeriod}
                field="commuterBenefitPerPeriod"
                hint="Transit / parking — pre-tax up to IRS limit"
                onChange={onChange}
              />
              <BenefitsDollarField
                label="Other pre-tax deductions"
                value={inputs.otherPreTaxPerPeriod}
                field="otherPreTaxPerPeriod"
                onChange={onChange}
              />
            </div>
          </div>
        </div>

        {/* RIGHT — live paycheck preview */}
        <div className="lg:sticky lg:top-4">
          <PaycheckPreview inputs={inputs} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Monthly Expenses
// ---------------------------------------------------------------------------

function StepExpenses({
  inputs,
  onChange,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  const monthlyNetPay = useMemo(() => {
    try {
      const result = calculatePaycheck({
        annualSalary: inputs.annualSalary,
        payPeriod: inputs.payPeriod,
        filingStatus: inputs.filingStatus,
        state: inputs.state,
        nycResident: inputs.nycResident,
        traditional401kPct: inputs.traditional401kPct,
        hsaPerPeriod: inputs.hsaPerPeriod,
        fsaPerPeriod: inputs.fsaPerPeriod,
        healthInsurancePerPeriod: inputs.healthInsurancePerPeriod,
        dentalPerPeriod: inputs.dentalPerPeriod,
        commuterBenefitPerPeriod: inputs.commuterBenefitPerPeriod,
        roth401kPct: inputs.roth401kPct,
        otherPreTaxPerPeriod: inputs.otherPreTaxPerPeriod,
        otherPostTaxPerPeriod: 0,
      });
      return (result.netPay * PAY_PERIODS[inputs.payPeriod]) / 12;
    } catch {
      return 0;
    }
  }, [inputs]);

  const totalExpenses = useMemo(
    () => Object.values(inputs.expenses).reduce((a, b) => a + b, 0),
    [inputs.expenses],
  );

  const surplus = monthlyNetPay - totalExpenses;
  const surplusColor = surplus >= 0 ? 'text-green-600' : 'text-red-500';
  const handleExpenseChange = useCallback(
    (field: keyof PlanExpenses, value: number) => {
      onChange({
        expenses: { ...inputs.expenses, [field]: value },
      });
    },
    [inputs.expenses, onChange],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Monthly expenses</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your typical monthly spending in each category.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExpenseField label="Housing (rent/mortgage)" field="housing" value={inputs.expenses.housing} onChange={handleExpenseChange} />
        <ExpenseField label="Utilities" field="utilities" value={inputs.expenses.utilities} onChange={handleExpenseChange} />
        <ExpenseField label="Groceries" field="groceries" value={inputs.expenses.groceries} onChange={handleExpenseChange} />
        <ExpenseField label="Dining out" field="dining" value={inputs.expenses.dining} onChange={handleExpenseChange} />
        <ExpenseField label="Transportation" field="transportation" value={inputs.expenses.transportation} onChange={handleExpenseChange} />
        <ExpenseField label="Subscriptions" field="subscriptions" value={inputs.expenses.subscriptions} onChange={handleExpenseChange} />
        <ExpenseField label="Phone" field="phone" value={inputs.expenses.phone} onChange={handleExpenseChange} />
        <ExpenseField label="Health / gym" field="health" value={inputs.expenses.health} onChange={handleExpenseChange} />
        <ExpenseField label="Travel" field="travel" value={inputs.expenses.travel} onChange={handleExpenseChange} />
        <ExpenseField label="Miscellaneous" field="misc" value={inputs.expenses.misc} onChange={handleExpenseChange} />
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500">Monthly take-home</p>
            <p className="font-semibold text-gray-800">{formatCurrency(monthlyNetPay)}</p>
          </div>
          <div className="text-gray-400">–</div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500">Total expenses</p>
            <p className="font-semibold text-gray-800">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="text-gray-400">=</div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500">Monthly surplus</p>
            <p className={`text-lg font-bold ${surplusColor}`}>{formatCurrency(surplus)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Debts
// ---------------------------------------------------------------------------

interface AddDebtFormState {
  name: string;
  debtType: DebtPresetType;
  balance: string;
  apr: string;
  minPayment: string;
}

const EMPTY_DEBT_FORM: AddDebtFormState = {
  name: '',
  debtType: 'other',
  balance: '',
  apr: '',
  minPayment: '',
};

function StepDebts({
  inputs,
  onChange,
  onSkip,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
  onSkip: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddDebtFormState>(EMPTY_DEBT_FORM);

  const applyPreset = useCallback(
    (presetKey: string) => {
      const preset = DEBT_PRESETS[presetKey];
      if (!preset) return;
      setForm({
        name: preset.label,
        debtType: preset.debtType,
        balance: '',
        apr: preset.apr.toString(),
        minPayment: '',
      });
      setShowForm(true);
    },
    [],
  );

  const handleBalanceChange = useCallback(
    (val: string) => {
      const bal = numericValue(val);
      const preset = Object.values(DEBT_PRESETS).find((p) => p.debtType === form.debtType);
      setForm((f) => ({
        ...f,
        balance: val,
        minPayment: preset && bal > 0 ? preset.minPaymentFn(bal).toFixed(2) : f.minPayment,
      }));
    },
    [form.debtType],
  );

  const addDebt = useCallback(() => {
    const debt: PlanDebt = {
      id: crypto.randomUUID(),
      name: form.name.trim() || 'Debt',
      debtType: form.debtType,
      balance: numericValue(form.balance),
      apr: numericValue(form.apr),
      minPayment: numericValue(form.minPayment),
    };
    onChange({ debts: [...inputs.debts, debt] });
    setForm(EMPTY_DEBT_FORM);
    setShowForm(false);
  }, [form, inputs.debts, onChange]);

  const removeDebt = useCallback(
    (id: string) => {
      onChange({ debts: inputs.debts.filter((d) => d.id !== id) });
    },
    [inputs.debts, onChange],
  );

  const totalDebt = useMemo(
    () => inputs.debts.reduce((sum, d) => sum + d.balance, 0),
    [inputs.debts],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Debts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add any debts so we can build a payoff strategy.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600"
        >
          Skip this step
        </button>
      </div>

      {/* Quick preset buttons */}
      {!showForm && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DEBT_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#3b82f6] hover:text-[#3b82f6]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline add form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-800">Add debt details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Debt name">
              <Input
                type="text"
                placeholder="e.g. Chase Visa"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>

            <Field label="Debt type">
              <Select
                value={form.debtType}
                onValueChange={(v) => v && setForm((f) => ({ ...f, debtType: v as DebtPresetType }))}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit-card">Credit Card</SelectItem>
                  <SelectItem value="student">Student Loan</SelectItem>
                  <SelectItem value="personal">Personal Loan</SelectItem>
                  <SelectItem value="car">Car Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Balance ($)">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  className="bg-white pl-6"
                  value={form.balance}
                  onChange={(e) => handleBalanceChange(e.target.value)}
                />
              </div>
            </Field>

            <Field label="APR (%)">
              <Input
                type="number"
                min={0}
                step={0.1}
                className="bg-white"
                value={form.apr}
                onChange={(e) => setForm((f) => ({ ...f, apr: e.target.value }))}
              />
            </Field>

            <Field label="Min. monthly payment ($)">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  className="bg-white pl-6"
                  value={form.minPayment}
                  onChange={(e) => setForm((f) => ({ ...f, minPayment: e.target.value }))}
                />
              </div>
            </Field>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={addDebt}
              className="bg-[#3b82f6] text-white hover:bg-[#1547a0]"
            >
              Add debt
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_DEBT_FORM);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Debt button (when form is hidden) */}
      {!showForm && (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-fit border-dashed"
        >
          + Add Debt
        </Button>
      )}

      {/* Debt list */}
      {inputs.debts.length > 0 && (
        <div className="flex flex-col gap-2">
          {inputs.debts.map((debt) => (
            <div
              key={debt.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-gray-800">{debt.name}</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(debt.balance)} • {debt.apr}% APR • {formatCurrency(debt.minPayment)}/mo min
                </p>
              </div>
              <button
                type="button"
                aria-label="Remove debt"
                onClick={() => removeDebt(debt.id)}
                className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
            <span className="text-sm font-medium text-gray-600">Total debt balance</span>
            <span className="text-base font-bold text-gray-800">{formatCurrency(totalDebt)}</span>
          </div>
        </div>
      )}

      {inputs.debts.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-sm font-medium text-slate-800">No debts added yet</p>
          <p className="mt-1 text-sm text-slate-500">Add a debt above or skip this step if you are debt-free.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Goals
// ---------------------------------------------------------------------------

function StepGoals({
  inputs,
  onChange,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
}) {
  const hasDebts = inputs.debts.length > 0;

  function toggleGoal(goal: Goal) {
    const current = inputs.goals;
    if (current.includes(goal)) {
      onChange({ goals: current.filter((g) => g !== goal) });
    } else {
      onChange({ goals: [...current, goal] });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">What are your financial goals?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select all that apply. We&apos;ll build your personalized plan around these.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOAL_CARDS.map((card) => {
          const selected = inputs.goals.includes(card.id);
          return (
            <div key={card.id} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => toggleGoal(card.id)}
                className={`relative w-full rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? 'border-[#3b82f6] bg-blue-50 shadow-md'
                    : `border-transparent ${card.color} hover:border-gray-300`
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{card.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{card.label}</p>
                      {card.id === 'pay-debt' && hasDebts && (
                        <span className="flex h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{card.description}</p>
                  </div>
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      selected
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selected && (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <polyline points="1.5,6 4.5,9 10.5,3" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded inputs for specific goals */}
              {selected && card.id === 'emergency-fund' && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <Field label="Current emergency fund balance ($)">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={500}
                        className="bg-white pl-6"
                        value={inputs.currentEmergencyFund || ''}
                        onChange={(e) =>
                          onChange({ currentEmergencyFund: numericValue(e.target.value) })
                        }
                      />
                    </div>
                  </Field>
                  <Field label="Target emergency fund amount ($)">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={500}
                        className="bg-white pl-6"
                        value={inputs.emergencyFundTarget || ''}
                        onChange={(e) =>
                          onChange({ emergencyFundTarget: numericValue(e.target.value) })
                        }
                      />
                    </div>
                  </Field>
                  <p className="text-xs text-yellow-800">
                    Current runway: {Object.values(inputs.expenses).reduce((a, b) => a + b, 0) > 0
                      ? (inputs.currentEmergencyFund / Object.values(inputs.expenses).reduce((a, b) => a + b, 0)).toFixed(1)
                      : '0.0'} months of expenses.
                  </p>
                </div>
              )}

              {selected && card.id === 'save-home' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex flex-col gap-3">
                    <Field label="Down payment target ($)">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          className="bg-white pl-6"
                          value={inputs.homeTarget || ''}
                          onChange={(e) => onChange({ homeTarget: numericValue(e.target.value) })}
                        />
                      </div>
                    </Field>
                    <Field label="Timeline (months)">
                      <Input
                        type="number"
                        min={1}
                        max={360}
                        className="bg-white"
                        value={inputs.homeTimelineMonths || ''}
                        onChange={(e) =>
                          onChange({ homeTimelineMonths: numericValue(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating overlay
// ---------------------------------------------------------------------------

function GeneratingOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#3b82f6]" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-gray-800">Generating your plan...</p>
          <p className="mt-1 text-sm text-gray-500">Crunching the numbers just for you</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export function OnboardingWizard({ initialValues, onComplete }: OnboardingWizardProps) {
  const [inputs, setInputs] = useState<PlanInputs>(() => ({
    ...DEFAULT_INPUTS,
    ...initialValues,
    expenses: { ...DEFAULT_INPUTS.expenses, ...initialValues?.expenses },
    debts: initialValues?.debts ?? DEFAULT_INPUTS.debts,
    goals: initialValues?.goals ?? DEFAULT_INPUTS.goals,
  }));

  const [step, setStep] = useState(0); // 0-indexed internally
  const [direction, setDirection] = useState(1);
  const [generating, setGenerating] = useState(false);

  const patchInputs = useCallback((patch: Partial<PlanInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleComplete = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      onComplete(inputs);
    }, 1500);
  }, [inputs, onComplete]);

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            <span className="text-[#3b82f6]">Fin</span>Wise
          </h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized financial plan</p>
        </div>

        {/* Progress area */}
        <div className="mb-6">
          {/* Step labels */}
          <div className="mb-2 flex items-center justify-between">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < step
                      ? 'bg-[#3b82f6] text-white'
                      : i === step
                        ? 'bg-[#3b82f6] text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < step ? (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <polyline points="1.5,6 4.5,9 10.5,3" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`mt-1 hidden text-[11px] font-medium sm:block ${
                    i === step ? 'text-[#3b82f6]' : i < step ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar track */}
          <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#3b82f6] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="mt-1 text-right text-xs text-gray-400">
            Step {step + 1} of {TOTAL_STEPS}
          </p>
        </div>

        {/* Card with step content */}
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          {generating && <GeneratingOverlay />}

          <div className="p-6 sm:p-8">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={step}
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                {step === 0 && (
                  <StepIncome inputs={inputs} onChange={patchInputs} />
                )}
                {step === 1 && (
                  <StepBenefits inputs={inputs} onChange={patchInputs} />
                )}
                {step === 2 && (
                  <StepExpenses inputs={inputs} onChange={patchInputs} />
                )}
                {step === 3 && (
                  <StepDebts
                    inputs={inputs}
                    onChange={patchInputs}
                    onSkip={goNext}
                  />
                )}
                {step === 4 && (
                  <StepGoals inputs={inputs} onChange={patchInputs} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={step === 0}
              className="min-w-[80px]"
            >
              ← Back
            </Button>

            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-[#3b82f6]' : i < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {step < TOTAL_STEPS - 1 ? (
              <Button
                onClick={goNext}
                className="min-w-[80px] bg-[#3b82f6] text-white hover:bg-[#1547a0]"
              >
                Next →
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={generating}
                className="bg-[#3b82f6] text-white hover:bg-[#1547a0]"
              >
                Generate My Plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
