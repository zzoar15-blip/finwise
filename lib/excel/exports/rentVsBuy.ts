import XLSX from 'xlsx-js-style';
import type { RentVsBuyInputs, RentVsBuyResults } from '@/lib/calculations/rentVsBuy';
import { downloadWorkbook } from '../helpers';
import { XLS } from '../styles';

function verdictColor(sentiment: RentVsBuyResults['verdictSentiment']) {
  if (sentiment === 'strong-buy') return '1e3a5f';
  if (sentiment === 'lean-buy') return '2563eb';
  if (sentiment === 'neutral') return 'e5e7eb';
  if (sentiment === 'lean-rent') return 'f59e0b';
  return '111827';
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export function exportRentVsBuyWorkbook(inputs: RentVsBuyInputs, results: RentVsBuyResults) {
  const wb = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ['FinWise Rent vs. Buy Executive Summary'],
    [results.verdictHeadline],
    [results.verdictDetail],
    [],
    ['Break-even (years)', results.breakEvenYear ? results.breakEvenYear.toFixed(1) : 'Never'],
    ['Buying true monthly cost', money(results.trueMonthlyCostBuying)],
    ['Renting true monthly cost', money(results.trueMonthlyCostRenting)],
    ['Monthly difference', money(results.monthlyDifference)],
    ['Total upfront cash', money(results.totalUpfront)],
    ['Price-to-rent ratio', Number(results.priceToRentRatio.toFixed(2))],
    ['Interpretation', results.priceToRentInterpretation],
    [],
    ['Planned stay (years)', results.plannedStayResult.stayYears],
    ['Planned winner', results.plannedStayResult.winner],
    ['Buyer net worth @ planned stay', money(results.plannedStayResult.buyerNetWorth)],
    ['Renter net worth @ planned stay', money(results.plannedStayResult.renterNetWorth)],
    ['Difference', money(results.plannedStayResult.difference)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 42 }, { wch: 24 }];
  ws1.A1 = { ...ws1.A1, s: XLS.title };
  ws1.A2 = {
    ...ws1.A2,
    s: {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: verdictColor(results.verdictSentiment) } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
  XLSX.utils.book_append_sheet(wb, ws1, 'Executive Summary');

  const modelHeader = [
    'Month', 'Year', 'Home Value', 'Mortgage Balance', 'Home Equity',
    'Buyer Liquid Portfolio', 'Buyer Net Worth', 'Buyer Monthly Cost',
    'Rent', 'Renter Portfolio', 'Renter Net Worth', 'Net Worth Difference',
  ];
  const modelRows = [
    modelHeader,
    ...results.monthlyData.map((d) => [
      d.month,
      Number((d.month / 12).toFixed(2)),
      money(d.homeValue),
      money(d.mortgageBalance),
      money(d.homeEquity),
      money(d.buyerLiquidPortfolio),
      money(d.buyerNetWorth),
      money(d.buyerMonthlyCost),
      money(d.renterMonthlyCost),
      money(d.renterPortfolio),
      money(d.renterNetWorth),
      money(d.netWorthDifference),
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(modelRows);
  ws2['!cols'] = modelHeader.map(() => ({ wch: 16 }));
  const breakEvenRow = results.breakEvenMonth ? results.breakEvenMonth + 1 : -1;
  const plannedRow = Math.min(inputs.plannedStayYears * 12, 360) + 1;
  for (let r = 2; r <= 361; r++) {
    const diffCell = ws2[`L${r}`];
    if (diffCell && typeof diffCell.v === 'number') {
      diffCell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: diffCell.v >= 0 ? 'dcfce7' : 'fee2e2' } },
        font: { color: { rgb: diffCell.v >= 0 ? '166534' : '991b1b' } },
      };
    }
    if (r === breakEvenRow) {
      ws2[`A${r}`].s = { fill: { patternType: 'solid', fgColor: { rgb: '1e3a5f' } }, font: { color: { rgb: 'FFFFFF' }, bold: true } };
      ws2[`A${r}`].v = `${ws2[`A${r}`].v} BREAK-EVEN ✓`;
    }
    if (r === plannedRow) {
      ws2[`B${r}`].s = { fill: { patternType: 'solid', fgColor: { rgb: '2563eb' } }, font: { color: { rgb: 'FFFFFF' }, bold: true } };
      ws2[`B${r}`].v = `${ws2[`B${r}`].v} YOUR TIMELINE ★`;
    }
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Comparison Model');

  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Monthly Cost Breakdown'],
    [],
    ['Buying line item', 'Amount', 'Renting line item', 'Amount'],
    ['Principal & Interest', money(results.monthlyMortgagePI), 'Rent', money(results.trueMonthlyCostRenting - inputs.rentersInsuranceMonthly)],
    ['Property Tax', money(results.monthlyPropertyTax), 'Renters Insurance', money(inputs.rentersInsuranceMonthly)],
    ['Home Insurance', money(results.monthlyInsurance), '', ''],
    ['Maintenance', money(results.monthlyMaintenance), '', ''],
    ['PMI', money(results.monthlyPMI), '', ''],
    ['HOA', money(results.monthlyHOA), '', ''],
    ['Tax Deduction', -money(results.monthlyMortgageInterestDeduction), '', ''],
    ['True Monthly Cost', money(results.trueMonthlyCostBuying), 'True Monthly Cost', money(results.trueMonthlyCostRenting)],
  ]);
  ws3['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Monthly Cost Breakdown');

  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Scenarios Analysis'],
    [],
    ['Stay', 'Buyer Net Worth', 'Renter Net Worth', 'Winner', 'Difference'],
    ...results.scenarios.map((s) => [s.stayYears, money(s.buyerNetWorth), money(s.renterNetWorth), s.winner, money(s.difference)]),
  ]);
  ws4['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Scenarios Analysis');

  const sensHeader = ['Investment \\ Appreciation', '1%', '2%', '3%', '4%', '5%', '6%'];
  const sensRows: (string | number)[][] = [sensHeader];
  const irLabels = [5, 6, 7, 8, 9];
  for (let r = 0; r < results.sensitivityMatrix.length; r++) {
    sensRows.push([
      `${irLabels[r]}%`,
      ...results.sensitivityMatrix[r].map((c) => (c.breakEvenYears ? Number(c.breakEvenYears.toFixed(1)) : 'Never')),
    ]);
  }
  const ws5 = XLSX.utils.aoa_to_sheet(sensRows);
  ws5['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Sensitivity Matrix');

  const ws6 = XLSX.utils.aoa_to_sheet([
    ['Assumptions'],
    [],
    ...Object.entries(inputs).map(([k, v]) => [k, typeof v === 'number' ? money(v) : String(v)]),
    [],
    ['Methodology notes'],
    ['Month-by-month simulation over 360 months'],
    ['Buyer net worth includes selling costs'],
    ['Renter invests upfront cash and positive monthly delta'],
    ['Break-even is first month buyer net worth surpasses renter net worth'],
  ]);
  ws6['!cols'] = [{ wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws6, 'Assumptions');

  downloadWorkbook(wb, 'finwise-rent-vs-buy');
}
