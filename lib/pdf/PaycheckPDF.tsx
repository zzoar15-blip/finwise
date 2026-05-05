import React from 'react';
import { Document, Text } from '@react-pdf/renderer';
import { DataTable } from '@/lib/pdf/components/DataTable';
import { MetricsRow } from '@/lib/pdf/components/MetricsRow';
import { PageWrapper } from '@/lib/pdf/components/PageWrapper';
import { SectionHeader } from '@/lib/pdf/components/SectionHeader';
import { formatCurrency, formatPct } from '@/lib/pdf/styles';

export type PaycheckPdfData = {
  periodLabel: string;
  grossPerPaycheck: number;
  netPayPerPaycheck: number;
  effectiveTaxRate: number;
  netPayAnnual: number;
  annualSalary: number;
  preTaxRows: Array<{ label: string; value: number }>;
  taxRows: Array<{ label: string; value: number }>;
  postTaxRows: Array<{ label: string; value: number }>;
  annualTaxSavingsFromBenefits: number;
  marginalCombinedRate: number;
};

export function PaycheckPDF({ data }: { data: PaycheckPdfData }) {
  const generatedAt = new Date().toLocaleString();
  return (
    <Document>
      <PageWrapper title="Paycheck Analysis" generatedAt={generatedAt} pageNumber={1}>
        <MetricsRow
          metrics={[
            { label: 'Gross / paycheck', value: formatCurrency(data.grossPerPaycheck) },
            { label: 'Net / paycheck', value: formatCurrency(data.netPayPerPaycheck), color: 'green' },
            { label: 'Effective rate', value: formatPct(data.effectiveTaxRate), color: 'amber' },
            { label: 'Annual net', value: formatCurrency(data.netPayAnnual), color: 'green' },
          ]}
        />

        <SectionHeader title="Income" />
        <DataTable
          headers={[{ label: 'Item' }, { label: 'Amount', align: 'right' }]}
          rows={[
            { cells: ['Annual Salary', formatCurrency(data.annualSalary)] },
            { cells: [`Gross per ${data.periodLabel}`, formatCurrency(data.grossPerPaycheck)] },
          ]}
        />

        <SectionHeader title="Pre-Tax Deductions" />
        <DataTable
          headers={[{ label: 'Deduction' }, { label: 'Amount', align: 'right' }]}
          rows={data.preTaxRows.map((row) => ({ cells: [row.label, `(${formatCurrency(row.value)})`] }))}
          totalsRow={{ cells: ['Total pre-tax', `(${formatCurrency(data.preTaxRows.reduce((s, r) => s + r.value, 0))})`] }}
        />

        <SectionHeader title="Taxes" />
        <DataTable
          headers={[{ label: 'Tax' }, { label: 'Amount', align: 'right' }]}
          rows={data.taxRows.map((row) => ({ cells: [row.label, `(${formatCurrency(row.value)})`] }))}
          totalsRow={{ cells: ['Total taxes', `(${formatCurrency(data.taxRows.reduce((s, r) => s + r.value, 0))})`] }}
        />

        {data.postTaxRows.length > 0 ? (
          <>
            <SectionHeader title="Post-Tax Deductions" />
            <DataTable
              headers={[{ label: 'Deduction' }, { label: 'Amount', align: 'right' }]}
              rows={data.postTaxRows.map((row) => ({ cells: [row.label, `(${formatCurrency(row.value)})`] }))}
            />
          </>
        ) : null}

        <Text>{`Benefit optimization currently saves approximately ${formatCurrency(data.annualTaxSavingsFromBenefits)} per year.`}</Text>
        <Text>{`Combined marginal rate: ${formatPct(data.marginalCombinedRate)}`}</Text>
      </PageWrapper>
    </Document>
  );
}

