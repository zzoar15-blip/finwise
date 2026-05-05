import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { PDFDomReport, type PdfReportSection } from '@/components/pdf/PDFDomReport';

function sanitizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractSectionsFromElement(el: HTMLElement): PdfReportSection[] {
  const sectionNodes = Array.from(el.querySelectorAll('section, [data-slot="card"], .fw-card'));
  const sections: PdfReportSection[] = [];

  if (sectionNodes.length > 0) {
    for (const node of sectionNodes) {
      const heading =
        sanitizeLine(
          node.querySelector('h1,h2,h3,[data-slot="card-title"]')?.textContent ?? 'Section',
        ) || 'Section';
      const lines = Array.from(node.querySelectorAll('p,li,tr,dt,dd'))
        .map((n) => sanitizeLine(n.textContent ?? ''))
        .filter(Boolean)
        .slice(0, 35);
      if (lines.length === 0) continue;
      sections.push({ heading, lines });
    }
  }

  if (sections.length === 0) {
    const lines = Array.from(el.querySelectorAll('h1,h2,h3,p,li,tr,dt,dd,span'))
      .map((n) => sanitizeLine(n.textContent ?? ''))
      .filter((line) => line.length > 0)
      .slice(0, 140);
    sections.push({ heading: 'Summary', lines });
  }

  return sections.slice(0, 20);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportSectionsToExcel(sections: PdfReportSection[], filenamePrefix: string): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const rows: Array<Array<string>> = [['Section', 'Detail']];
  for (const section of sections) {
    for (const line of section.lines) rows.push([section.heading, line]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Report');
  XLSX.writeFile(wb, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportDomToPdf(options: {
  elementId: string;
  filenamePrefix: string;
  onFallbackExcel?: () => Promise<void> | void;
}): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const el = document.getElementById(options.elementId);
  if (!el) {
    window.alert(
      'Could not find this page\'s export area. Refresh and try again.',
    );
    return false;
  }

  try {
    const title = sanitizeLine(el.querySelector('h1')?.textContent ?? options.filenamePrefix);
    const sections = extractSectionsFromElement(el);
    const doc = React.createElement(PDFDomReport, {
      title: title || 'FinWise Report',
      subtitle: `Generated ${new Date().toLocaleString()}`,
      sections,
    });
    const blob = await pdf(doc).toBlob();
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `${options.filenamePrefix}-${date}.pdf`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[exportDomToPdf]', err);

    const isColorError =
      msg.toLowerCase().includes('lab') ||
      msg.toLowerCase().includes('oklch') ||
      msg.toLowerCase().includes('color(');

    if (isColorError) {
      window.alert('PDF export failed due to color parsing. Downloading Excel instead.');
      const sections = extractSectionsFromElement(el);
      if (options.onFallbackExcel) await options.onFallbackExcel();
      else await exportSectionsToExcel(sections, options.filenamePrefix);
      return false;
    }

    window.alert(`PDF export failed (${msg}). Try Excel/CSV export.`);
    return false;
  }
}
