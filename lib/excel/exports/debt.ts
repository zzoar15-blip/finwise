import XLSX from 'xlsx-js-style';
import { simulateDebtPayoff, buildSensitivityTable } from '@/lib/calculations/debt';
import type { Debt } from '@/lib/calculations/debt';
import { XLS } from '../styles';
import {
  cell,
  labelCell,
  inputCell,
  formulaCell,
  sectionHeaderCell,
  columnHeaderCell,
  subtotalCell,
  totalLabelCell,
  totalCell,
  blankCell,
  aoa2sheet,
  addMerge,
  workbookHeader,
  workbookFooter,
  downloadWorkbook,
} from '../helpers';

export function exportDebtWorkbook(
  debts: Debt[],
  monthlyOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball'
) {
  const wb = XLSX.utils.book_new();

  const ws1 = buildDebtSummarySheet(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);
  XLSX.utils.book_append_sheet(wb, ws1, 'Debt Summary');

  const ws2 = buildAmortizationSheet(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);
  XLSX.utils.book_append_sheet(wb, ws2, 'Amortization Schedule');

  const ws3 = buildSensitivitySheet(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);
  XLSX.utils.book_append_sheet(wb, ws3, 'Sensitivity Analysis');

  downloadWorkbook(wb, `finwise-debt-${strategy}`);
}

function buildDebtSummarySheet(
  debts: Debt[],
  monthlyOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball'
): XLSX.WorkSheet {
  const result = simulateDebtPayoff(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);
  const minResult = simulateDebtPayoff(debts, 0, 0, bonusMonth, strategy);

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayments = debts.reduce((s, d) => s + d.minPayment, 0);
  const avgApr = debts.length > 0
    ? debts.reduce((s, d) => s + d.apr * d.balance, 0) / (totalBalance || 1)
    : 0;

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const strategyLabel = strategy === 'avalanche' ? 'Avalanche (Highest Rate First)' : 'Snowball (Lowest Balance First)';

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Debt Payoff Analysis'),
    // MODEL INPUTS
    [sectionHeaderCell('MODEL INPUTS'), blankCell()],
    [labelCell('Payoff Strategy'), cell(strategyLabel, XLS.input)],
    [labelCell('Monthly Overpayment'), inputCell(monthlyOverpayment)],
    [labelCell('Annual Bonus Lump Sum'), inputCell(annualBonus)],
    [labelCell('Bonus Month'), cell(MONTH_NAMES[bonusMonth - 1] || 'N/A', XLS.input)],
    [blankCell()],
    // DEBT INVENTORY
    [columnHeaderCell('Debt Name'), columnHeaderCell('Balance ($)'), columnHeaderCell('APR (%)'), columnHeaderCell('Min Payment ($)')],
    ...debts.map(d => [
      labelCell(d.name),
      formulaCell(d.balance),
      formulaCell(d.apr, XLS.fmt.percent),
      formulaCell(d.minPayment),
    ]),
    [labelCell('TOTAL'), subtotalCell(totalBalance), blankCell(), subtotalCell(totalMinPayments)],
    [blankCell()],
    // RESULTS
    [sectionHeaderCell('PAYOFF RESULTS WITH STRATEGY'), blankCell()],
    [totalLabelCell('Debt-Free Date'), cell(result.debtFreeDate, XLS.totalLabel)],
    [totalLabelCell('Months to Payoff'), cell(result.monthsToPayoff, { ...XLS.total, t: 'n' } as Record<string, unknown>)],
    [totalLabelCell('Total Interest Paid'), totalCell(result.totalInterestPaid)],
    [totalLabelCell('Interest Saved vs Minimums'), totalCell(result.interestSavedVsMinimum)],
    [blankCell()],
    // COMPARISON TABLE
    [sectionHeaderCell('COMPARISON: MINIMUMS vs STRATEGY'), blankCell()],
    [columnHeaderCell(''), columnHeaderCell('Minimums Only'), columnHeaderCell('With Strategy')],
    [labelCell('Months to Payoff'), formulaCell(minResult.monthsToPayoff, XLS.fmt.integer), formulaCell(result.monthsToPayoff, XLS.fmt.integer)],
    [labelCell('Total Interest'), formulaCell(minResult.totalInterestPaid), formulaCell(result.totalInterestPaid)],
    [labelCell('Interest Savings'), blankCell(), totalCell(result.interestSavedVsMinimum)],
    [blankCell()],
    // PORTFOLIO STATS
    [sectionHeaderCell('PORTFOLIO STATS'), blankCell()],
    [labelCell('Total Debt Balance'), formulaCell(totalBalance)],
    [labelCell('Weighted Avg APR'), formulaCell(avgApr / 100, XLS.fmt.percent)],
    [labelCell('Total Monthly Minimums'), formulaCell(totalMinPayments)],
    [labelCell('Total Monthly Payment (with extra)'), formulaCell(totalMinPayments + monthlyOverpayment)],
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [XLS.cols.label, XLS.cols.amount, XLS.cols.percent, XLS.cols.amount];
  addMerge(ws, 0, 0, 0, 3);
  addMerge(ws, 1, 0, 1, 3);
  addMerge(ws, 2, 0, 2, 3);
  return ws;
}

function buildAmortizationSheet(
  debts: Debt[],
  monthlyOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball'
): XLSX.WorkSheet {
  const result = simulateDebtPayoff(debts, monthlyOverpayment, annualBonus, bonusMonth, strategy);

  const debtHeaders = debts.map(d => columnHeaderCell(d.name));
  const numCols = 4 + debts.length;

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Amortization Schedule'),
    [
      columnHeaderCell('Month'),
      columnHeaderCell('Date'),
      ...debtHeaders,
      columnHeaderCell('Total Balance ($)'),
      columnHeaderCell('Cumulative Interest ($)'),
    ],
  ];

  for (let i = 0; i < result.snapshots.length; i++) {
    const s = result.snapshots[i];
    const alt = i % 2 === 1;
    const isPayoff = s.totalBalance < 0.01;

    rows.push([
      formulaCell(s.month, XLS.fmt.integer, alt),
      cell(s.date, alt ? XLS.altRow : XLS.formula),
      ...debts.map(d => formulaCell(s.balances[d.id] ?? 0, XLS.fmt.currency, alt)),
      isPayoff
        ? cell(0, { ...(alt ? XLS.altRow : XLS.formula), font: { sz: 10, bold: true, color: { rgb: '166534' } } }, XLS.fmt.currency)
        : formulaCell(s.totalBalance, XLS.fmt.currency, alt),
      formulaCell(s.cumulativeInterest, XLS.fmt.currency, alt),
    ]);
  }

  rows.push([blankCell()], [workbookFooter()[0]]);

  const ws = aoa2sheet(rows);
  const cols = [XLS.cols.small, XLS.cols.date, ...debts.map(() => XLS.cols.amount), XLS.cols.amount, XLS.cols.amount];
  ws['!cols'] = cols;
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 2, ySplit: 5 };

  addMerge(ws, 0, 0, 0, numCols - 1);
  addMerge(ws, 1, 0, 1, numCols - 1);
  addMerge(ws, 2, 0, 2, numCols - 1);
  return ws;
}

function buildSensitivitySheet(
  debts: Debt[],
  baseOverpayment: number,
  annualBonus: number,
  bonusMonth: number,
  strategy: 'avalanche' | 'snowball'
): XLSX.WorkSheet {
  const extraPayments = [0, 100, 200, 300, 500, 750, 1000, 1500, 2000];
  const minBudget = debts.reduce((s, d) => s + d.minPayment, 0);

  // Run sensitivity at fixed overpayment levels (not additive to base)
  const sensitivityRows = extraPayments.map(extra => {
    const r = simulateDebtPayoff(debts, extra, annualBonus, bonusMonth, strategy);
    return { extra, result: r };
  });

  // Also get baseline (minimums only) for interest saved calculations
  const baselineResult = simulateDebtPayoff(debts, 0, 0, bonusMonth, strategy);

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Sensitivity Analysis'),
    [
      columnHeaderCell('Extra Payment / Month'),
      columnHeaderCell('Total Monthly Payment'),
      columnHeaderCell('Months to Payoff'),
      columnHeaderCell('Payoff Date'),
      columnHeaderCell('Total Interest ($)'),
      columnHeaderCell('Interest Saved ($)'),
    ],
    ...sensitivityRows.map(({ extra, result }, i) => {
      const isCurrentRow = extra === baseOverpayment;
      const alt = i % 2 === 1;
      const rowStyle = isCurrentRow
        ? { font: { sz: 10, bold: true, color: { rgb: '1e3a5f' } }, fill: { patternType: 'solid', fgColor: { rgb: 'dbeafe' } }, alignment: { horizontal: 'right' }, border: XLS.formula.border }
        : alt ? XLS.altRow : XLS.formula;

      return [
        cell(extra, { ...rowStyle, alignment: { horizontal: 'left' } }, XLS.fmt.currency),
        cell(minBudget + extra, rowStyle, XLS.fmt.currency),
        cell(result.monthsToPayoff, rowStyle, XLS.fmt.integer),
        cell(result.debtFreeDate || '—', { ...rowStyle, alignment: { horizontal: 'center' } }),
        cell(result.totalInterestPaid, { ...rowStyle, font: { ...((rowStyle as Record<string, unknown>).font as Record<string, unknown> || {}), color: { rgb: 'dc2626' } } }, XLS.fmt.currency),
        cell(
          Math.max(0, (baselineResult.totalInterestPaid - result.totalInterestPaid)),
          { ...rowStyle, font: { ...((rowStyle as Record<string, unknown>).font as Record<string, unknown> || {}), color: { rgb: '166534' } } },
          XLS.fmt.currency
        ),
      ];
    }),
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [
    XLS.cols.amount, XLS.cols.amount, XLS.cols.small,
    XLS.cols.date, XLS.cols.amount, XLS.cols.amount,
  ];
  addMerge(ws, 0, 0, 0, 5);
  addMerge(ws, 1, 0, 1, 5);
  addMerge(ws, 2, 0, 2, 5);
  return ws;
}
