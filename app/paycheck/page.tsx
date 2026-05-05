'use client';

import React, { useState, useMemo } from 'react';
import { DollarSign, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { calculatePaycheck, PAY_PERIODS } from '@/lib/calculations/paycheck';
import type { PaycheckInputs, PayPeriod, FilingStatus } from '@/lib/calculations/paycheck';
import { formatCurrency } from '@/lib/format';

const PAY_PERIOD_LABELS: Record<PayPeriod, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  semimonthly: 'Semimonthly',
  monthly: 'Monthly',
};

const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  married: 'Married Filing Jointly',
  hoh: 'Head of Household',
};

const DEFAULT_INPUTS: PaycheckInputs = {
  annualSalary: 85000,
  payPeriod: 'biweekly',
  filingStatus: 'single',
  traditional401kPct: 6,
  hsaPerPeriod: 0,
  fsaPerPeriod: 0,
  healthInsurancePerPeriod: 0,
  dentalPerPeriod: 0,
  commuterBenefitPerPeriod: 0,
  roth401kPct: 0,
  otherPostTaxPerPeriod: 0,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-3">
      <Label className="text-sm text-gray-600">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function SliderField({ label, value, onChange, min = 0, max = 30 }: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-gray-600">{label}</Label>
        <span className="text-sm font-semibold text-gray-800">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#1a56a8] cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

interface LineItemProps {
  label: string;
  value: number;
  indent?: boolean;
  negative?: boolean;
  muted?: boolean;
  highlight?: boolean;
  borderTop?: boolean;
  doubleBorderTop?: boolean;
  large?: boolean;
  red?: boolean;
}

function LineItem({
  label,
  value,
  indent = false,
  negative = false,
  muted = false,
  highlight = false,
  borderTop = false,
  doubleBorderTop = false,
  large = false,
  red = false,
}: LineItemProps) {
  const displayValue = negative
    ? value === 0
      ? '—'
      : `(${formatCurrency(value)})`
    : formatCurrency(value);

  return (
    <div
      className={[
        'flex items-center justify-between py-1.5',
        borderTop ? 'border-t border-gray-200 mt-1 pt-2.5' : '',
        doubleBorderTop ? 'border-t-2 border-double border-gray-400 mt-1 pt-2.5' : '',
        indent ? 'pl-4' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          large ? 'text-base font-bold' : 'text-sm',
          muted ? 'text-gray-400' : '',
          highlight ? 'font-semibold text-gray-700' : '',
          large && !muted ? 'text-[#1a56a8]' : '',
          !large && !muted && !highlight ? 'text-gray-600' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>
      <span
        className={[
          large ? 'text-lg font-bold' : 'text-sm font-medium',
          red ? 'text-red-600' : '',
          large ? 'text-[#1a56a8]' : '',
          muted && !red ? 'text-gray-400' : '',
          negative && !red ? 'text-gray-500' : '',
          !red && !large && !muted && !negative ? 'text-gray-800' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {displayValue}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PaycheckPage() {
  const [inputs, setInputs] = useState<PaycheckInputs>(DEFAULT_INPUTS);

  function update<K extends keyof PaycheckInputs>(key: K, value: PaycheckInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function numericInput(key: keyof PaycheckInputs) {
    return {
      type: 'number' as const,
      min: 0,
      value: inputs[key] as number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        update(key, Number(e.target.value) as PaycheckInputs[typeof key]),
    };
  }

  const result = useMemo(() => calculatePaycheck(inputs), [inputs]);

  const periods = PAY_PERIODS[inputs.payPeriod];
  const annualNet = result.netPay * periods;

  // Benefit savings table — only non-zero benefits
  const benefitRows: Array<{ label: string; annual: number; savings: number }> = [
    {
      label: 'Traditional 401(k)',
      annual: result.traditional401k * periods,
      savings: result.benefitSavings.traditional401k,
    },
    {
      label: 'HSA',
      annual: result.hsa * periods,
      savings: result.benefitSavings.hsa,
    },
    {
      label: 'FSA',
      annual: result.fsa * periods,
      savings: result.benefitSavings.fsa,
    },
    {
      label: 'Health Insurance',
      annual: result.healthInsurance * periods,
      savings: result.benefitSavings.healthInsurance,
    },
    {
      label: 'Dental',
      annual: result.dental * periods,
      savings: result.benefitSavings.dental,
    },
    {
      label: 'Commuter Benefit',
      annual: result.commuterBenefit * periods,
      savings: result.benefitSavings.commuterBenefit,
    },
  ].filter((r) => r.annual > 0);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paycheck Calculator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Estimate your Massachusetts take-home pay for 2025.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── LEFT PANEL: Inputs ─────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Paycheck Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Salary & Pay */}
            <div>
              <SectionHeading>Salary &amp; Pay</SectionHeading>
              <div className="space-y-4">
                <FieldRow label="Annual Salary ($)">
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={inputs.annualSalary}
                    onChange={(e) => update('annualSalary', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label="Pay Period">
                  <Select
                    value={inputs.payPeriod}
                    onValueChange={(v) => v && update('payPeriod', v as PayPeriod)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{PAY_PERIOD_LABELS[inputs.payPeriod]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAY_PERIOD_LABELS) as PayPeriod[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {PAY_PERIOD_LABELS[p]} ({PAY_PERIODS[p]}×/yr)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Filing Status">
                  <Select
                    value={inputs.filingStatus}
                    onValueChange={(v) => v && update('filingStatus', v as FilingStatus)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{FILING_STATUS_LABELS[inputs.filingStatus]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {FILING_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </div>

            <Separator />

            {/* Pre-Tax Deductions */}
            <div>
              <SectionHeading>Pre-Tax Deductions</SectionHeading>
              <div className="space-y-5">
                <SliderField
                  label="Traditional 401(k) (%)"
                  value={inputs.traditional401kPct}
                  onChange={(v) => update('traditional401kPct', v)}
                />

                <FieldRow label="HSA ($/period)">
                  <Input {...numericInput('hsaPerPeriod')} step={10} className="w-full" />
                </FieldRow>

                <FieldRow label="FSA ($/period)">
                  <Input {...numericInput('fsaPerPeriod')} step={10} className="w-full" />
                </FieldRow>

                <FieldRow label="Health Insurance ($/period)">
                  <Input {...numericInput('healthInsurancePerPeriod')} step={10} className="w-full" />
                </FieldRow>

                <FieldRow label="Dental ($/period)">
                  <Input {...numericInput('dentalPerPeriod')} step={5} className="w-full" />
                </FieldRow>

                <FieldRow label="Commuter Benefit ($/period)">
                  <Input {...numericInput('commuterBenefitPerPeriod')} step={10} className="w-full" />
                </FieldRow>
              </div>
            </div>

            <Separator />

            {/* Post-Tax Deductions */}
            <div>
              <SectionHeading>Post-Tax Deductions</SectionHeading>
              <div className="space-y-5">
                <SliderField
                  label="Roth 401(k) (%)"
                  value={inputs.roth401kPct}
                  onChange={(v) => update('roth401kPct', v)}
                />

                <FieldRow label="Other Post-Tax ($/period)">
                  <Input {...numericInput('otherPostTaxPerPeriod')} step={10} className="w-full" />
                </FieldRow>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── RIGHT PANEL: Results ───────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Breakdown Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Paycheck Breakdown</CardTitle>
                <Badge variant="outline" className="font-normal text-gray-500">
                  {PAY_PERIOD_LABELS[inputs.payPeriod]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {/* Gross */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-bold text-gray-800">Gross Pay</span>
                <span className="text-sm font-bold text-gray-800">
                  {formatCurrency(result.grossPay)}
                </span>
              </div>

              {/* Pre-tax deductions */}
              <LineItem
                label="Traditional 401(k)"
                value={result.traditional401k}
                indent
                negative
                muted
              />
              <LineItem label="HSA" value={result.hsa} indent negative muted />
              <LineItem label="FSA" value={result.fsa} indent negative muted />
              <LineItem label="Health Insurance" value={result.healthInsurance} indent negative muted />
              <LineItem label="Dental" value={result.dental} indent negative muted />
              <LineItem
                label="Commuter Benefit"
                value={result.commuterBenefit}
                indent
                negative
                muted
              />

              {/* Taxable wages */}
              <LineItem
                label="= Taxable Wages"
                value={result.federalTaxableWages}
                borderTop
                highlight
              />

              {/* Taxes */}
              <LineItem label="Federal Income Tax" value={result.federalIncomeTax} red />
              <LineItem label="Social Security (6.2%)" value={result.socialSecurity} red />
              <LineItem label="Medicare" value={result.medicare} red />
              <LineItem label="MA State Tax (5%)" value={result.maStateTax} red />
              <LineItem label="MA PFML (0.46%)" value={result.maPfml} red />

              {/* After-tax pay */}
              <LineItem
                label="= After-Tax Pay"
                value={result.grossPay - result.totalPreTax - result.totalTaxes}
                borderTop
                highlight
              />

              {/* Post-tax deductions */}
              <LineItem label="Roth 401(k)" value={result.roth401k} indent negative muted />
              <LineItem label="Other Post-Tax" value={result.otherPostTax} indent negative muted />

              {/* Net pay */}
              <LineItem
                label="NET PAY"
                value={result.netPay}
                doubleBorderTop
                large
              />

              {/* Rate badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Info className="h-3 w-3" />
                  Effective Federal: {(result.effectiveFederalRate * 100).toFixed(1)}%
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Info className="h-3 w-3" />
                  Marginal Rate: {(result.marginalFederalRate * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* Annual net */}
              <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-[#1a56a8]">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Annual Net Pay</span>
                  </div>
                  <span className="text-base font-bold text-[#1a56a8]">
                    {formatCurrency(annualNet)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-blue-400">
                  {formatCurrency(result.netPay)} × {periods} pay periods
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Benefit Tax Savings Card */}
          {benefitRows.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Benefit Tax Savings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                        Benefit
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                        Annual Amt
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                        Tax Savings
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {benefitRows.map((row) => (
                      <tr key={row.label} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {formatCurrency(row.annual)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                          {formatCurrency(row.savings)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-400">
                          {row.annual > 0
                            ? `${((row.savings / row.annual) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-green-50/50">
                      <td className="px-4 py-2.5 font-semibold text-gray-700" colSpan={2}>
                        Total Annual Savings
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600">
                        {formatCurrency(benefitRows.reduce((s, r) => s + r.savings, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
