import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { PDF_COLORS, pdfStyles } from '@/lib/pdf/styles';
import { formatCurrency } from '@/lib/pdf/styles';

export function BarChart({
  items,
}: {
  items: Array<{ label: string; value: number; max: number; color?: string }>;
}) {
  return (
    <View>
      {items.map((item, idx) => {
        const widthPct = item.max > 0 ? Math.max(0, Math.min(100, (item.value / item.max) * 100)) : 0;
        return (
          <View key={`${item.label}-${idx}`} style={pdfStyles.barChartRow}>
            <Text style={pdfStyles.barLabel}>{item.label}</Text>
            <View style={pdfStyles.barTrack}>
              <View
                style={[
                  pdfStyles.barFill,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: item.color ?? PDF_COLORS.blue,
                  },
                ]}
              />
            </View>
            <Text style={pdfStyles.barValue}>{formatCurrency(item.value)}</Text>
          </View>
        );
      })}
    </View>
  );
}

