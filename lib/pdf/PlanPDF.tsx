import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { DataTable } from '@/lib/pdf/components/DataTable';
import { InfoBox } from '@/lib/pdf/components/InfoBox';
import { MetricsRow } from '@/lib/pdf/components/MetricsRow';
import { PageWrapper } from '@/lib/pdf/components/PageWrapper';
import { SectionHeader } from '@/lib/pdf/components/SectionHeader';
import { formatCurrency, formatPct, pdfStyles } from '@/lib/pdf/styles';

export type PlanPdfData = {
  name?: string;
  annualSalary: number;
  monthlyTakeHome: number;
  effectiveTaxRate: number;
  monthlySurplus: number;
  savingsRate: number;
  totalDebt: number;
  debtFreeDate?: string | null;
  monthlyInvestment: number;
  goals: string[];
  priorities: Array<{ title: string; description: string; impact?: string }>;
  debtRows: Array<{ name: string; balance: number; rate: number; minPayment: number }>;
  taxEfficiencyScore: number;
  taxRows: Array<{ benefit: string; yourContribution: number; max: number; gap: number; savings: number }>;
  insights?: string[];
};

export function PlanPDF({ data }: { data: PlanPdfData }) {
  const generatedAt = new Date().toLocaleString();
  return (
    <Document>
      <Page size="A4" style={pdfStyles.coverPage}>
        <Text style={pdfStyles.coverTitle}>FinWise</Text>
        <Text style={pdfStyles.coverSubtitle}>Financial Plan</Text>
        <View style={pdfStyles.coverDivider} />
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>As of</Text><Text style={pdfStyles.coverMetricValue}>{generatedAt}</Text></View>
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>Name</Text><Text style={pdfStyles.coverMetricValue}>{data.name || 'My Plan'}</Text></View>
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>Annual Salary</Text><Text style={pdfStyles.coverMetricValue}>{formatCurrency(data.annualSalary)}</Text></View>
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>Monthly Take-Home</Text><Text style={pdfStyles.coverMetricValue}>{formatCurrency(data.monthlyTakeHome)}</Text></View>
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>Effective Tax Rate</Text><Text style={pdfStyles.coverMetricValue}>{formatPct(data.effectiveTaxRate)}</Text></View>
        <View style={pdfStyles.coverMetricRow}><Text style={pdfStyles.coverMetricLabel}>Monthly Surplus</Text><Text style={pdfStyles.coverMetricValue}>{formatCurrency(data.monthlySurplus)}</Text></View>
        <Text style={pdfStyles.coverDate}>Confidential — Personal Financial Plan</Text>
        <Text style={pdfStyles.coverFooter}>finwise-ochre.vercel.app</Text>
      </Page>

      <PageWrapper title="Where You Stand" generatedAt={generatedAt} pageNumber={2}>
        <MetricsRow metrics={[
          { label: 'Take-home', value: formatCurrency(data.monthlyTakeHome), color: 'green' },
          { label: 'Surplus', value: formatCurrency(data.monthlySurplus), color: data.monthlySurplus >= 0 ? 'green' : 'red' },
          { label: 'Savings rate', value: `${data.savingsRate.toFixed(1)}%`, color: 'amber' },
        ]} />
        <SectionHeader title="Monthly breakdown" />
        <DataTable
          headers={[{ label: 'Category' }, { label: 'Amount', align: 'right' }]}
          rows={[
            { cells: ['Annual Salary', formatCurrency(data.annualSalary)] },
            { cells: ['Monthly Take-Home', formatCurrency(data.monthlyTakeHome)] },
            { cells: ['Monthly Investment', formatCurrency(data.monthlyInvestment)] },
            { cells: ['Monthly Surplus', formatCurrency(data.monthlySurplus)], highlight: data.monthlySurplus >= 0 ? 'green' : 'red' },
          ]}
        />
      </PageWrapper>

      <PageWrapper title="Your Priority Action Plan" generatedAt={generatedAt} pageNumber={3}>
        <Text style={pdfStyles.bodyText}>{`Based on goals: ${data.goals.join(', ') || 'No goals selected'}`}</Text>
        {data.priorities.slice(0, 5).map((p, idx) => (
          <View key={`${p.title}-${idx}`} style={pdfStyles.priorityCard}>
            <View style={pdfStyles.priorityNumber}><Text style={pdfStyles.priorityNumberText}>{String(idx + 1)}</Text></View>
            <View style={pdfStyles.priorityContent}>
              <Text style={pdfStyles.priorityTitle}>{p.title}</Text>
              <Text style={pdfStyles.priorityDesc}>{p.description}</Text>
              {p.impact ? <Text style={pdfStyles.smallText}>{p.impact}</Text> : null}
            </View>
          </View>
        ))}
      </PageWrapper>

      <PageWrapper title="Debt Payoff Plan" generatedAt={generatedAt} pageNumber={4}>
        {data.debtRows.length === 0 ? (
          <InfoBox variant="success" text="No debts on file — debt payoff page omitted in your active plan." />
        ) : (
          <>
            <MetricsRow metrics={[
              { label: 'Total debt', value: formatCurrency(data.totalDebt), color: 'red' },
              { label: 'Debt-free date', value: data.debtFreeDate || 'N/A', color: 'amber' },
              { label: 'Accounts', value: String(data.debtRows.length) },
            ]} />
            <DataTable
              headers={[{ label: 'Debt' }, { label: 'Balance', align: 'right' }, { label: 'Rate', align: 'right' }, { label: 'Min', align: 'right' }]}
              rows={data.debtRows.map((d) => ({
                cells: [d.name, formatCurrency(d.balance), `${d.rate.toFixed(2)}%`, formatCurrency(d.minPayment)],
              }))}
            />
          </>
        )}
      </PageWrapper>

      <PageWrapper title="Investment Roadmap" generatedAt={generatedAt} pageNumber={5}>
        <MetricsRow metrics={[
          { label: 'Monthly investment', value: formatCurrency(data.monthlyInvestment), color: 'green' },
          { label: 'Savings rate', value: `${data.savingsRate.toFixed(1)}%` },
          { label: 'Tax efficiency', value: `${data.taxEfficiencyScore}/100`, color: data.taxEfficiencyScore >= 60 ? 'green' : 'amber' },
        ]} />
        <InfoBox variant="info" text="Projection assumptions are aligned with your current plan settings and goal priorities." />
      </PageWrapper>

      <PageWrapper title="12-Month Financial Projection" generatedAt={generatedAt} pageNumber={6}>
        <DataTable
          headers={[{ label: 'Metric' }, { label: 'Value', align: 'right' }]}
          rows={[
            { cells: ['Monthly take-home', formatCurrency(data.monthlyTakeHome)] },
            { cells: ['Monthly investment', formatCurrency(data.monthlyInvestment)] },
            { cells: ['Monthly surplus', formatCurrency(data.monthlySurplus)], highlight: data.monthlySurplus >= 0 ? 'green' : 'red' },
            { cells: ['Estimated annual surplus', formatCurrency(data.monthlySurplus * 12)] },
          ]}
        />
      </PageWrapper>

      <PageWrapper title="Tax Efficiency Analysis" generatedAt={generatedAt} pageNumber={7}>
        <MetricsRow metrics={[{ label: 'Tax efficiency score', value: `${data.taxEfficiencyScore}/100`, color: data.taxEfficiencyScore >= 60 ? 'green' : 'red' }]} />
        <DataTable
          headers={[{ label: 'Benefit' }, { label: 'Your Contribution', align: 'right' }, { label: 'IRS Max', align: 'right' }, { label: 'Gap', align: 'right' }, { label: 'Opportunity', align: 'right' }]}
          rows={data.taxRows.map((r) => ({
            cells: [r.benefit, formatCurrency(r.yourContribution), formatCurrency(r.max), formatCurrency(r.gap), formatCurrency(r.savings)],
            highlight: r.gap > 0 ? 'amber' : 'green',
          }))}
        />
      </PageWrapper>

      {data.insights && data.insights.length > 0 ? (
        <PageWrapper title="AI Financial Insights" generatedAt={generatedAt} pageNumber={8}>
          {data.insights.map((insight, idx) => (
            <InfoBox key={idx} variant={insight.includes('risk') || insight.includes('warning') ? 'warning' : 'info'} text={insight} />
          ))}
          <Text style={pdfStyles.smallText}>
            These insights are generated by AI for informational purposes only and do not constitute financial advice.
          </Text>
        </PageWrapper>
      ) : null}
    </Document>
  );
}

