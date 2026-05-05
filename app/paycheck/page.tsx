'use client';

import React, { useState, useRef, useMemo } from 'react';
import { DollarSign, Info } from 'lucide-react';
import { useFinWiseStore } from '@/lib/store';
import { PAY_PERIODS } from '@/lib/calculations/paycheck';
import type { PayPeriod, FilingStatus } from '@/lib/calculations/paycheck';
import { STATE_CONFIGS } from '@/lib/stateTax';
import { formatCurrency } from '@/lib/format';
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
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv } from '@/lib/export';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { SyncMeta } from '@/components/SyncMeta';
import type { StorePaycheckInputs } from '@/lib/calculations';
import { PaycheckPDF } from '@/lib/pdf/PaycheckPDF';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { validators } from '@/lib/validation';

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  );
}

function FieldRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-3">
      <Label className="flex items-center gap-1.5 text-sm text-gray-600">{label}</Label>
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
        className="w-full accent-[#3b82f6] cursor-pointer"
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
          large && !muted ? 'text-[#3b82f6]' : '',
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
          large ? 'text-[#3b82f6]' : '',
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
  const storeInputs = useFinWiseStore((s) => s.paycheckInputs);
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const setPaycheckInputs = useFinWiseStore((s) => s.setPaycheckInputs);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const debts = useFinWiseStore((s) => s.debts);

  // Local inputs state: per-period display values for $ amounts, direct for % and other
  const [localInputs, setLocalInputs] = useState<StorePaycheckInputs>(() => storeInputs);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(newInputs: StorePaycheckInputs) {
    setLocalInputs(newInputs);
    const nextErrors: string[] = [];
    const salaryError = validators.salary(newInputs.annualSalary);
    if (salaryError) nextErrors.push(salaryError);
    const k401Error = validators.k401(newInputs.k401TraditionalPct, newInputs.annualSalary);
    if (k401Error) nextErrors.push(k401Error);
    const rothError = validators.percentage(newInputs.k401RothPct);
    if (rothError) nextErrors.push(`Roth 401(k): ${rothError}`);
    if (newInputs.k401TraditionalPct + newInputs.k401RothPct > 100) {
      nextErrors.push('401(k) + Roth 401(k) combined cannot exceed 100%.');
    }
    const hsaError = validators.hsa(newInputs.hsaAnnual, false);
    if (hsaError) nextErrors.push(hsaError);
    const fsaError = validators.fsa(newInputs.fsaAnnual);
    if (fsaError) nextErrors.push(fsaError);
    setValidationErrors(nextErrors);
    if (nextErrors.length > 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPaycheckInputs(newInputs);
    }, 300);
  }

  function updateField<K extends keyof StorePaycheckInputs>(key: K, value: StorePaycheckInputs[K]) {
    update({ ...localInputs, [key]: value });
  }

  // When payPeriod changes, recalculate periods and keep annual amounts the same
  function handlePayPeriodChange(newPeriod: PayPeriod) {
    update({ ...localInputs, payPeriod: newPeriod });
  }

  const currentPeriods = PAY_PERIODS[localInputs.payPeriod] || 26;

  // Per-period display helpers
  function perPeriodDisplay(annualValue: number) {
    return Math.round((annualValue / currentPeriods) * 100) / 100;
  }

  function handlePerPeriodInput(key: keyof StorePaycheckInputs, perPeriodValue: number) {
    const annualValue = perPeriodValue * currentPeriods;
    update({ ...localInputs, [key]: annualValue });
  }

  const selectedState = STATE_CONFIGS.find((s) => s.abbr === localInputs.state);

  // Benefit savings from results
  const pr = paycheckResults;

  // Benefit rows for the savings table
  const benefitRows = useMemo(() => {
    if (!pr.isComplete) return [];
    const rows = [
      { label: 'Traditional 401(k)', annual: pr.k401TraditionalAnnual, savings: 0 },
      { label: 'HSA', annual: localInputs.hsaAnnual, savings: 0 },
      { label: 'FSA', annual: localInputs.fsaAnnual, savings: 0 },
    ].filter(r => r.annual > 0);

    // Estimate savings using marginal rate for 401k / combined for others
    return rows.map(r => ({
      ...r,
      savings: r.label === 'Traditional 401(k)'
        ? r.annual * pr.marginalFederalRate
        : r.annual * (pr.marginalCombinedRate),
    })).filter(r => r.savings > 0);
  }, [pr, localInputs.hsaAnnual, localInputs.fsaAnnual]);

  function buildCsvRows(): (string | number)[][] {
    if (!pr.isComplete) return [['No paycheck data calculated yet']];
    return [
      ['Paycheck Breakdown', `Per Period (${PAY_PERIOD_LABELS[localInputs.payPeriod]})`, 'Annual'],
      ['Gross Pay', pr.grossPerPaycheck, pr.grossAnnual],
      ['Traditional 401(k)', -(pr.k401TraditionalAnnual / currentPeriods), -pr.k401TraditionalAnnual],
      ['Roth 401(k)', -(pr.k401RothAnnual / currentPeriods), -pr.k401RothAnnual],
      ['HSA', -(localInputs.hsaAnnual / currentPeriods), -localInputs.hsaAnnual],
      ['FSA', -(localInputs.fsaAnnual / currentPeriods), -localInputs.fsaAnnual],
      ['Health Insurance', -(localInputs.healthInsuranceAnnual / currentPeriods), -localInputs.healthInsuranceAnnual],
      ['Dental/Vision', -(localInputs.dentalAnnual / currentPeriods), -localInputs.dentalAnnual],
      ['Commuter Benefit', -(localInputs.commuterAnnual / currentPeriods), -localInputs.commuterAnnual],
      ['Federal Tax', -(pr.federalTaxAnnual / currentPeriods), -pr.federalTaxAnnual],
      ['Social Security', -(pr.ssAnnual / currentPeriods), -pr.ssAnnual],
      ['Medicare', -(pr.medicareAnnual / currentPeriods), -pr.medicareAnnual],
      ['State Tax', -(pr.stateTaxAnnual / currentPeriods), -pr.stateTaxAnnual],
      ['State Payroll Tax', -(pr.statePfmlAnnual / currentPeriods), -pr.statePfmlAnnual],
      ['Net Pay', pr.netPayPerPaycheck, pr.netPayAnnual],
      [''],
      ['Effective Tax Rate', `${(pr.effectiveTaxRate * 100).toFixed(1)}%`],
      ['Marginal Federal Rate', `${(pr.marginalFederalRate * 100).toFixed(0)}%`],
      ['Marginal Combined Rate', `${(pr.marginalCombinedRate * 100).toFixed(1)}%`],
      ['Annual Tax Savings', pr.annualTaxSavingsFromBenefits],
    ];
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8" id="tool-paycheck-export">
      <PageHeader
        backHref="/plan"
        title="Paycheck Calculator"
        subtitle="Estimate true take-home after tax and benefits. Every downstream tool syncs from here."
        actions={
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <PDFDownloadButton
              className="flex-1 sm:flex-none"
              label="Export PDF"
              document={
                <PaycheckPDF
                  data={{
                    periodLabel: PAY_PERIOD_LABELS[localInputs.payPeriod],
                    grossPerPaycheck: pr.grossPerPaycheck,
                    netPayPerPaycheck: pr.netPayPerPaycheck,
                    effectiveTaxRate: pr.effectiveTaxRate,
                    netPayAnnual: pr.netPayAnnual,
                    annualSalary: localInputs.annualSalary,
                    preTaxRows: [
                      { label: 'Traditional 401(k)', value: pr.k401TraditionalAnnual / currentPeriods },
                      { label: 'HSA', value: localInputs.hsaAnnual / currentPeriods },
                      { label: 'FSA', value: localInputs.fsaAnnual / currentPeriods },
                      { label: 'Health insurance', value: localInputs.healthInsuranceAnnual / currentPeriods },
                    ],
                    taxRows: [
                      { label: 'Federal income tax', value: pr.federalTaxAnnual / currentPeriods },
                      { label: 'Social Security', value: pr.ssAnnual / currentPeriods },
                      { label: 'Medicare', value: pr.medicareAnnual / currentPeriods },
                      { label: 'State income tax', value: pr.stateTaxAnnual / currentPeriods },
                    ],
                    postTaxRows: localInputs.otherPostTaxAnnual > 0
                      ? [{ label: 'Other post-tax deductions', value: localInputs.otherPostTaxAnnual / currentPeriods }]
                      : [],
                    annualTaxSavingsFromBenefits: pr.annualTaxSavingsFromBenefits,
                    marginalCombinedRate: pr.marginalCombinedRate,
                  }}
                />
              }
              fileName={`finwise-paycheck-${new Date().toISOString().slice(0, 10)}.pdf`}
            />
            <ExportButton
              label="Export"
              onExportXlsx={async () => {
                if (!pr.isComplete) return;
                const { exportBudgetWorkbook } = await import('@/lib/excel/exports/budget');
                exportBudgetWorkbook(localInputs, pr, budgetInputs, debts);
              }}
              onExportCsv={() => downloadCsv(buildCsvRows(), 'finwise-paycheck')}
            />
          </div>
        }
      />
      <div className="px-8"><SyncMeta updatedAt={planLastUpdated} badges={['Source of Truth']} /></div>

      {/* Auto-save banner */}
      {pr.isComplete && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          <Info className="h-4 w-4 shrink-0 text-green-600" />
          Paycheck synced — Budget, Debt, and Investment tools will reflect these numbers automatically.
        </div>
      )}
      {validationErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {validationErrors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

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
                    value={localInputs.annualSalary || ''}
                    placeholder="0"
                    onChange={(e) => updateField('annualSalary', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label="Pay Period">
                  <Select
                    value={localInputs.payPeriod}
                    onValueChange={(v) => v && handlePayPeriodChange(v as PayPeriod)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{PAY_PERIOD_LABELS[localInputs.payPeriod]}</SelectValue>
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
                    value={localInputs.filingStatus}
                    onValueChange={(v) => v && updateField('filingStatus', v as FilingStatus)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{FILING_STATUS_LABELS[localInputs.filingStatus]}</SelectValue>
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

                <FieldRow label="State">
                  <Select
                    value={localInputs.state}
                    onValueChange={(v) => {
                      if (!v) return;
                      const newInputs = { ...localInputs, state: v };
                      if (v !== 'NY') newInputs.nycResident = false;
                      update(newInputs);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {selectedState ? `${selectedState.abbr} – ${selectedState.name}` : localInputs.state}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {STATE_CONFIGS.map((s) => (
                        <SelectItem key={s.abbr} value={s.abbr}>
                          {s.abbr} – {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                {localInputs.state === 'NY' && (
                  <FieldRow label="NYC Resident?">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localInputs.nycResident}
                        onChange={(e) => updateField('nycResident', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#3b82f6]"
                      />
                      <span className="text-sm text-gray-700">
                        Add NYC local tax (~3.5%)
                      </span>
                    </label>
                  </FieldRow>
                )}
              </div>
            </div>

            <Separator />

            {/* Pre-Tax Deductions */}
            <div>
              <SectionHeading>Pre-Tax Deductions</SectionHeading>
              <div className="space-y-5">
                <SliderField
                  label={`Traditional 401(k) (%)${selectedState && !selectedState.allows401k ? ' *' : ''}`}
                  value={localInputs.k401TraditionalPct}
                  onChange={(v) => updateField('k401TraditionalPct', v)}
                />
                <HelpTooltip
                  title="Traditional 401(k)"
                  body="Contributions are pre-tax, reducing your taxable income now. You pay tax when you withdraw in retirement."
                />
                {selectedState && !selectedState.allows401k && (
                  <p className="text-xs text-amber-600">
                    * {selectedState.name} does not allow 401(k) deduction for state income tax.
                  </p>
                )}

                <FieldRow label={<><span>HSA ($/period)</span><HelpTooltip title="HSA" body="Triple tax advantage: contributions are pre-tax, growth is tax-free, and withdrawals for medical expenses are tax-free." /></>}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={perPeriodDisplay(localInputs.hsaAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('hsaAnnual', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label={<><span>FSA ($/period)</span><HelpTooltip title="FSA" body="Use-it-or-lose-it pre-tax account for medical/dependent care expenses. Reduces taxable income." /></>}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={perPeriodDisplay(localInputs.fsaAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('fsaAnnual', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label={`Health Insurance ($/period)`}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={perPeriodDisplay(localInputs.healthInsuranceAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('healthInsuranceAnnual', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label={`Dental/Vision ($/period)`}>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={perPeriodDisplay(localInputs.dentalAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('dentalAnnual', Number(e.target.value))}
                    className="w-full"
                  />
                </FieldRow>

                <FieldRow label={`Commuter Benefit ($/period)`}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={perPeriodDisplay(localInputs.commuterAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('commuterAnnual', Number(e.target.value))}
                    className="w-full"
                  />
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
                  value={localInputs.k401RothPct}
                  onChange={(v) => updateField('k401RothPct', v)}
                />
                <HelpTooltip
                  title="Roth 401(k)"
                  body="Contributions are post-tax, so there is no immediate tax break, but qualified growth and withdrawals are tax-free in retirement."
                />

                <FieldRow label={`Other Post-Tax ($/period)`}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={perPeriodDisplay(localInputs.otherPostTaxAnnual) || ''}
                    placeholder="0"
                    onChange={(e) => handlePerPeriodInput('otherPostTaxAnnual', Number(e.target.value))}
                    className="w-full"
                  />
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
                  {PAY_PERIOD_LABELS[localInputs.payPeriod]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {!pr.isComplete ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Enter your annual salary above to see your paycheck breakdown.
                </p>
              ) : (
                <>
                  {/* Gross */}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm font-bold text-gray-800">Gross Pay</span>
                    <span className="text-sm font-bold text-gray-800">
                      {formatCurrency(pr.grossPerPaycheck)}
                    </span>
                  </div>

                  {/* Pre-tax deductions */}
                  <LineItem label="Traditional 401(k)" value={pr.k401TraditionalAnnual / currentPeriods} indent negative muted />
                  <LineItem label="Roth 401(k)" value={pr.k401RothAnnual / currentPeriods} indent negative muted />
                  <LineItem label="HSA" value={localInputs.hsaAnnual / currentPeriods} indent negative muted />
                  <LineItem label="FSA" value={localInputs.fsaAnnual / currentPeriods} indent negative muted />
                  <LineItem label="Health Insurance" value={localInputs.healthInsuranceAnnual / currentPeriods} indent negative muted />
                  <LineItem label="Dental/Vision" value={localInputs.dentalAnnual / currentPeriods} indent negative muted />
                  <LineItem label="Commuter Benefit" value={localInputs.commuterAnnual / currentPeriods} indent negative muted />

                  {/* Taxable wages */}
                  <LineItem label="= Taxable Wages" value={pr.grossPerPaycheck - pr.totalPreTaxDeductions / currentPeriods} borderTop highlight />

                  {/* Federal taxes */}
                  <LineItem label="Federal Income Tax" value={pr.federalTaxAnnual / currentPeriods} muted />
                  <LineItem label="Social Security (6.2%)" value={pr.ssAnnual / currentPeriods} muted />
                  <LineItem label="Medicare" value={pr.medicareAnnual / currentPeriods} muted />

                  {pr.stateTaxAnnual > 0 && (
                    <LineItem
                      label={`${selectedState?.name ?? localInputs.state} Income Tax`}
                      value={pr.stateTaxAnnual / currentPeriods}
                      muted
                    />
                  )}

                  {pr.statePfmlAnnual > 0 && (
                    <LineItem
                      label="State Payroll Tax"
                      value={pr.statePfmlAnnual / currentPeriods}
                      muted
                    />
                  )}

                  {/* After-tax pay */}
                  <LineItem
                    label="= After-Tax Pay"
                    value={pr.grossPerPaycheck - pr.totalPreTaxDeductions / currentPeriods - pr.totalTaxesAnnual / currentPeriods}
                    borderTop
                    highlight
                  />

                  {/* Post-tax deductions */}
                  {pr.k401RothAnnual > 0 && (
                    <LineItem label="Roth 401(k)" value={pr.k401RothAnnual / currentPeriods} indent negative muted />
                  )}
                  {localInputs.otherPostTaxAnnual > 0 && (
                    <LineItem label="Other Post-Tax" value={localInputs.otherPostTaxAnnual / currentPeriods} indent negative muted />
                  )}

                  {/* Net pay */}
                  <LineItem label="NET PAY" value={pr.netPayPerPaycheck} doubleBorderTop large />

                  {/* Rate badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Info className="h-3 w-3" />
                      Effective: {(pr.effectiveTaxRate * 100).toFixed(1)}%
                      <HelpTooltip
                        title="Effective tax rate"
                        body="The percentage of your total gross income paid in taxes. Lower than your marginal rate because lower income brackets are taxed at lower rates."
                      />
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Info className="h-3 w-3" />
                      Marginal: {(pr.marginalFederalRate * 100).toFixed(0)}%
                      <HelpTooltip
                        title="Marginal tax rate"
                        body="The rate applied to your last dollar of income — the rate that matters for pre-tax contribution decisions."
                      />
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Info className="h-3 w-3" />
                      Combined: {(pr.marginalCombinedRate * 100).toFixed(1)}%
                    </Badge>
                  </div>

                  {/* Summary box */}
                  <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#3b82f6] font-medium flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Per paycheck
                      </span>
                      <span className="text-base font-bold text-[#3b82f6]">
                        {formatCurrency(pr.netPayPerPaycheck)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#3b82f6] font-medium">
                        Monthly
                        <span className="ml-1 text-xs text-blue-400">← flows to budget automatically</span>
                      </span>
                      <span className="text-base font-bold text-[#3b82f6]">
                        {formatCurrency(pr.netPayMonthly)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#3b82f6] font-medium">Annual</span>
                      <span className="text-base font-bold text-[#3b82f6]">
                        {formatCurrency(pr.netPayAnnual)}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 flex items-center justify-between">
                      <span className="text-xs text-blue-400">Tax savings from benefits</span>
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(pr.annualTaxSavingsFromBenefits)}/yr
                      </span>
                    </div>
                  </div>
                </>
              )}
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
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Benefit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Annual Amt</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Est. Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {benefitRows.map((row) => (
                      <tr key={row.label} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.annual)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-600">{formatCurrency(row.savings)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-green-50/50">
                      <td className="px-4 py-2.5 font-semibold text-gray-700" colSpan={2}>Total Annual Savings</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600">
                        {formatCurrency(pr.annualTaxSavingsFromBenefits)}
                      </td>
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
