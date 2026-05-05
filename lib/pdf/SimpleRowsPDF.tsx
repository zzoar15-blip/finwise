import React from 'react';
import { Document } from '@react-pdf/renderer';
import { DataTable } from '@/lib/pdf/components/DataTable';
import { PageWrapper } from '@/lib/pdf/components/PageWrapper';

export function SimpleRowsPDF({
  title,
  rows,
}: {
  title: string;
  rows: Array<Array<string | number>>;
}) {
  const generatedAt = new Date().toLocaleString();
  const [header, ...body] = rows;
  const headers = (header ?? []).map((h, idx) => ({ label: String(h), align: idx === 0 ? 'left' as const : 'right' as const }));
  return (
    <Document>
      <PageWrapper title={title} generatedAt={generatedAt} pageNumber={1}>
        <DataTable
          headers={headers}
          rows={body.slice(0, 120).map((r) => ({
            cells: r.map((cell) => String(cell)),
          }))}
        />
      </PageWrapper>
    </Document>
  );
}

