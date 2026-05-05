import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface PdfReportSection {
  heading: string;
  lines: string[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    fontSize: 10,
    color: '#0f172a',
    lineHeight: 1.5,
  },
  header: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
  },
  subtitle: {
    color: '#cbd5e1',
    marginTop: 4,
    fontSize: 10,
  },
  section: {
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  sectionHeading: {
    color: '#1e3a8a',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  line: {
    marginBottom: 3,
  },
});

export function PDFDomReport({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: PdfReportSection[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {sections.map((section, sectionIdx) => (
          <View key={`${section.heading}-${sectionIdx}`} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.lines.map((line, lineIdx) => (
              <Text key={`${section.heading}-${lineIdx}`} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

