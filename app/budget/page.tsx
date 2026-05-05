'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { useFinWiseStore } from '@/lib/store';
import { usePlanStore } from '@/lib/planStore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { ExportButton } from '@/components/ExportButton';
import { downloadCsv } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { SimpleRowsPDF } from '@/lib/pdf/SimpleRowsPDF';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  computeUnifiedMonthlyFlow,
  getTotalTransportation,
  getEffectivePaycheckResults,
} from '@/lib/calculations';
import { SyncMeta } from '@/components/SyncMeta';
import { EmptyChart } from '@/components/ui/empty-chart';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const CHART_COLORS = {
  Debt: '#0f172a',
  Housing: '#3b82f6',
  Living: '#64748b',
  Savings: '#16a34a',
  Surplus: '#dbeafe',
};

function savingsRateColor(rate: number) {
  if (rate >= 20) return 'bg-green-100 text-green-800';
  if (rate >= 10) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function NumericInput({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <span className="w-28 text-right text-sm font-medium text-gray-700 tabular-nums">
        {formatCurrency(value)}
      </span>
    );
  }
  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange && onChange(parseFloat(e.target.value) || 0)}
      className="w-28 text-right"
    />
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Separator className="mt-1" />
    </div>
  );
}

function BudgetRow({
  label,
  value,
  onChange,
  readOnly = false,
  badge,
  linkTo,
}: {
  label: string;
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  badge?: string;
  linkTo?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex items-center gap-1.5 text-sm text-foreground/80 min-w-0 flex-1">
        {readOnly && <Lock className="size-2.5 text-[#1e40af] shrink-0" />}
        {label}
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#dbeafe] px-2 py-0.5 text-[11px] font-medium text-[#1e40af]">
            <Lock className="size-2.5" />
            {badge}
          </span>
        )}
        {linkTo && (
          <Link href={linkTo} className="text-xs text-blue-500 hover:text-blue-700 ml-1">
            →
          </Link>
        )}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-muted-foreground">$</span>
        <NumericInput value={value} onChange={onChange} readOnly={readOnly} />
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const paycheckResults = useFinWiseStore((s) => s.paycheckResults);
  const paycheckInputs = useFinWiseStore((s) => s.paycheckInputs);
  const budgetInputs = useFinWiseStore((s) => s.budgetInputs);
  const setBudgetInputs = useFinWiseStore((s) => s.setBudgetInputs);
  const debts = useFinWiseStore((s) => s.debts);
  const planLastUpdated = useFinWiseStore((s) => s.planLastUpdated);
  const sinkingFundInputs = useFinWiseStore((s) => s.sinkingFundInputs);
  const sinkingFundResults = useFinWiseStore((s) => s.sinkingFundResults);
  const plan = usePlanStore((s) => s.plan);

  const pr = getEffectivePaycheckResults(paycheckInputs, paycheckResults);
  const pi = paycheckInputs;
  const bi = budgetInputs;
  const totalTransportation = getTotalTransportation(bi);

  // Derived values
  const flow = computeUnifiedMonthlyFlow(pi, pr, bi, debts);
  const totalDebtMinimums = flow.debtMinimums;
  const totalExpenses = flow.totalExpenses;
  const payrollSavingsMonthly = (pr.k401TraditionalAnnual + pr.k401RothAnnual) / 12 +
    pi.hsaAnnual / 12 + pi.fsaAnnual / 12;
  const optionalSavings = flow.optionalSavings;
  const monthlyIncome = flow.monthlyIncome;
  const monthlySurplus = flow.monthlySurplus;
  const savingsRate = flow.savingsRate;
  const sinkingFundDrivenHomeMonthly = useMemo(() => {
    if (sinkingFundInputs.goalType !== 'down-payment') return null;
    const monthly =
      sinkingFundInputs.mode === 'target-date'
        ? sinkingFundResults.requiredMonthlyContribution
        : sinkingFundInputs.monthlyContribution;
    return Math.max(0, Math.round(monthly));
  }, [sinkingFundInputs.goalType, sinkingFundInputs.mode, sinkingFundInputs.monthlyContribution, sinkingFundResults.requiredMonthlyContribution]);
  const homeGoalSuggestedMonthly = useMemo(() => {
    if (sinkingFundDrivenHomeMonthly !== null) return sinkingFundDrivenHomeMonthly;
    const target = plan?.inputs?.homeTarget ?? 0;
    const hasHomeGoal = plan?.inputs?.goals?.includes('save-home') ?? false;
    if (!hasHomeGoal || target <= 0) return 0;
    return Math.ceil(target / Math.max(1, plan?.inputs?.homeTimelineMonths || 36));
  }, [sinkingFundDrivenHomeMonthly, plan?.inputs?.goals, plan?.inputs?.homeTarget, plan?.inputs?.homeTimelineMonths]);
  const homeGoalSuggestionSource = sinkingFundDrivenHomeMonthly !== null
    ? 'Sinking Fund'
    : homeGoalSuggestedMonthly > 0
      ? 'Plan Goal'
      : null;
  const syncedEmergencyGoalMonthly = useMemo(() => {
    const target = plan?.inputs?.emergencyFundTarget ?? 0;
    const hasEmergencyGoal = plan?.inputs?.goals?.includes('emergency-fund') ?? false;
    if (!hasEmergencyGoal || target <= 0) return 0;
    return Math.ceil(target / 12);
  }, [plan?.inputs?.goals, plan?.inputs?.emergencyFundTarget]);

  useEffect(() => {
    if (syncedEmergencyGoalMonthly <= 0) return;
    if (budgetInputs.emergencyFundMonthly === syncedEmergencyGoalMonthly) return;
    setBudgetInputs({ emergencyFundMonthly: syncedEmergencyGoalMonthly });
  }, [syncedEmergencyGoalMonthly, budgetInputs.emergencyFundMonthly, setBudgetInputs]);

  // Chart data — optional savings + debt + living; housing called out in pie
  const pieData = [
    { name: 'Housing', value: bi.housing, color: CHART_COLORS.Housing },
    { name: 'Debt', value: totalDebtMinimums, color: CHART_COLORS.Debt },
    { name: 'Savings (from bank)', value: optionalSavings, color: CHART_COLORS.Savings },
    { name: 'Transportation', value: totalTransportation, color: CHART_COLORS.Living },
    { name: 'Living', value: Math.max(0, totalExpenses - bi.housing - totalTransportation), color: CHART_COLORS.Living },
  ].filter(d => d.value > 0);

  const barData = [
    { category: 'Housing', Amount: bi.housing, color: CHART_COLORS.Housing },
    { category: 'Transportation', Amount: totalTransportation, color: CHART_COLORS.Living },
    { category: 'Living', Amount: Math.max(0, totalExpenses - bi.housing - totalTransportation), color: CHART_COLORS.Living },
    { category: 'Savings', Amount: optionalSavings, color: CHART_COLORS.Savings },
    { category: 'Debt', Amount: totalDebtMinimums, color: CHART_COLORS.Debt },
    { category: 'Surplus', Amount: Math.max(0, monthlySurplus), color: CHART_COLORS.Surplus },
  ].filter(d => d.Amount > 0);

  function exportRows(): (string | number)[][] {
    return [
      ['Category', 'Monthly ($)', 'Annual ($)'],
      ['Take-home Pay', pr.netPayMonthly, pr.netPayAnnual],
      ['Investment Income', bi.investmentIncome, bi.investmentIncome * 12],
      ['Total Income', monthlyIncome, monthlyIncome * 12],
      [''],
      ['EXPENSES', '', ''],
      ['Housing', bi.housing, bi.housing * 12],
      ['Utilities', bi.utilities, bi.utilities * 12],
      ['Insurance', bi.insurance, bi.insurance * 12],
      ['Groceries', bi.groceries, bi.groceries * 12],
      ['Dining Out', bi.dining, bi.dining * 12],
      ['Car payment (loan/lease)', bi.carPayment, bi.carPayment * 12],
      ['Car insurance', bi.carInsurance, bi.carInsurance * 12],
      ['Gas / fuel', bi.gas, bi.gas * 12],
      ['Parking & tolls', bi.parking, bi.parking * 12],
      ['Public transit', bi.publicTransit, bi.publicTransit * 12],
      ['Other transportation', bi.otherTransport, bi.otherTransport * 12],
      ['Total Transportation', totalTransportation, totalTransportation * 12],
      ['Subscriptions', bi.subscriptions, bi.subscriptions * 12],
      ['Phone', bi.phone, bi.phone * 12],
      ['Health/Gym', bi.healthGym, bi.healthGym * 12],
      ['Travel', bi.travel, bi.travel * 12],
      ['Misc', bi.misc, bi.misc * 12],
      ['Total Expenses', totalExpenses, totalExpenses * 12],
      [''],
      ['SAVINGS', '', ''],
      ['401(k) Traditional (payroll)', pr.k401TraditionalAnnual / 12, pr.k401TraditionalAnnual],
      ['Roth 401(k) (payroll)', pr.k401RothAnnual / 12, pr.k401RothAnnual],
      ['HSA (payroll)', pi.hsaAnnual / 12, pi.hsaAnnual],
      ['FSA (payroll)', pi.fsaAnnual / 12, pi.fsaAnnual],
      ['Roth IRA', bi.rothIraMonthly, bi.rothIraMonthly * 12],
      ['Brokerage', bi.brokerageMonthly, bi.brokerageMonthly * 12],
      ['Emergency Fund', bi.emergencyFundMonthly, bi.emergencyFundMonthly * 12],
      ['Home Down Payment Fund', bi.homeDownPaymentMonthly, bi.homeDownPaymentMonthly * 12],
      ['Payroll savings (401k/HSA/FSA; in net pay)', payrollSavingsMonthly, payrollSavingsMonthly * 12],
      ['Savings from bank (surplus calc)', optionalSavings, optionalSavings * 12],
      ['Total savings (all channels)', payrollSavingsMonthly + optionalSavings, (payrollSavingsMonthly + optionalSavings) * 12],
      [''],
      ['Debt Payments', totalDebtMinimums, totalDebtMinimums * 12],
      [''],
      ['Monthly Surplus / (Deficit)', monthlySurplus, monthlySurplus * 12],
      ['Savings rate (% of gross)', `${savingsRate.toFixed(1)}%`, ''],
    ];
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8" id="tool-budget-export">
      <PageHeader
        title="Budget Planner"
        subtitle="Allocate dollars with synced plan assumptions and instant surplus impact."
        actions={
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <PDFDownloadButton
            className="flex-1 sm:flex-none"
            label="Export PDF"
            document={<SimpleRowsPDF title="Budget Planner" rows={exportRows()} />}
            fileName={`finwise-budget-${new Date().toISOString().slice(0, 10)}.pdf`}
          />
          <ExportButton
            onExportXlsx={async () => {
              const { exportBudgetWorkbook } = await import('@/lib/excel/exports/budget');
              exportBudgetWorkbook(pi, pr, bi, debts);
            }}
            onExportCsv={() => downloadCsv(exportRows(), 'finwise-budget')}
          />
          </div>
        }
      />
      <div className="px-8">
        <div className="mb-2"><SyncMeta updatedAt={planLastUpdated} badges={['Unified Flow']} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT PANEL — Inputs */}
        <div className="space-y-4">
          {/* Sync Banner */}
          {pr.isComplete ? (
            <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle className="size-4 shrink-0 mt-0.5 text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Synced from paycheck calculator</p>
                <p className="text-green-700 mt-0.5">
                  Take-home: {formatCurrency(pr.netPayMonthly)}/mo &nbsp;|&nbsp; Effective rate: {(pr.effectiveTaxRate * 100).toFixed(1)}%
                </p>
                <Link href="/paycheck" className="text-green-600 hover:text-green-800 font-medium mt-1 inline-block">
                  Update paycheck →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium">Complete the paycheck calculator to auto-fill your income</p>
                <Link href="/paycheck" className="text-amber-700 hover:text-amber-900 font-medium mt-1 inline-block">
                  Set up paycheck →
                </Link>
              </div>
            </div>
          )}

          {homeGoalSuggestedMonthly > 0 && budgetInputs.homeDownPaymentMonthly !== homeGoalSuggestedMonthly && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div>
                <p className="font-medium">Home down payment suggestion available</p>
                <p className="text-blue-800 mt-0.5">
                  {formatCurrency(homeGoalSuggestedMonthly)}/mo from {homeGoalSuggestionSource}.
                  Apply it, or keep your custom value to compare financial impact.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                onClick={() => setBudgetInputs({ homeDownPaymentMonthly: homeGoalSuggestedMonthly })}
              >
                Apply
              </Button>
            </div>
          )}

          <Card className="shadow-sm">
            <CardContent className="space-y-0.5 pt-4">
              {/* INCOME */}
              <SectionLabel label="Income" />
              <BudgetRow
                label="Take-home pay"
                value={pr.netPayMonthly}
                readOnly
                linkTo="/paycheck"
              />
              <BudgetRow
                label="Investment income"
                value={bi.investmentIncome}
                onChange={(v) => setBudgetInputs({ investmentIncome: v })}
              />
              <div className="-mt-1 mb-1 pl-1">
                <HelpTooltip
                  title="Investment income"
                  body="Dividend income, interest, or other investment distributions you receive monthly. This supplements your take-home pay."
                />
              </div>
              <div className="flex items-center justify-between py-1.5 border-t border-gray-200 mt-1 pt-2.5">
                <span className="text-sm font-semibold text-gray-700">Total Income</span>
                <span className="text-sm font-bold text-gray-800 tabular-nums">
                  {formatCurrency(monthlyIncome)}
                </span>
              </div>

              {/* SAVINGS */}
              <SectionLabel label="Savings & Investments" />
              <BudgetRow
                label="401(k) Traditional"
                value={pr.k401TraditionalAnnual / 12}
                readOnly
                badge="Via payroll"
              />
              <BudgetRow
                label="Roth 401(k)"
                value={pr.k401RothAnnual / 12}
                readOnly
                badge="Via payroll"
              />
              <BudgetRow
                label="HSA"
                value={pi.hsaAnnual / 12}
                readOnly
                badge="Via payroll"
              />
              <BudgetRow
                label="FSA"
                value={pi.fsaAnnual / 12}
                readOnly
                badge="Via payroll"
              />
              <BudgetRow
                label="Roth IRA"
                value={bi.rothIraMonthly}
                onChange={(v) => setBudgetInputs({ rothIraMonthly: v })}
              />
              <BudgetRow
                label="Brokerage"
                value={bi.brokerageMonthly}
                onChange={(v) => setBudgetInputs({ brokerageMonthly: v })}
              />
              <BudgetRow
                label="Emergency Fund"
                value={bi.emergencyFundMonthly}
                onChange={(v) => setBudgetInputs({ emergencyFundMonthly: v })}
                badge={syncedEmergencyGoalMonthly > 0 ? 'Synced from Plan Goal' : undefined}
              />
              <BudgetRow
                label="Home Down Payment Fund"
                value={bi.homeDownPaymentMonthly}
                onChange={(v) => setBudgetInputs({ homeDownPaymentMonthly: v })}
                badge={
                  homeGoalSuggestedMonthly > 0
                    ? sinkingFundDrivenHomeMonthly !== null
                      ? 'Suggested from Sinking Fund'
                      : 'Suggested from Plan Goal'
                    : undefined
                }
                linkTo={sinkingFundDrivenHomeMonthly !== null ? '/tools/sinking-fund' : undefined}
              />

              {/* EXPENSES */}
              <SectionLabel label="Living Expenses" />
              <BudgetRow label="Housing / Rent" value={bi.housing} onChange={(v) => setBudgetInputs({ housing: v })} />
              <BudgetRow label="Utilities" value={bi.utilities} onChange={(v) => setBudgetInputs({ utilities: v })} />
              <BudgetRow label="Insurance" value={bi.insurance} onChange={(v) => setBudgetInputs({ insurance: v })} />
              <BudgetRow label="Groceries" value={bi.groceries} onChange={(v) => setBudgetInputs({ groceries: v })} />
              <BudgetRow label="Dining Out" value={bi.dining} onChange={(v) => setBudgetInputs({ dining: v })} />
              <SectionLabel label="Transportation" />
              <BudgetRow label="Car payment (loan/lease)" value={bi.carPayment} onChange={(v) => setBudgetInputs({ carPayment: v })} />
              <BudgetRow label="Car insurance" value={bi.carInsurance} onChange={(v) => setBudgetInputs({ carInsurance: v })} />
              <BudgetRow label="Gas / fuel" value={bi.gas} onChange={(v) => setBudgetInputs({ gas: v })} />
              <BudgetRow label="Parking & tolls" value={bi.parking} onChange={(v) => setBudgetInputs({ parking: v })} />
              <BudgetRow label="Public transit" value={bi.publicTransit} onChange={(v) => setBudgetInputs({ publicTransit: v })} />
              <BudgetRow label="Other (maintenance, etc.)" value={bi.otherTransport} onChange={(v) => setBudgetInputs({ otherTransport: v })} />
              <BudgetRow label="Total Transportation" value={totalTransportation} readOnly />
              <SectionLabel label="Other Living Expenses" />
              <BudgetRow label="Subscriptions" value={bi.subscriptions} onChange={(v) => setBudgetInputs({ subscriptions: v })} />
              <BudgetRow label="Phone" value={bi.phone} onChange={(v) => setBudgetInputs({ phone: v })} />
              <BudgetRow label="Health / Gym" value={bi.healthGym} onChange={(v) => setBudgetInputs({ healthGym: v })} />
              <BudgetRow label="Travel" value={bi.travel} onChange={(v) => setBudgetInputs({ travel: v })} />
              <BudgetRow label="Miscellaneous" value={bi.misc} onChange={(v) => setBudgetInputs({ misc: v })} />

              {/* DEBT */}
              {debts.length > 0 && (
                <>
                  <SectionLabel label="Debt Payments" />
                  {debts.map(d => (
                    <BudgetRow
                      key={d.id}
                      label={d.name}
                      value={d.minPayment}
                      readOnly
                    />
                  ))}
                  <div className="flex items-center justify-between py-1 text-sm text-muted-foreground">
                    <span>Total Debt Minimums</span>
                    <span className="tabular-nums font-medium">{formatCurrency(totalDebtMinimums)}</span>
                  </div>
                  <Link href="/debt" className="text-xs text-blue-500 hover:text-blue-700">
                    From debt simulator →
                  </Link>
                </>
              )}

              {/* SUMMARY */}
              <div className="mt-4 rounded-lg bg-muted/50 p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Income</span>
                  <span className="font-medium tabular-nums">{formatCurrency(monthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Living Expenses</span>
                  <span className="font-medium tabular-nums">{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Debt Payments</span>
                  <span className="font-medium tabular-nums">{formatCurrency(totalDebtMinimums)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payroll savings (in net pay)</span>
                  <span className="font-medium tabular-nums text-muted-foreground">{formatCurrency(payrollSavingsMonthly)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Savings from bank</span>
                  <span className="font-medium tabular-nums">{formatCurrency(optionalSavings)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Monthly Surplus</span>
                  <span className={monthlySurplus >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {monthlySurplus >= 0 ? '+' : ''}{formatCurrency(monthlySurplus)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Savings rate (% of gross)
                    <HelpTooltip
                      title="Savings rate"
                      body="Percentage of take-home pay going to savings and investments. Financial advisors generally recommend 20%+."
                    />
                  </span>
                  <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold ${savingsRateColor(savingsRate)}`}>
                    {savingsRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL — Charts */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Spending Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Based on take-home: 401(k)/HSA/FSA are already reflected in net pay and are not double-counted in surplus.
              </p>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <EmptyChart
                  icon={PieIcon}
                  title="No budget data yet"
                  description="Add your expenses to see the breakdown"
                  ctaLabel="Set up budget"
                  ctaHref="/budget"
                  height={220}
                />
              ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as { name: string; value: number } | undefined;
                      if (!point) return null;
                      if (point.name !== 'Transportation') {
                        return (
                          <div className="rounded-md border bg-white p-2 text-xs shadow-sm">
                            <div>{point.name}</div>
                            <div className="font-semibold">{formatCurrency(point.value)}</div>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-0.5 rounded-md border bg-white p-2 text-xs shadow-sm">
                          <div className="font-semibold">Transportation</div>
                          <div>Car payment: {formatCurrency(bi.carPayment)}</div>
                          <div>Insurance: {formatCurrency(bi.carInsurance)}</div>
                          <div>Gas: {formatCurrency(bi.gas)}</div>
                          <div>Parking: {formatCurrency(bi.parking)}</div>
                          <div>Transit: {formatCurrency(bi.publicTransit)}</div>
                          <div>Other: {formatCurrency(bi.otherTransport)}</div>
                          <div className="font-semibold">Total: {formatCurrency(totalTransportation)}</div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <EmptyChart
                  icon={BarChart3}
                  title="No budget data yet"
                  description="Add your expenses to see the breakdown"
                  ctaLabel="Set up budget"
                  ctaHref="/budget"
                  height={240}
                />
              ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
                  <Bar dataKey="Amount" radius={[3, 3, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Summary card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Annual Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: 'Annual Income', value: monthlyIncome * 12 },
                  { label: 'Annual Expenses', value: totalExpenses * 12 },
                  { label: 'Annual savings (payroll + bank)', value: (payrollSavingsMonthly + optionalSavings) * 12 },
                  { label: 'Annual Debt Payments', value: totalDebtMinimums * 12 },
                  { label: 'Annual Surplus', value: monthlySurplus * 12, isSurplus: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-medium tabular-nums ${
                      'isSurplus' in row && row.isSurplus
                        ? row.value >= 0 ? 'text-green-600' : 'text-red-600'
                        : ''
                    }`}>
                      {formatCurrency(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
