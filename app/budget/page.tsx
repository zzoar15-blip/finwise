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
import { exportDomToPdf } from '@/lib/exportPdf';
import { Button } from '@/components/ui/button';
import {
  computeUnifiedMonthlyFlow,
  getEffectivePaycheckResults,
} from '@/lib/calculations';
import { SyncMeta } from '@/components/SyncMeta';

const CHART_COLORS = {
  Housing: '#f97316',
  Debt: '#ef4444',
  Savings: '#22c55e',
  Living: '#3b82f6',
  Other: '#8b5cf6',
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
        {readOnly && <Lock className="size-3 text-muted-foreground shrink-0" />}
        {label}
        {badge && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
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
    { name: 'Living', value: totalExpenses - bi.housing, color: CHART_COLORS.Living },
  ].filter(d => d.value > 0);

  const barData = [
    { category: 'Housing', Amount: bi.housing },
    { category: 'Groceries', Amount: bi.groceries },
    { category: 'Dining', Amount: bi.dining },
    { category: 'Transport', Amount: bi.transportation },
    { category: 'Savings (bank)', Amount: optionalSavings },
    { category: 'Debt', Amount: totalDebtMinimums },
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
      ['Transportation', bi.transportation, bi.transportation * 12],
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
    <div className="mx-auto max-w-7xl space-y-6" id="tool-budget-export">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Cashflow Engine</p>
            <h1 className="mt-1 text-2xl font-semibold">Budget Planner</h1>
            <p className="mt-1 text-sm text-slate-300">
              Allocate dollars with synced plan assumptions and instant surplus impact.
            </p>
            <div className="mt-2"><SyncMeta updatedAt={planLastUpdated} badges={['Unified Flow']} /></div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <Link href="/tools/rent-vs-buy" className="text-emerald-200 hover:text-white hover:underline">
                Rent vs Buy
              </Link>
              <Link href="/tools/housing-affordability" className="text-emerald-200 hover:text-white hover:underline">
                Housing Affordability
              </Link>
              <Link href="/tools/car-affordability" className="text-emerald-200 hover:text-white hover:underline">
                Car Affordability
              </Link>
            </div>
          </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() =>
              exportDomToPdf({ elementId: 'tool-budget-export', filenamePrefix: 'finwise-budget' })
            }
          >
            Export PDF
          </Button>
          <ExportButton
            onExportXlsx={async () => {
              const { exportBudgetWorkbook } = await import('@/lib/excel/exports/budget');
              exportBudgetWorkbook(pi, pr, bi, debts);
            }}
            onExportCsv={() => downloadCsv(exportRows(), 'finwise-budget')}
          />
        </div>
      </div>
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
              <BudgetRow label="Transportation" value={bi.transportation} onChange={(v) => setBudgetInputs({ transportation: v })} />
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
                  <span className="text-muted-foreground">Savings rate (% of gross)</span>
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
                  <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
                  <Bar dataKey="Amount" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
