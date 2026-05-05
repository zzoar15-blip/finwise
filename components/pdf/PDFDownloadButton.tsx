'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { DocumentProps } from '@react-pdf/renderer';
import { cn } from '@/lib/utils';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false },
);

export function PDFDownloadButton({
  document,
  fileName,
  label = 'Export PDF',
  loadingLabel = 'Generating PDF...',
  className,
}: {
  document: React.ReactElement<DocumentProps>;
  fileName: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
}) {
  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60',
            className,
          )}
        >
          {loading ? loadingLabel : label}
        </button>
      )}
    </PDFDownloadLink>
  );
}

