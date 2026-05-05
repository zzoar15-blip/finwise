import XLSX from 'xlsx-js-style';
import type { StorePaycheckInputs, StorePaycheckResults, StoreBudgetInputs } from '@/lib/calculations';
import { getTotalTransportation } from '@/lib/calculations';
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

type Debt = { id: string; name: string; balance: number; apr: number; minPayment: number };

export function exportBudgetWorkbook(
  paycheckInputs: StorePaycheckInputs,
  paycheckResults: StorePaycheckResults,
  budgetInputs: StoreBudgetInputs,
  debts: Debt[]
) {
  const wb = XLSX.utils.book_new();

  const ws1 = buildBudgetModelSheet(paycheckInputs, paycheckResults, budgetInputs, debts);
  XLSX.utils.book_append_sheet(wb, ws1, 'Budget Model');

  const ws2 = buildMonthlyProjectionSheet(paycheckResults, budgetInputs, debts);
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Projection');

  const ws3 = buildTaxEfficiencySheet(paycheckInputs, paycheckResults);
  XLSX.utils.book_append_sheet(wb, ws3, 'Tax Efficiency');

  downloadWorkbook(wb, 'finwise-budget');
}

function buildBudgetModelSheet(
  pi: StorePaycheckInputs,
  pr: StorePaycheckResults,
  bi: StoreBudgetInputs,
  debts: Debt[]
): XLSX.WorkSheet {
  const PAY_PERIOD_LABELS: Record<string, string> = {
    weekly: 'Weekly (52x)', biweekly: 'Biweekly (26x)',
    semimonthly: 'Semimonthly (24x)', monthly: 'Monthly (12x)'
  };
  const PAY_PERIODS: Record<string, number> = {
    weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12
  };
  const periods = PAY_PERIODS[pi.payPeriod] || 26;
  const STATE_NAMES: Record<string, string> = {
    CA: 'California', NY: 'New York', TX: 'Texas', FL: 'Florida', MA: 'Massachusetts',
    WA: 'Washington', IL: 'Illinois', NJ: 'New Jersey', PA: 'Pennsylvania', OH: 'Ohio'
  };
  const stateName = STATE_NAMES[pi.state] || pi.state;
  const FILING_LABELS: Record<string, string> = {
    single: 'Single', married: 'Married Filing Jointly', hoh: 'Head of Household'
  };

  const totalDebtMinimums = debts.reduce((s, d) => s + d.minPayment, 0);
  const totalTransportation = getTotalTransportation(bi);
  const totalExpenses = bi.housing + bi.utilities + bi.insurance + bi.groceries + bi.dining +
    totalTransportation + bi.subscriptions + bi.phone + bi.healthGym + bi.travel + bi.misc;
  const totalSavingsPayroll = (pr.k401TraditionalAnnual + pr.k401RothAnnual) / 12 +
    pi.hsaAnnual / 12 + pi.fsaAnnual / 12;
  const totalSavingsOptional =
    bi.rothIraMonthly + bi.brokerageMonthly + bi.emergencyFundMonthly + bi.homeDownPaymentMonthly;
  const totalSavings = totalSavingsPayroll + totalSavingsOptional;
  const monthlyIncome = pr.netPayMonthly + bi.investmentIncome;
  const cashOutflows = totalExpenses + totalSavingsOptional + totalDebtMinimums;
  const monthlySurplus = monthlyIncome - cashOutflows;
  const grossAnnual = Math.max(pr.grossAnnual, 1);
  const savingsRate =
    (pr.k401TraditionalAnnual + pr.k401RothAnnual + pi.hsaAnnual + pi.fsaAnnual +
      totalSavingsOptional * 12) /
    grossAnnual;

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Budget Model'),
    // MODEL INPUTS
    [sectionHeaderCell('MODEL INPUTS'), blankCell()],
    [labelCell('Annual Salary'), inputCell(pi.annualSalary)],
    [labelCell('Pay Period'), cell(PAY_PERIOD_LABELS[pi.payPeriod] || pi.payPeriod, XLS.input)],
    [labelCell('Filing Status'), cell(FILING_LABELS[pi.filingStatus] || pi.filingStatus, XLS.input)],
    [labelCell('State'), cell(stateName, XLS.input)],
    [labelCell('Periods Per Year'), inputCell(periods, XLS.fmt.integer)],
    [cell('These cells are pre-filled from your FinWise paycheck calculator', { font: { sz: 9, italic: true, color: { rgb: '6b7280' } } })],
    [blankCell()],
    // COLUMN HEADERS
    [columnHeaderCell(''), columnHeaderCell('Monthly ($)'), columnHeaderCell('Annual ($)')],
    // GROSS INCOME
    [sectionHeaderCell('GROSS INCOME'), blankCell(), blankCell()],
    [labelCell('Annual Salary'), formulaCell(pi.annualSalary / 12), formulaCell(pi.annualSalary)],
    [labelCell('Gross Per Paycheck'), formulaCell(pr.grossPerPaycheck), formulaCell(pr.grossAnnual)],
    [blankCell()],
    // PRE-TAX DEDUCTIONS
    [sectionHeaderCell('PRE-TAX DEDUCTIONS (Annual)'), blankCell(), blankCell()],
    [labelCell('401(k) Traditional'), formulaCell(pr.k401TraditionalAnnual / 12), formulaCell(pr.k401TraditionalAnnual)],
    [labelCell('Roth 401(k)'), formulaCell(pr.k401RothAnnual / 12), formulaCell(pr.k401RothAnnual)],
    [labelCell('HSA'), formulaCell(pi.hsaAnnual / 12), formulaCell(pi.hsaAnnual)],
    [labelCell('FSA'), formulaCell(pi.fsaAnnual / 12), formulaCell(pi.fsaAnnual)],
    [labelCell('Health Insurance'), formulaCell(pi.healthInsuranceAnnual / 12), formulaCell(pi.healthInsuranceAnnual)],
    [labelCell('Dental / Vision'), formulaCell(pi.dentalAnnual / 12), formulaCell(pi.dentalAnnual)],
    [labelCell('Commuter Benefit'), formulaCell(pi.commuterAnnual / 12), formulaCell(pi.commuterAnnual)],
    [labelCell('Total Pre-Tax Deductions'), subtotalCell(pr.totalPreTaxDeductions / 12), subtotalCell(pr.totalPreTaxDeductions)],
    [blankCell()],
    // TAXES
    [sectionHeaderCell('TAXES (Annual)'), blankCell(), blankCell()],
    [labelCell('Federal Income Tax'), formulaCell(pr.federalTaxAnnual / 12), formulaCell(pr.federalTaxAnnual)],
    [labelCell('Social Security (6.2%)'), formulaCell(pr.ssAnnual / 12), formulaCell(pr.ssAnnual)],
    [labelCell('Medicare'), formulaCell(pr.medicareAnnual / 12), formulaCell(pr.medicareAnnual)],
    [labelCell('State Income Tax'), formulaCell(pr.stateTaxAnnual / 12), formulaCell(pr.stateTaxAnnual)],
    [labelCell('State Payroll Tax (PFML etc.)'), formulaCell(pr.statePfmlAnnual / 12), formulaCell(pr.statePfmlAnnual)],
    [labelCell('Total Taxes'), subtotalCell(pr.totalTaxesAnnual / 12), subtotalCell(pr.totalTaxesAnnual)],
    [blankCell()],
    // NET INCOME
    [sectionHeaderCell('NET INCOME'), blankCell(), blankCell()],
    [totalLabelCell('Monthly Net Pay'), totalCell(pr.netPayMonthly), totalCell(pr.netPayAnnual)],
    [totalLabelCell('Per Paycheck'), totalCell(pr.netPayPerPaycheck), blankCell()],
    [totalLabelCell('Effective Tax Rate'), totalCell(pr.effectiveTaxRate, XLS.fmt.percent), blankCell()],
    [totalLabelCell('Marginal Combined Rate'), totalCell(pr.marginalCombinedRate, XLS.fmt.percent), blankCell()],
    [totalLabelCell('Annual Tax Savings (Benefits)'), totalCell(pr.annualTaxSavingsFromBenefits), blankCell()],
    [blankCell()],
    // MONTHLY EXPENSES
    [sectionHeaderCell('MONTHLY EXPENSES'), blankCell(), blankCell()],
    [labelCell('Housing / Rent'), inputCell(bi.housing), formulaCell(bi.housing * 12)],
    [labelCell('Utilities'), inputCell(bi.utilities), formulaCell(bi.utilities * 12)],
    [labelCell('Insurance'), inputCell(bi.insurance), formulaCell(bi.insurance * 12)],
    [labelCell('Groceries'), inputCell(bi.groceries), formulaCell(bi.groceries * 12)],
    [labelCell('Dining Out'), inputCell(bi.dining), formulaCell(bi.dining * 12)],
    [labelCell('Car payment (loan/lease)'), inputCell(bi.carPayment), formulaCell(bi.carPayment * 12)],
    [labelCell('Car insurance'), inputCell(bi.carInsurance), formulaCell(bi.carInsurance * 12)],
    [labelCell('Gas / fuel'), inputCell(bi.gas), formulaCell(bi.gas * 12)],
    [labelCell('Parking & tolls'), inputCell(bi.parking), formulaCell(bi.parking * 12)],
    [labelCell('Public transit'), inputCell(bi.publicTransit), formulaCell(bi.publicTransit * 12)],
    [labelCell('Other transportation'), inputCell(bi.otherTransport), formulaCell(bi.otherTransport * 12)],
    [labelCell('Total Transportation'), subtotalCell(totalTransportation), subtotalCell(totalTransportation * 12)],
    [labelCell('Subscriptions'), inputCell(bi.subscriptions), formulaCell(bi.subscriptions * 12)],
    [labelCell('Phone'), inputCell(bi.phone), formulaCell(bi.phone * 12)],
    [labelCell('Health / Gym'), inputCell(bi.healthGym), formulaCell(bi.healthGym * 12)],
    [labelCell('Travel'), inputCell(bi.travel), formulaCell(bi.travel * 12)],
    [labelCell('Miscellaneous'), inputCell(bi.misc), formulaCell(bi.misc * 12)],
    [labelCell('Total Living Expenses'), subtotalCell(totalExpenses), subtotalCell(totalExpenses * 12)],
    [blankCell()],
    [sectionHeaderCell('SAVINGS & INVESTMENTS'), blankCell(), blankCell()],
    [labelCell('401(k) Traditional (via payroll)'), formulaCell(pr.k401TraditionalAnnual / 12), formulaCell(pr.k401TraditionalAnnual)],
    [labelCell('Roth 401(k) (via payroll)'), formulaCell(pr.k401RothAnnual / 12), formulaCell(pr.k401RothAnnual)],
    [labelCell('HSA (via payroll)'), formulaCell(pi.hsaAnnual / 12), formulaCell(pi.hsaAnnual)],
    [labelCell('FSA (via payroll)'), formulaCell(pi.fsaAnnual / 12), formulaCell(pi.fsaAnnual)],
    [labelCell('Roth IRA'), inputCell(bi.rothIraMonthly), formulaCell(bi.rothIraMonthly * 12)],
    [labelCell('Brokerage / Investments'), inputCell(bi.brokerageMonthly), formulaCell(bi.brokerageMonthly * 12)],
    [labelCell('Emergency Fund'), inputCell(bi.emergencyFundMonthly), formulaCell(bi.emergencyFundMonthly * 12)],
    [labelCell('Emergency fund — current balance'), inputCell(bi.emergencyFundBalance ?? 0), blankCell()],
    [labelCell('Home Down Payment Fund'), inputCell(bi.homeDownPaymentMonthly), formulaCell(bi.homeDownPaymentMonthly * 12)],
    [cell('Subtotal — payroll savings (included in net pay above)', { font: { sz: 9, italic: true, color: { rgb: '6b7280' } } }), formulaCell(totalSavingsPayroll), formulaCell(totalSavingsPayroll * 12)],
    [labelCell('Total savings & investments (all channels)'), subtotalCell(totalSavings), subtotalCell(totalSavings * 12)],
    [blankCell()],
    [sectionHeaderCell('DEBT PAYMENTS'), blankCell(), blankCell()],
    ...debts.map(d => [labelCell(d.name), inputCell(d.minPayment), formulaCell(d.minPayment * 12)]),
    [labelCell('Total Debt Payments'), subtotalCell(totalDebtMinimums), subtotalCell(totalDebtMinimums * 12)],
    [blankCell()],
    // SUMMARY
    [sectionHeaderCell('SUMMARY'), blankCell(), blankCell()],
    [totalLabelCell('Cash outflows (expenses + bank savings + debt)'), totalCell(cashOutflows), totalCell(cashOutflows * 12)],
    [totalLabelCell('Monthly Surplus / (Deficit)'), cell(monthlySurplus, { ...XLS.total, font: { ...XLS.total.font, color: { rgb: monthlySurplus >= 0 ? '86efac' : 'fca5a5' } } }, XLS.fmt.currencyNeg), cell(monthlySurplus * 12, { ...XLS.total, font: { ...XLS.total.font, color: { rgb: monthlySurplus >= 0 ? '86efac' : 'fca5a5' } } }, XLS.fmt.currencyNeg)],
    [totalLabelCell('Savings rate (% of gross)'), totalCell(savingsRate, XLS.fmt.percent), blankCell()],
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [XLS.cols.label, XLS.cols.amount, XLS.cols.amount];
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 1, ySplit: 10 };

  // Merge header rows across columns
  addMerge(ws, 0, 0, 0, 2);
  addMerge(ws, 1, 0, 1, 2);
  addMerge(ws, 2, 0, 2, 2);

  return ws;
}

function buildMonthlyProjectionSheet(
  pr: StorePaycheckResults,
  bi: StoreBudgetInputs,
  debts: Debt[]
): XLSX.WorkSheet {
  const totalDebtMinimums = debts.reduce((s, d) => s + d.minPayment, 0);
  const totalTransportation = getTotalTransportation(bi);
  const totalExpenses = bi.housing + bi.utilities + bi.insurance + bi.groceries + bi.dining +
    totalTransportation + bi.subscriptions + bi.phone + bi.healthGym + bi.travel + bi.misc;
  const optionalMonthly =
    bi.rothIraMonthly + bi.brokerageMonthly + bi.emergencyFundMonthly + bi.homeDownPaymentMonthly;
  const monthlyIncome = pr.netPayMonthly + bi.investmentIncome;
  const monthlySurplus = monthlyIncome - totalExpenses - optionalMonthly - totalDebtMinimums;
  const savingsFromBank = optionalMonthly;

  const today = new Date();
  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Monthly Projection'),
    [
      columnHeaderCell('Month'),
      columnHeaderCell('Date'),
      columnHeaderCell('Income (net + inv.)'),
      columnHeaderCell('Living Expenses'),
      columnHeaderCell('Debt Pmts'),
      columnHeaderCell('Bank savings'),
      columnHeaderCell('Total Out'),
      columnHeaderCell('Surplus'),
      columnHeaderCell('Cum Surplus'),
      columnHeaderCell('Cum Savings'),
    ],
  ];

  let cumSurplus = 0;
  let cumSavings = 0;
  for (let m = 0; m < 12; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    cumSurplus += monthlySurplus;
    cumSavings += savingsFromBank;
    const alt = m % 2 === 1;
    rows.push([
      formulaCell(m + 1, XLS.fmt.integer, alt),
      cell(dateStr, alt ? XLS.altRow : XLS.formula),
      formulaCell(monthlyIncome, XLS.fmt.currency, alt),
      formulaCell(totalExpenses, XLS.fmt.currency, alt),
      formulaCell(totalDebtMinimums, XLS.fmt.currency, alt),
      formulaCell(savingsFromBank, XLS.fmt.currency, alt),
      formulaCell(totalExpenses + totalDebtMinimums + savingsFromBank, XLS.fmt.currency, alt),
      cell(monthlySurplus, { ...(alt ? XLS.altRow : XLS.formula), font: { sz: 10, color: { rgb: monthlySurplus >= 0 ? '166534' : 'dc2626' } } }, XLS.fmt.currency),
      cell(cumSurplus, { ...(alt ? XLS.altRow : XLS.formula), font: { sz: 10, color: { rgb: cumSurplus >= 0 ? '166534' : 'dc2626' } } }, XLS.fmt.currency),
      formulaCell(cumSavings, XLS.fmt.currency, alt),
    ]);
  }

  rows.push([blankCell()], [workbookFooter()[0]]);

  const ws = aoa2sheet(rows);
  ws['!cols'] = [
    XLS.cols.small, XLS.cols.date, XLS.cols.amount, XLS.cols.amount,
    XLS.cols.amount, XLS.cols.amount, XLS.cols.amount,
    XLS.cols.amount, XLS.cols.amount, XLS.cols.amount,
  ];
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 2, ySplit: 5 };
  addMerge(ws, 0, 0, 0, 9);
  addMerge(ws, 1, 0, 1, 9);
  addMerge(ws, 2, 0, 2, 9);
  return ws;
}

function buildTaxEfficiencySheet(
  pi: StorePaycheckInputs,
  pr: StorePaycheckResults
): XLSX.WorkSheet {
  const marginal = pr.marginalCombinedRate;
  const ficaRate = 0.0765;

  const benefits = [
    { name: 'HSA', current: pi.hsaAnnual, limit: 4300, rate: marginal + ficaRate },
    { name: '401(k) Traditional', current: pr.k401TraditionalAnnual, limit: 23500, rate: marginal },
    { name: 'FSA', current: pi.fsaAnnual, limit: 3300, rate: marginal + ficaRate },
    { name: 'Commuter Benefit', current: pi.commuterAnnual, limit: 3900, rate: marginal + ficaRate },
  ];
  const totalOpportunity = benefits.reduce((s, b) => s + Math.max(0, b.limit - b.current) * b.rate, 0);

  const rows: XLSX.CellObject[][] = [
    ...workbookHeader('Tax Efficiency Analysis'),
    [
      columnHeaderCell('Benefit'),
      columnHeaderCell('Current Annual ($)'),
      columnHeaderCell('IRS Maximum ($)'),
      columnHeaderCell('Gap ($)'),
      columnHeaderCell('Tax Rate'),
      columnHeaderCell('Annual Savings Opportunity ($)'),
    ],
    ...benefits.map(b => {
      const gap = Math.max(0, b.limit - b.current);
      const savings = gap * b.rate;
      return [
        labelCell(b.name),
        formulaCell(b.current),
        formulaCell(b.limit),
        formulaCell(gap),
        formulaCell(b.rate, XLS.fmt.percent),
        formulaCell(savings),
      ];
    }),
    [
      totalLabelCell('TOTAL OPPORTUNITY'),
      totalCell(benefits.reduce((s, b) => s + b.current, 0)),
      totalCell(benefits.reduce((s, b) => s + b.limit, 0)),
      totalCell(benefits.reduce((s, b) => s + Math.max(0, b.limit - b.current), 0)),
      blankCell(),
      totalCell(totalOpportunity),
    ],
    [blankCell()],
    [cell(
      `You are leaving ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalOpportunity)} in tax savings on the table annually`,
      { font: { sz: 11, bold: true, color: { rgb: 'dc2626' } }, alignment: { horizontal: 'left' } }
    )],
    [blankCell()],
    [workbookFooter()[0]],
  ];

  const ws = aoa2sheet(rows);
  ws['!cols'] = [
    XLS.cols.label, XLS.cols.amount, XLS.cols.amount,
    XLS.cols.amount, XLS.cols.percent, XLS.cols.amount,
  ];
  addMerge(ws, 0, 0, 0, 5);
  addMerge(ws, 1, 0, 1, 5);
  addMerge(ws, 2, 0, 2, 5);
  return ws;
}
