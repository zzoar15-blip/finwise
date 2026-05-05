import React from 'react';
import { Document, Text } from '@react-pdf/renderer';
import { DataTable } from '@/lib/pdf/components/DataTable';
import { InfoBox } from '@/lib/pdf/components/InfoBox';
import { MetricsRow } from '@/lib/pdf/components/MetricsRow';
import { PageWrapper } from '@/lib/pdf/components/PageWrapper';
import { SectionHeader } from '@/lib/pdf/components/SectionHeader';
import { formatCurrency } from '@/lib/pdf/styles';

export type RentVsBuyPdfData = {
  verdictHeadline: string;
  verdictDetail: string;
  breakEvenYear: number | null;
  trueMonthlyCostBuying: number;
  trueMonthlyCostRenting: number;
  priceToRentRatio: number;
  downPayment: number;
  closingCosts: number;
  totalUpfront: number;
  scenarios: Array<{ stayYears: number; buyerNetWorth: number; renterNetWorth: number; winner: string; difference: number }>;
  snapshots: Array<{ year: number; homeValue: number; buyerNetWorth: number; renterNetWorth: number }>;
};

export function RentVsBuyPDF({ data }: { data: RentVsBuyPdfData }) {
  const generatedAt = new Date().toLocaleString();
  return (
    <Document>
      <PageWrapper title="Rent vs. Buy Analysis" generatedAt={generatedAt} pageNumber={1}>
        <InfoBox variant={data.breakEvenYear ? 'info' : 'warning'} text={`${data.verdictHeadline} ${data.verdictDetail}`} />
        <MetricsRow
          metrics={[
            { label: 'True monthly cost (buy)', value: formatCurrency(data.trueMonthlyCostBuying), color: 'amber' },
            { label: 'Monthly rent', value: formatCurrency(data.trueMonthlyCostRenting) },
            { label: 'Break-even', value: data.breakEvenYear ? `${data.breakEvenYear} years` : 'Never' },
            { label: 'Price-to-rent', value: data.priceToRentRatio.toFixed(1) },
          ]}
        />
        <SectionHeader title="Upfront Cash Needed" />
        <DataTable
          headers={[{ label: 'Item' }, { label: 'Amount', align: 'right' }]}
          rows={[
            { cells: ['Down payment', formatCurrency(data.downPayment)] },
            { cells: ['Closing costs', formatCurrency(data.closingCosts)] },
          ]}
          totalsRow={{ cells: ['Total cash needed', formatCurrency(data.totalUpfront)] }}
        />
      </PageWrapper>

      <PageWrapper title="Cost Comparison" generatedAt={generatedAt} pageNumber={2}>
        <DataTable
          headers={[{ label: 'Stay' }, { label: 'Buyer Net Worth', align: 'right' }, { label: 'Renter Net Worth', align: 'right' }, { label: 'Winner' }, { label: 'By', align: 'right' }]}
          rows={data.scenarios.map((s) => ({
            cells: [`${s.stayYears} yrs`, formatCurrency(s.buyerNetWorth), formatCurrency(s.renterNetWorth), s.winner, formatCurrency(Math.abs(s.difference))],
            highlight: s.winner === 'buy' ? 'green' : s.winner === 'rent' ? 'red' : 'amber',
          }))}
        />
      </PageWrapper>

      <PageWrapper title="Net Worth Projection" generatedAt={generatedAt} pageNumber={3}>
        <SectionHeader title="Annual snapshots" />
        <DataTable
          headers={[{ label: 'Year' }, { label: 'Home Value', align: 'right' }, { label: 'Buyer Net Worth', align: 'right' }, { label: 'Renter Net Worth', align: 'right' }, { label: 'Winner' }]}
          rows={data.snapshots.map((s) => {
            const diff = s.buyerNetWorth - s.renterNetWorth;
            return {
              cells: [String(s.year), formatCurrency(s.homeValue), formatCurrency(s.buyerNetWorth), formatCurrency(s.renterNetWorth), diff >= 0 ? 'Buying' : 'Renting'],
              highlight: diff >= 0 ? 'green' : 'red',
            };
          })}
        />
        <Text>Assumption sensitivity should be reviewed alongside this base case before making a housing decision.</Text>
      </PageWrapper>
    </Document>
  );
}

