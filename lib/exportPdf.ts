/**
 * Client-side PDF export via html snapshot + jsPDF multipage tiling.
 */
export async function exportDomToPdf(options: {
  elementId: string;
  filenamePrefix: string;
  scale?: number;
}): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const el = document.getElementById(options.elementId);
  if (!el) {
    window.alert(
      'Could not find this page\'s export area. Refresh the page and try again, or contact support if the problem continues.',
    );
    return false;
  }

  const rootEl = document.documentElement;
  rootEl.classList.add('pdf-export-mode');
  el.classList.add('pdf-export-target');

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const scale = options.scale ?? 1.5;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 50);
    });

    const doc = el.ownerDocument;
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      foreignObjectRendering: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: doc.documentElement.scrollHeight,
    });

    if (!canvas.width || !canvas.height) {
      window.alert('PDF capture produced an empty image. Try collapsing charts or exporting from a narrower view.');
      return false;
    }

    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const imgH = pageW / ratio;

    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -y, pageW, imgH);
      y += pageH;
    }

    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`${options.filenamePrefix}-${date}.pdf`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[exportDomToPdf]', err);
    window.alert(
      `PDF export failed (${msg}). If this page has live charts, try again after scrolling the full report into view, or use CSV / Excel export instead.`,
    );
    return false;
  } finally {
    rootEl.classList.remove('pdf-export-mode');
    el.classList.remove('pdf-export-target');
  }
}
