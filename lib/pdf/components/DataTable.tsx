import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '@/lib/pdf/styles';

type Header = { label: string; align?: 'left' | 'right' };
type Row = { cells: string[]; highlight?: 'green' | 'red' | 'navy' | 'amber' };

export function DataTable({
  headers,
  rows,
  totalsRow,
}: {
  headers: Header[];
  rows: Row[];
  totalsRow?: { cells: string[] };
}) {
  return (
    <View style={pdfStyles.table}>
      <View style={pdfStyles.tableHeader}>
        {headers.map((h, idx) => (
          <Text key={`${h.label}-${idx}`} style={h.align === 'right' ? pdfStyles.tableHeaderCellRight : pdfStyles.tableHeaderCell}>
            {h.label}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={rowIdx % 2 === 1 ? [pdfStyles.tableRow, pdfStyles.tableRowAlt] : pdfStyles.tableRow}>
          {row.cells.map((cell, cellIdx) => {
            const base = headers[cellIdx]?.align === 'right' ? pdfStyles.tableCellRight : pdfStyles.tableCell;
            const hl =
              row.highlight === 'green'
                ? pdfStyles.tableCellGreen
                : row.highlight === 'red'
                ? pdfStyles.tableCellRed
                : undefined;
            return (
              <Text key={`${rowIdx}-${cellIdx}`} style={hl ? [base, hl] : base}>
                {cell}
              </Text>
            );
          })}
        </View>
      ))}

      {totalsRow ? (
        <View style={[pdfStyles.tableRow, pdfStyles.tableRowTotal]}>
          {totalsRow.cells.map((cell, idx) => (
            <Text key={`total-${idx}`} style={idx === 0 ? pdfStyles.tableCellTotalLabel : pdfStyles.tableCellTotal}>
              {cell}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

