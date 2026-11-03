import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetQuotePdf = vi.fn();
const mockSaveBlob = vi.fn();
vi.mock('../services/crmService', () => ({ crmService: { getQuotePdf: (...a: any[]) => mockGetQuotePdf(...a) } }));
vi.mock('../services/exportService', () => ({ saveBlob: (...a: any[]) => mockSaveBlob(...a) }));

import { canDownloadQuotePdf, quotePdfFilename, downloadQuotePdf, QUOTE_PDF_FLAG } from './quotePdfDownload';

beforeEach(() => vi.clearAllMocks());

describe('canDownloadQuotePdf', () => {
    it('Given the flag is enabled and flags are loaded, When checked, Then the action is shown', () => {
        const isFeatureEnabled = vi.fn(() => true);
        expect(canDownloadQuotePdf({ effectiveFlagsLoaded: true, isFeatureEnabled })).toBe(true);
        expect(isFeatureEnabled).toHaveBeenCalledWith(QUOTE_PDF_FLAG);
    });
    it('Given the flag is off for the org, When checked, Then the action is hidden', () => {
        expect(canDownloadQuotePdf({ effectiveFlagsLoaded: true, isFeatureEnabled: () => false })).toBe(false);
    });
    it('Given flags are still loading, When checked, Then the action is hidden', () => {
        expect(canDownloadQuotePdf({ effectiveFlagsLoaded: false, isFeatureEnabled: () => true })).toBe(false);
    });
    it('Given no shell bridge, When checked, Then it defaults to shown', () => {
        expect(canDownloadQuotePdf(null)).toBe(true);
    });
});

describe('quotePdfFilename', () => {
    it('Given a quote number, When named, Then it is Quote-<number>.pdf', () => {
        expect(quotePdfFilename({ id: 'abcdef12-0000', quote_number: 'QT-2026-0007' })).toBe('Quote-QT-2026-0007.pdf');
    });
    it('Given a number with unsafe characters, When named, Then they are replaced', () => {
        expect(quotePdfFilename({ id: 'x', quote_number: 'QT/7 A' })).toBe('Quote-QT-7-A.pdf');
    });
    it('Given no quote number, When named, Then the id prefix is used', () => {
        expect(quotePdfFilename({ id: 'abcdef12-0000', quote_number: null })).toBe('Quote-abcdef12.pdf');
    });
});

describe('downloadQuotePdf', () => {
    it('Given the API returns a blob, When downloading, Then it is saved as Quote-<number>.pdf', async () => {
        const blob = new Blob(['%PDF'], { type: 'application/pdf' });
        mockGetQuotePdf.mockResolvedValue({ blob, filename: 'server.pdf' });
        await downloadQuotePdf({ id: 'q1', quote_number: 'QT-1' });
        expect(mockGetQuotePdf).toHaveBeenCalledWith('q1');
        expect(mockSaveBlob).toHaveBeenCalledWith(blob, 'Quote-QT-1.pdf');
    });
    it('Given the API fails, When downloading, Then the error propagates and nothing is saved', async () => {
        mockGetQuotePdf.mockRejectedValue(new Error('API Error: 404'));
        await expect(downloadQuotePdf({ id: 'q1', quote_number: 'QT-1' })).rejects.toThrow('404');
        expect(mockSaveBlob).not.toHaveBeenCalled();
    });
});
