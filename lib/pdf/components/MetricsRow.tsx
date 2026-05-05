import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '@/lib/pdf/styles';

type Metric = {
  label: string;
  value: string;
  sub?: string;
  color?: 'green' | 'red' | 'amber';
};

export function MetricsRow({ metrics }: { metrics: Metric[] }) {
  return (
    <View style={pdfStyles.metricsRow}>
      {metrics.map((metric, idx) => {
        const variantStyle =
          metric.color === 'green'
            ? pdfStyles.metricCardGreen
            : metric.color === 'red'
            ? pdfStyles.metricCardRed
            : metric.color === 'amber'
            ? pdfStyles.metricCardAmber
            : undefined;
        return (
          <View key={`${metric.label}-${idx}`} style={variantStyle ? [pdfStyles.metricCard, variantStyle] : pdfStyles.metricCard}>
            <Text style={pdfStyles.metricLabel}>{metric.label}</Text>
            <Text style={pdfStyles.metricValue}>{metric.value}</Text>
            {metric.sub ? <Text style={pdfStyles.metricSub}>{metric.sub}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

