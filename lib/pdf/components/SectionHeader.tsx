import React from 'react';
import { Text } from '@react-pdf/renderer';
import { pdfStyles } from '@/lib/pdf/styles';

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Text style={pdfStyles.sectionHeader}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.sectionSubheader}>{subtitle}</Text> : null}
    </>
  );
}

