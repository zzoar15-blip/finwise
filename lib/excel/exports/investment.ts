import XLSX from 'xlsx-js-style';
import { simulateInvestment } from '@/lib/calculations/invest';
import type { StoreInvestmentInputs, StorePaycheckResults } from '@/lib/calculations';
import type { InvestInputs } from '@/lib/calculations/invest';
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

export function exportInvestmentWorkbook(
  investInputs: StoreInvestmentInputs,
  paycheckResults: StorePaycheckResults
) {
  const wb = XLSX.utils.book_new();

  const inputs: InvestInputs = {
    monthlyBuy: investInputs.monthlyBuy,
    annualBonus: investInputs.annualBonus,
    dividendYield: investInputs.dividendYield,
    taxRate: investInputs.taxRate,
    qualifiedPercent: investInputs.qualifiedPercent,
    payFrequency: investInputs.payFrequency,
    years: investInputs.years,
    annualAppreciation: investInputs.annualAppreciation,
  };

  const result = simulateInvestment(inputs);

  const ws1 = buildInvestmentModelSheet(investInputs, paycheckResults, result);
  XLSX.utils.book_append_sheet(wb, ws1, 'Investment Model');

  const ws2 = buildDripScheduleSheet(result, investInputs);
  XLSX.utils.book_append_sheet(wb, ws2, 'DRIP Schedule');

  const ws3 = buildMilestoneSheet(result);
  XLSX.utils.book_append_sheet(wb, ws3, 'Milestone Analysis');

  downloadWorkbook(wb, 'finwise-invest');
}

function buildInvestmentModelSheet(
  inputs: StoreInvestmentInputs,
  pr: StorePaycheckResults,
  result: ReturnType<typeof simulateInvestment>
): XLSX.WorkSheet {
  const totalInvested = inputs.monthlyBuy * inputs.years * 12 + inputs.annualBonus * inputs.years;
  const lastAnnual = result.annual[result.annual.length - 1];
  const finalPortfolio = lastAnnual?.portfolioValue ?? 0;
  const finalGrossIncome = lastAnnual?.grossAnnualIncome ?? 0;
  const finalAfterTaxIncome = lastAnnual?.afterTaxAnnualIncome ?? 0;

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Investment Income Simulator'),
    // INPUTS
    [sectionHeaderCell('MODEL INPUTS'), blankCell()],
    [labelCell('Monthly Buy Amount'), inputCell(inputs.monthlyBuy)],
    [labelCell('Annual Bonus (February)'), inputCell(inputs.annualBonus)],
    [labelCell('Dividend Yield (%)'), inputCell(inputs.dividendYield / 100, XLS.fmt.percent)],
    [labelCell('Annual Price Appreciation (%)'), inputCell(inputs.annualAppreciation / 100, XLS.fmt.percent)],
    [labelCell('Tax Rate (Marginal %)'), inputCell(inputs.taxRate / 100, XLS.fmt.percent)],
    [labelCell('Qualified Dividends (%)'), inputCell(inputs.qualifiedPercent / 100, XLS.fmt.percent)],
    [labelCell('Pay Frequency'), cell(inputs.payFrequency === 'monthly' ? 'Monthly' : 'Quarterly', XLS.input)],
    [labelCell('Simulation Years'), inputCell(inputs.years, XLS.fmt.integer)],
    [blankCell()],
    // PAYCHECK CONTEXT
    pr.isComplete ? [sectionHeaderCell('FROM PAYCHECK DATA'), blankCell()] : [blankCell()],
    ...(pr.isComplete ? [
      [labelCell('Marginal Combined Rate'), formulaCell(pr.marginalCombinedRate, XLS.fmt.percent)],
      [labelCell('Net Monthly Take-Home'), formulaCell(pr.netPayMonthly)],
    ] : []),
    [blankCell()],
    // DERIVED METRICS
    [sectionHeaderCell('DERIVED METRICS'), blankCell()],
    [labelCell('Effective Dividend Tax Rate'), formulaCell(result.effectiveDividendTaxRate, XLS.fmt.percent)],
    [labelCell('Total Capital Invested'), formulaCell(totalInvested)],
    [labelCell(`Final Portfolio Value (Yr ${inputs.years})`), formulaCell(finalPortfolio)],
    [labelCell(`Final Annual Gross Income (Yr ${inputs.years})`), formulaCell(finalGrossIncome)],
    [labelCell(`Final Annual After-Tax Income (Yr ${inputs.years})`), formulaCell(finalAfterTaxIncome)],
    [labelCell(`Final Monthly After-Tax Income (Yr ${inputs.years})`), formulaCell(finalAfterTaxIncome / 12)],
    [blankCell()],
    // ANNUAL SUMMARY
    [columnHeaderCell('Year'), columnHeaderCell('Portfolio Value ($)'), columnHeaderCell('Gross Annual Income ($)'), columnHeaderCell('After-Tax Income ($)'), columnHeaderCell('Total Invested ($)')],
    ...result.annual.map((pt, i) => {
      const alt = i % 2 === 1;
      return [
        formulaCell(pt.year, XLS.fmt.integer, alt),
        formulaCell(pt.portfolioValue, XLS.fmt.currency, alt),
        formulaCell(pt.grossAnnualIncome, XLS.fmt.currency, alt),
        formulaCell(pt.afterTaxAnnualIncome, XLS.fmt.currency, alt),
        formulaCell(pt.totalInvested, XLS.fmt.currency, alt),
      ];
    }),
    [blankCell()],
    // INCOME TARGETS
    [sectionHeaderCell('INCOME TARGETS'), blankCell()],
    [labelCell('Portfolio needed to generate target income at various yields:'), blankCell()],
    [blankCell()],
    [columnHeaderCell('Monthly Target'), columnHeaderCell('Annual Target'), columnHeaderCell('Yield'), columnHeaderCell('Gross Portfolio Needed ($)'), columnHeaderCell('After-Tax Portfolio Needed ($)')],
    ...result.portfolioTargets.flatMap(target =>
      target.byYield.map((row, i) => {
        const alt = i % 2 === 1;
        return [
          i === 0 ? formulaCell(target.monthlyTarget, XLS.fmt.currency) : blankCell(),
          i === 0 ? formulaCell(target.monthlyTarget * 12, XLS.fmt.currency) : blankCell(),
          formulaCell(row.yield / 100, XLS.fmt.percent),
          formulaCell(row.portfolioNeeded, XLS.fmt.currency, alt),
          formulaCell(row.afterTaxPortfolioNeeded, XLS.fmt.currency, alt),
        ];
      })
    ),
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [XLS.cols.label, XLS.cols.amount, XLS.cols.amount, XLS.cols.amount, XLS.cols.amount];
  addMerge(ws, 0, 0, 0, 4);
  addMerge(ws, 1, 0, 1, 4);
  addMerge(ws, 2, 0, 2, 4);
  return ws;
}

function buildDripScheduleSheet(
  result: ReturnType<typeof simulateInvestment>,
  inputs: StoreInvestmentInputs
): XLSX.WorkSheet {
  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('DRIP Monthly Schedule'),
    [
      columnHeaderCell('Month'),
      columnHeaderCell('Date'),
      columnHeaderCell('Year'),
      columnHeaderCell('Portfolio Value ($)'),
      columnHeaderCell('Gross Income ($)'),
      columnHeaderCell('After-Tax Income ($)'),
      columnHeaderCell('Is Bonus Month?'),
      columnHeaderCell('Is Year End?'),
    ],
  ];

  for (let i = 0; i < result.monthly.length; i++) {
    const pt = result.monthly[i];
    const alt = i % 2 === 1;
    const isBonusStyle = pt.isBonus ? XLS.bonusRow : (alt ? XLS.altRow : XLS.formula);
    const isYearEndStyle = pt.isYearEnd ? XLS.milestoneRow : isBonusStyle;

    rows.push([
      cell(pt.month, alt ? XLS.altRow : XLS.formula, XLS.fmt.integer),
      cell(pt.date, alt ? XLS.altRow : XLS.formula),
      cell(pt.year, alt ? XLS.altRow : XLS.formula, XLS.fmt.integer),
      cell(pt.portfolioValue, isYearEndStyle, XLS.fmt.currency),
      cell(pt.grossMonthlyIncome, isYearEndStyle, XLS.fmt.currency),
      cell(pt.afterTaxMonthlyIncome, isYearEndStyle, XLS.fmt.currency),
      cell(pt.isBonus ? 'Yes' : '', alt ? XLS.altRow : XLS.formula),
      cell(pt.isYearEnd ? 'Yes' : '', alt ? XLS.altRow : XLS.formula),
    ]);
  }

  rows.push([blankCell()]);
  rows.push([
    labelCell('Note: Bonus month highlighted in orange, year-end in green.'),
    blankCell(), blankCell(), blankCell(), blankCell(), blankCell(), blankCell(), blankCell(),
  ]);
  rows.push([
    labelCell(`Pay Frequency: ${inputs.payFrequency === 'monthly' ? 'Monthly' : 'Quarterly (Mar/Jun/Sep/Dec)'}`),
    blankCell(), blankCell(), blankCell(), blankCell(), blankCell(), blankCell(), blankCell(),
  ]);
  rows.push([workbookFooter()[0]]);

  const ws = aoa2sheet(rows);
  ws['!cols'] = [
    XLS.cols.small, XLS.cols.date, XLS.cols.small,
    XLS.cols.amount, XLS.cols.amount, XLS.cols.amount,
    XLS.cols.small, XLS.cols.small,
  ];
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 2, ySplit: 5 };
  addMerge(ws, 0, 0, 0, 7);
  addMerge(ws, 1, 0, 1, 7);
  addMerge(ws, 2, 0, 2, 7);
  return ws;
}

function buildMilestoneSheet(
  result: ReturnType<typeof simulateInvestment>
): XLSX.WorkSheet {
  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Milestone Analysis'),
    [
      columnHeaderCell('Date'),
      columnHeaderCell('Milestone'),
      columnHeaderCell('Portfolio Value ($)'),
      columnHeaderCell('Gross Monthly Income ($)'),
      columnHeaderCell('After-Tax Monthly Income ($)'),
    ],
    ...result.milestones.map((m, i) => {
      const alt = i % 2 === 1;
      const isFeb = m.date.slice(5, 7) === '02';
      const rowStyle = isFeb ? XLS.bonusRow : (alt ? XLS.altRow : XLS.formula);

      return [
        cell(m.date, rowStyle),
        cell(m.label, { ...rowStyle, alignment: { horizontal: 'left' } }),
        cell(m.portfolioValue, rowStyle, XLS.fmt.currency),
        cell(m.grossMonthlyIncome > 0 ? m.grossMonthlyIncome : 0, rowStyle, XLS.fmt.currency),
        cell(m.afterTaxMonthlyIncome > 0 ? m.afterTaxMonthlyIncome : 0, rowStyle, XLS.fmt.currency),
      ];
    }),
    [blankCell()],
    // Income milestone targets
    [sectionHeaderCell('INCOME MILESTONE TARGETS'), blankCell()],
    [labelCell('Find the milestone when monthly income first exceeds these thresholds:'), blankCell()],
    [blankCell()],
    ...[500, 1000, 2000, 5000].map(target => {
      const milestone = result.milestones.find(m => m.afterTaxMonthlyIncome >= target);
      return [
        labelCell(`$${target.toLocaleString()}/month after-tax`),
        milestone
          ? cell(`Reached: ${milestone.date} — ${milestone.label}`, XLS.formula)
          : cell('Not reached within simulation period', { ...XLS.formula, font: { sz: 10, color: { rgb: '9ca3af' } } }),
      ];
    }),
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [XLS.cols.date, XLS.cols.desc, XLS.cols.amount, XLS.cols.amount, XLS.cols.amount];
  addMerge(ws, 0, 0, 0, 4);
  addMerge(ws, 1, 0, 1, 4);
  addMerge(ws, 2, 0, 2, 4);
  return ws;
}
