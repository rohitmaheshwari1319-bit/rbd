// Generate GST tax invoice PDF (jsPDF + autotable).
// Embeds the RBD logo on the top-left, formats line items with GST split,
// and offers download or print.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { inr2 } from './format.js';

const LOGO_PATH = '/logo.svg';

async function loadLogoDataURL() {
  try {
    const res = await fetch(LOGO_PATH);
    const svg = await res.text();
    // Convert SVG -> PNG via canvas so jsPDF can embed it
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 540; canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 540, 240);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch { return null; }
}

export async function generateInvoicePDF(sale, settings, mode = 'save') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;

  // Header band
  doc.setFillColor(225, 29, 46); // rbd-600
  doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TAX INVOICE', W - M, 38, { align: 'right' });
  doc.setFontSize(10).setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${sale.invoice_no}`, W - M, 54, { align: 'right' });

  const logo = await loadLogoDataURL();
  if (logo) doc.addImage(logo, 'PNG', M, 12, 110, 48);

  doc.setTextColor(20, 22, 26);
  let y = 90;
  doc.setFont('helvetica', 'bold').setFontSize(13).text(settings.company_name || 'RBD Machine Tools', M, y);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  if (settings.company_tagline) doc.text(settings.company_tagline, M, y += 14);
  if (settings.company_address) doc.text(settings.company_address, M, y += 12);
  if (settings.company_phone || settings.company_email)
    doc.text([settings.company_phone, settings.company_email].filter(Boolean).join('  |  '), M, y += 12);
  if (settings.company_gstin) doc.text(`GSTIN: ${settings.company_gstin}`, M, y += 12);

  // Bill-to box
  const colX = W / 2 + 12;
  let cy = 90;
  doc.setFont('helvetica', 'bold').setFontSize(10).text('BILL TO', colX, cy);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(sale.customer_name || 'Walk-in Customer', colX, cy += 14);
  if (sale.customer_address) doc.text(sale.customer_address, colX, cy += 12, { maxWidth: W - colX - M });
  if (sale.customer_phone) doc.text(`Phone: ${sale.customer_phone}`, colX, cy += 12);
  if (sale.customer_gstin) doc.text(`GSTIN: ${sale.customer_gstin}`, colX, cy += 12);

  // Meta line
  const metaY = Math.max(y, cy) + 16;
  doc.setDrawColor(229, 231, 235);
  doc.line(M, metaY, W - M, metaY);
  doc.setFontSize(9).setTextColor(100, 105, 115);
  doc.text(`Date: ${new Date(sale.created_at.replace(' ', 'T')).toLocaleString('en-IN')}`, M, metaY + 14);
  doc.text(`Warehouse: ${sale.warehouse_name || ''}`, M, metaY + 28);
  doc.text(`Payment: ${sale.payment_mode || ''}`, W - M, metaY + 14, { align: 'right' });

  // Items table
  autoTable(doc, {
    startY: metaY + 38,
    head: [['#', 'Item', 'HSN', 'Qty', 'Rate', 'GST%', 'Total']],
    body: sale.items.map((it, i) => [
      i + 1, it.product_name, it.hsn_code || '-', it.quantity,
      inr2(it.unit_price), `${it.gst_rate}%`, inr2(it.total)
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [33, 36, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      3: { halign: 'center' }, 4: { halign: 'right' },
      5: { halign: 'center' }, 6: { halign: 'right' }
    },
    margin: { left: M, right: M }
  });

  // Totals
  const ty = doc.lastAutoTable.finalY + 12;
  const labels = [
    ['Subtotal', inr2(sale.subtotal)],
    ['GST', inr2(sale.tax)],
    ...(sale.discount > 0 ? [['Discount', `- ${inr2(sale.discount)}`]] : []),
    ['Total', inr2(sale.total)],
    ['Paid', inr2(sale.paid)],
    ['Balance due', inr2(Math.max(0, sale.total - sale.paid))]
  ];
  let ly = ty;
  for (const [k, v] of labels) {
    const isTotal = k === 'Total';
    const isDue = k === 'Balance due';
    doc.setFont('helvetica', isTotal || isDue ? 'bold' : 'normal').setFontSize(isTotal ? 11 : 10);
    doc.setTextColor(isDue && sale.total - sale.paid > 0 ? 225 : 20, isDue && sale.total - sale.paid > 0 ? 29 : 22, isDue && sale.total - sale.paid > 0 ? 46 : 26);
    doc.text(k, W - M - 120, ly);
    doc.text(v, W - M, ly, { align: 'right' });
    ly += isTotal ? 18 : 14;
  }

  // Footer
  doc.setDrawColor(229, 231, 235);
  doc.line(M, 800, W - M, 800);
  doc.setFontSize(8).setTextColor(120, 125, 135).setFont('helvetica', 'normal');
  doc.text('This is a computer-generated invoice. Subject to local jurisdiction. E.&O.E.', W / 2, 814, { align: 'center' });
  doc.text(`${settings.company_name || 'RBD Machine Tools'} — Trust of India`, W / 2, 826, { align: 'center' });

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`${sale.invoice_no}.pdf`);
  }
}
