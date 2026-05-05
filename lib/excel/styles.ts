export const XLS = {
  title: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0f172a' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: '000000' } } } },
  subtitle: { font: { bold: false, sz: 11, italic: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0f172a' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  sectionHeader: { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '1e3a5f' } }, border: { bottom: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  columnHeader: { font: { bold: true, sz: 10, color: { rgb: '1e3a5f' } }, fill: { patternType: 'solid', fgColor: { rgb: 'dbeafe' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: 'd1d5db' } }, bottom: { style: 'medium', color: { rgb: '1e3a5f' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  input: { font: { sz: 10, color: { rgb: '000000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'fefce8' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'd1d5db' } }, bottom: { style: 'thin', color: { rgb: 'd1d5db' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  formula: { font: { sz: 10, color: { rgb: '000000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'd1d5db' } }, bottom: { style: 'thin', color: { rgb: 'd1d5db' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  label: { font: { sz: 10, color: { rgb: '374151' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'd1d5db' } }, bottom: { style: 'thin', color: { rgb: 'd1d5db' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  altRow: { font: { sz: 10, color: { rgb: '000000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'f8fafc' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'd1d5db' } }, bottom: { style: 'thin', color: { rgb: 'd1d5db' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  subtotal: { font: { bold: true, sz: 10, color: { rgb: '1e3a5f' } }, fill: { patternType: 'solid', fgColor: { rgb: 'f0f9ff' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: '1e3a5f' } }, bottom: { style: 'thin', color: { rgb: '1e3a5f' } }, left: { style: 'thin', color: { rgb: 'd1d5db' } }, right: { style: 'thin', color: { rgb: 'd1d5db' } } } },
  total: { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0f172a' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'medium', color: { rgb: '000000' } }, bottom: { style: 'medium', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } },
  totalLabel: { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0f172a' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'medium', color: { rgb: '000000' } }, bottom: { style: 'medium', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } },
  positive: { font: { sz: 10, color: { rgb: '166534' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right' } },
  negative: { font: { sz: 10, color: { rgb: 'dc2626' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right' } },
  bonusRow: { font: { sz: 10, color: { rgb: '000000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'fff7ed' } }, alignment: { horizontal: 'right' } },
  milestoneRow: { font: { bold: true, sz: 10, color: { rgb: '166534' } }, fill: { patternType: 'solid', fgColor: { rgb: 'dcfce7' } }, alignment: { horizontal: 'right' } },
  footer: { font: { sz: 9, italic: true, color: { rgb: '9ca3af' } }, alignment: { horizontal: 'center' } },
  fmt: {
    currency: '$#,##0.00',
    currencyNeg: '$#,##0.00_);[Red]($#,##0.00)',
    currencyWhole: '$#,##0',
    currencyK: '$#,##0,"K"',
    percent: '0.0%',
    percentFine: '0.00%',
    integer: '#,##0',
    dateMMYY: 'mmm-yy',
    dateFull: 'mm/dd/yyyy'
  },
  cols: {
    label: { wch: 32 },
    amount: { wch: 16 },
    percent: { wch: 12 },
    date: { wch: 14 },
    desc: { wch: 36 },
    small: { wch: 10 },
    flag: { wch: 8 }
  }
} as const;
