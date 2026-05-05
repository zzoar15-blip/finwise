/**
 * Client-side PDF export via html snapshot + jsPDF multipage tiling.
 */
export async function exportDomToPdf(options: {
  elementId: string;
  filenamePrefix: string;
  scale?: number;
}): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const el = document.getElementById(options.elementId);
  if (!el) return false;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const scale = options.scale ?? 1.5;
  const canvas = await html2canvas(el, { scale, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

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
}
