import XLSX from 'xlsx-js-style';

export function downloadXlsx(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const escapeCell = (cell: string | number) => {
    const raw = String(cell);
    // Prevent spreadsheet formula injection on CSV open.
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return safe.includes(',') || safe.includes('"') || safe.includes('\n')
      ? `"${safe.replace(/"/g, '""')}"`
      : safe;
  };

  const csv = rows
    .map((row) =>
      row
        .map(escapeCell)
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadXlsxFromAoa(
  sheetName: string,
  rows: (string | number)[][],
  colWidths: number[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
  if (rows[0]?.length) {
    applyHeaderStyle(ws, `A1:${XLSX.utils.encode_col(rows[0].length - 1)}1`);
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  downloadXlsx(wb, filename);
}

function applyHeaderStyle(ws: XLSX.WorkSheet, range: string) {
  const ref = XLSX.utils.decode_range(range);
  for (let C = ref.s.c; C <= ref.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: ref.s.r, c: C })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1A56A8' } },
        alignment: { horizontal: 'center' },
      };
    }
  }
}

export interface BudgetExportRow {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
}

export function exportBudget(rows: BudgetExportRow[], month: string) {
  const sheetRows = [
    ['Category', 'Monthly Limit ($)', 'Spent ($)', 'Remaining ($)', '% Used'],
    ...rows.map((r) => [r.category, r.limit, r.spent, r.remaining, r.pct]),
    [],
    ['Total', rows.reduce((s, r) => s + r.limit, 0), rows.reduce((s, r) => s + r.spent, 0), '', ''],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  applyHeaderStyle(ws, 'A1:E1');
  XLSX.utils.book_append_sheet(wb, ws, 'Budget');
  downloadXlsx(wb, `finwise-budget-${month}`);
}

export function exportBudgetCsv(rows: BudgetExportRow[], month: string) {
  const data: (string | number)[][] = [
    ['Category', 'Monthly Limit ($)', 'Spent ($)', 'Remaining ($)', '% Used'],
    ...rows.map((r) => [r.category, r.limit, r.spent, r.remaining, r.pct]),
  ];
  downloadCsv(data, `finwise-budget-${month}`);
}

export interface DebtExportRow {
  month: number;
  label: string;
  [debtName: string]: string | number;
}

export function exportDebt(
  schedule: DebtExportRow[],
  summary: { name: string; payoffMonth: number; totalInterest: number }[],
  strategy: string,
) {
  const wb = XLSX.utils.book_new();

  // Schedule sheet
  if (schedule.length > 0) {
    const headers = Object.keys(schedule[0]);
    const ws = XLSX.utils.json_to_sheet(schedule, { header: headers });
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Schedule');
  }

  // Summary sheet
  const summaryRows = [
    ['Debt Name', 'Payoff Month', 'Total Interest Paid ($)'],
    ...summary.map((s) => [s.name, s.payoffMonth, s.totalInterest]),
    [],
    ['Strategy', strategy],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 24 }];
  applyHeaderStyle(ws2, 'A1:C1');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  downloadXlsx(wb, `finwise-debt-${strategy}`);
}

export function exportDebtCsv(
  schedule: DebtExportRow[],
  strategy: string,
) {
  if (schedule.length === 0) return;
  const headers = Object.keys(schedule[0]);
  const data: (string | number)[][] = [
    headers,
    ...schedule.map((row) => headers.map((h) => row[h])),
  ];
  downloadCsv(data, `finwise-debt-${strategy}`);
}

export interface InvestExportRow {
  year: number;
  contributions: number;
  dividends: number;
  growth: number;
  portfolioValue: number;
}

export function exportInvest(rows: InvestExportRow[], scenario: string) {
  const sheetRows = [
    ['Year', 'Annual Contributions ($)', 'Dividends ($)', 'Price Growth ($)', 'Portfolio Value ($)'],
    ...rows.map((r) => [r.year, r.contributions, r.dividends, r.growth, r.portfolioValue]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
  applyHeaderStyle(ws, 'A1:E1');
  XLSX.utils.book_append_sheet(wb, ws, 'Projection');
  downloadXlsx(wb, `finwise-invest-${scenario}`);
}

export function exportInvestCsv(rows: InvestExportRow[], scenario: string) {
  const data: (string | number)[][] = [
    ['Year', 'Annual Contributions ($)', 'Dividends ($)', 'Price Growth ($)', 'Portfolio Value ($)'],
    ...rows.map((r) => [r.year, r.contributions, r.dividends, r.growth, r.portfolioValue]),
  ];
  downloadCsv(data, `finwise-invest-${scenario}`);
}

export interface ForecastExportRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  cumulativeNet: number;
}

export function exportForecast(rows: ForecastExportRow[], scenario: string) {
  const sheetRows = [
    ['Month', 'Income ($)', 'Expenses ($)', 'Net ($)', 'Cumulative Net ($)'],
    ...rows.map((r) => [r.month, r.income, r.expenses, r.net, r.cumulativeNet]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
  applyHeaderStyle(ws, 'A1:E1');
  XLSX.utils.book_append_sheet(wb, ws, 'Forecast');
  downloadXlsx(wb, `finwise-forecast-${scenario}`);
}

export function exportForecastCsv(rows: ForecastExportRow[], scenario: string) {
  const data: (string | number)[][] = [
    ['Month', 'Income ($)', 'Expenses ($)', 'Net ($)', 'Cumulative Net ($)'],
    ...rows.map((r) => [r.month, r.income, r.expenses, r.net, r.cumulativeNet]),
  ];
  downloadCsv(data, `finwise-forecast-${scenario}`);
}
