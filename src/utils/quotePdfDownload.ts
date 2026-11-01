import { crmService } from '../services/crmService';
import { saveBlob } from '../services/exportService';

export const QUOTE_PDF_FLAG = 'action:crm:quote_pdf_download';

/** Flag gate for the "Download PDF" action (waits for flags to load). */
export function canDownloadQuotePdf(
    shell?: { effectiveFlagsLoaded?: boolean; isFeatureEnabled?: (key: string) => boolean } | null,
): boolean {
    return shell?.effectiveFlagsLoaded !== false && (shell?.isFeatureEnabled?.(QUOTE_PDF_FLAG) ?? true);
}

/** Quote-<number>.pdf, falling back to the id prefix; unsafe filename chars removed. */
export function quotePdfFilename(quote: { id: string; quote_number?: string | null }): string {
    const label = (quote.quote_number || quote.id.slice(0, 8)).replace(/[^A-Za-z0-9._-]+/g, '-');
    return `Quote-${label}.pdf`;
}

/** Fetches the server-rendered quotation PDF (FE -> NestJS) and saves it. */
export async function downloadQuotePdf(quote: { id: string; quote_number?: string | null }): Promise<void> {
    const { blob } = await crmService.getQuotePdf(quote.id);
    saveBlob(blob, quotePdfFilename(quote));
}
