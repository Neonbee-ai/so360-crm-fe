import { Quote, QuoteLine } from '../types/crm';

export type QuoteFormatters = {
    formatCurrency: (v: number) => string;
    formatDate: (v: string) => string;
};

export type QuoteOrgProfile = {
    name?: string;
    logo_url?: string;
    address?: string;
    tax_id?: string;
};

function calcTotals(lines: QuoteLine[]) {
    const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unit_price, 0);
    const discountTotal = lines.reduce(
        (acc, l) => acc + l.quantity * l.unit_price * ((l.discount_percent || 0) / 100),
        0,
    );
    const taxTotal = lines.reduce((acc, l) => {
        const ls = l.quantity * l.unit_price;
        const ld = ls * ((l.discount_percent || 0) / 100);
        return acc + (ls - ld) * ((l.tax_rate || 0) / 100);
    }, 0);
    return { subtotal, discountTotal, taxTotal, grandTotal: subtotal - discountTotal + taxTotal };
}

function lineTotal(line: QuoteLine): number {
    const sub = line.quantity * line.unit_price;
    const disc = sub * ((line.discount_percent || 0) / 100);
    return sub - disc + (sub - disc) * ((line.tax_rate || 0) / 100);
}

export function printQuote(
    quote: Quote,
    formatters: QuoteFormatters,
    orgProfile?: QuoteOrgProfile,
    docSettings?: any,
): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const lh = docSettings?.letterhead || {};
    const accentColor = lh.accent_color || '#e5e7eb';
    const accentBg = lh.accent_color ? `${lh.accent_color}18` : '#f9fafb';
    const logoUrl = lh.logo_url || orgProfile?.logo_url;

    const lines: QuoteLine[] = quote.lines || [];
    const totals = calcTotals(lines);
    const quoteNum = quote.quote_number || `Quote #${quote.id.slice(0, 8)}`;

    const lineRows = lines
        .map(
            (line, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>
                ${line.description || '—'}
                ${line.sku ? `<br><span class="sku">${line.sku}${line.sub_sku && line.sub_sku !== 'NIL' ? ` / ${line.sub_sku}` : ''}</span>` : ''}
            </td>
            <td style="text-align:right">${line.quantity}</td>
            <td style="text-align:right">${formatters.formatCurrency(line.unit_price ?? 0)}</td>
            <td style="text-align:right">${line.discount_percent ? `${line.discount_percent}%` : '—'}</td>
            <td style="text-align:right">${line.tax_rate ? `${line.tax_rate}%` : '—'}</td>
            <td style="text-align:right">${formatters.formatCurrency(lineTotal(line))}</td>
        </tr>`,
        )
        .join('');

    const customerBlock =
        quote.customer_name || quote.deal
            ? `<div class="grid">
        <div>
          <div class="info-row"><span class="label">To</span>${quote.customer_name || quote.deal?.company_name || quote.deal?.name || ''}</div>
          ${quote.deal ? `<div class="info-row"><span class="label">Deal</span>${quote.deal.name}</div>` : ''}
        </div>
        ${quote.title ? `<div><div class="info-row"><span class="label">Title</span>${quote.title}</div></div>` : ''}
      </div>`
            : quote.title
              ? `<div class="grid"><div><div class="info-row"><span class="label">Title</span>${quote.title}</div></div></div>`
              : '';

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${quoteNum}</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;background:white;margin:0;padding:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}
  .status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;text-transform:uppercase;background:#e5e7eb;color:#374151}
  .biz-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${accentColor}}
  .biz-logo{max-height:60px;max-width:160px;object-fit:contain}
  .biz-name{font-size:18px;font-weight:bold;color:#111;margin-bottom:2px}
  .biz-tagline{font-size:11px;color:#6b7280;margin-bottom:4px;font-style:italic}
  .biz-meta{font-size:11px;color:#6b7280;line-height:1.6}
  .header-right-meta{font-size:10px;color:#6b7280;white-space:pre-line;text-align:right;margin-top:4px;line-height:1.6}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:1px solid #e5e7eb;padding-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:6px}
  .info-row{margin-bottom:8px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;display:block}
  .sku{font-size:10px;color:#9ca3af;background:#f3f4f6;padding:1px 4px;border-radius:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:${accentBg};text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#374151;border-bottom:2px solid ${accentColor}}
  td{padding:8px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .totals{display:flex;justify-content:flex-end;margin-bottom:20px}
  .totals-box{width:260px;border:1px solid #e5e7eb;border-radius:6px;padding:12px}
  .total-row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px}
  .total-row.grand{font-weight:bold;font-size:15px;border-top:2px solid ${accentColor};padding-top:8px;margin-top:4px}
  .notes-box{border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:16px}
  .rejection{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-bottom:16px}
  .signatory{margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#374151}
  .signatory img{max-height:48px;display:block;margin-bottom:4px}
  .doc-footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px;gap:16px}
  .doc-footer div{flex:1}
  ${lh.show_page_numbers ? '@page{margin-bottom:2cm} @page{@bottom-right{content:"Page " counter(page)}}' : ''}
  .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;opacity:0.05;color:#000;pointer-events:none;z-index:9999;white-space:nowrap;letter-spacing:8px}
  @media print{body{padding:0}}
</style></head><body>
  ${lh.watermark_text ? `<div class="watermark">${lh.watermark_text}</div>` : ''}
  <div class="biz-header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" class="biz-logo" alt="logo">` : ''}
      ${orgProfile?.name ? `<div class="biz-name">${orgProfile.name}</div>` : ''}
      ${lh.tagline ? `<div class="biz-tagline">${lh.tagline}</div>` : ''}
      <div class="biz-meta">
        ${orgProfile?.address ? orgProfile.address : ''}
        ${orgProfile?.tax_id ? `<br>Tax ID: ${orgProfile.tax_id}` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:bold;color:#111">QUOTE</div>
      ${lh.header_right_block ? `<div class="header-right-meta">${lh.header_right_block.replace(/\n/g, '<br>')}</div>` : ''}
    </div>
  </div>

  <div class="header">
    <div>
      <h1>${quoteNum}</h1>
      <span class="status">${quote.status || 'draft'}</span>
    </div>
    <div style="text-align:right;font-size:12px;color:#6b7280">
      ${quote.created_at ? `<div><span class="label">Date</span>${formatters.formatDate(quote.created_at)}</div>` : ''}
      ${quote.valid_until ? `<div><span class="label">Valid Until</span>${formatters.formatDate(quote.valid_until)}</div>` : ''}
    </div>
  </div>

  ${customerBlock}

  <table>
    <thead><tr>
      <th style="width:40px">#</th>
      <th>Description</th>
      <th style="text-align:right;width:60px">Qty</th>
      <th style="text-align:right;width:110px">Unit Price</th>
      <th style="text-align:right;width:80px">Disc %</th>
      <th style="text-align:right;width:80px">Tax %</th>
      <th style="text-align:right;width:110px">Total</th>
    </tr></thead>
    <tbody>${lineRows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">No line items</td></tr>'}</tbody>
  </table>

  <div class="totals"><div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>${formatters.formatCurrency(totals.subtotal)}</span></div>
    ${totals.discountTotal > 0 ? `<div class="total-row"><span>Discount</span><span>-${formatters.formatCurrency(totals.discountTotal)}</span></div>` : ''}
    ${totals.taxTotal > 0 ? `<div class="total-row"><span>Tax</span><span>${formatters.formatCurrency(totals.taxTotal)}</span></div>` : ''}
    <div class="total-row grand"><span>Grand Total</span><span>${formatters.formatCurrency(totals.grandTotal)}</span></div>
  </div></div>

  ${quote.notes || quote.terms_and_conditions ? `<div class="notes-box">
    ${quote.notes ? `<div class="info-row"><span class="label">Notes</span>${quote.notes}</div>` : ''}
    ${quote.terms_and_conditions ? `<div class="info-row"><span class="label">Terms &amp; Conditions</span><div style="white-space:pre-wrap">${quote.terms_and_conditions}</div></div>` : ''}
  </div>` : ''}

  ${quote.rejection_reason ? `<div class="rejection">
    <div class="label" style="margin-bottom:4px">Rejection Reason</div>
    <div style="color:#b91c1c">${quote.rejection_reason}</div>
  </div>` : ''}
  ${(docSettings?.authorized_signatory_name || docSettings?.footer_notes) ? `
  <div class="signatory">
    ${docSettings?.authorized_signature ? `<img src="${docSettings.authorized_signature}" alt="signature">` : ''}
    ${docSettings?.authorized_signatory_name ? `<div><strong>${docSettings.authorized_signatory_name}</strong></div>` : ''}
    ${docSettings?.authorized_signatory_title ? `<div>${docSettings.authorized_signatory_title}</div>` : ''}
    ${docSettings?.footer_notes ? `<div style="margin-top:12px;color:#6b7280">${docSettings.footer_notes}</div>` : ''}
  </div>` : ''}
  ${(lh.footer_left || lh.footer_center || lh.footer_right) ? `
  <div class="doc-footer">
    <div>${(lh.footer_left || '').replace(/\n/g, '<br>')}</div>
    <div style="text-align:center">${(lh.footer_center || '').replace(/\n/g, '<br>')}</div>
    <div style="text-align:right">${(lh.footer_right || '').replace(/\n/g, '<br>')}</div>
  </div>` : ''}
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.addEventListener('afterprint', () => printWindow.close());
    printWindow.print();
}
