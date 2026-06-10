import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { documentsApi, crmService } from './crmService';

function mockSuccess(data: any) {
    fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
    });
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('crmService — mapDocumentFromApi tolerance (via documentsApi.getAllByLead)', () => {
    describe('Given a DMS-backed document row (file_size/mime_type, no url)', () => {
        it('When mapped / Then size/type fall back to file_size/mime_type and dmsDocumentId is surfaced', async () => {
            mockSuccess([
                {
                    id: 'doc-dms',
                    name: 'contract.pdf',
                    file_size: 4096,
                    mime_type: 'application/pdf',
                    dms_document_id: 'dms-123',
                    created_at: '2026-06-01T00:00:00Z',
                },
            ]);

            const [doc] = await documentsApi.getAllByLead('lead-1');

            expect(doc.size).toBe(4096);
            expect(doc.type).toBe('application/pdf');
            expect(doc.dmsDocumentId).toBe('dms-123');
            expect(doc.url).toBe('');
        });
    });

    describe('Given a legacy document row (size/type/url present, no dms id)', () => {
        it('When mapped / Then existing fields are preserved and dmsDocumentId is undefined', async () => {
            mockSuccess([
                {
                    id: 'doc-legacy',
                    name: 'old.pdf',
                    size: 2048,
                    type: 'application/pdf',
                    url: 'https://cdn.example.com/old.pdf',
                    created_at: '2026-06-01T00:00:00Z',
                },
            ]);

            const [doc] = await documentsApi.getAllByDeal('deal-1');

            expect(doc.size).toBe(2048);
            expect(doc.type).toBe('application/pdf');
            expect(doc.url).toBe('https://cdn.example.com/old.pdf');
            expect(doc.dmsDocumentId).toBeUndefined();
        });
    });

    describe('Given a document row missing size, type, and url entirely', () => {
        it('When mapped / Then it defaults to size 0, empty type, empty url without throwing', async () => {
            mockSuccess([
                { id: 'doc-bare', name: 'bare.bin', created_at: '2026-06-01T00:00:00Z' },
            ]);

            const [doc] = await documentsApi.getAllByLead('lead-2');

            expect(doc.size).toBe(0);
            expect(doc.type).toBe('');
            expect(doc.url).toBe('');
            expect(doc.dmsDocumentId).toBeUndefined();
        });
    });

    describe('Given dmsDocumentId arrives already camelCased', () => {
        it('When mapped / Then the camelCase value is honoured', async () => {
            mockSuccess([
                { id: 'd1', name: 'x.pdf', dmsDocumentId: 'dms-camel', created_at: '2026-06-01T00:00:00Z' },
            ]);

            const [doc] = await documentsApi.getAllByLead('lead-3');
            expect(doc.dmsDocumentId).toBe('dms-camel');
        });
    });
});

describe('crmService — getDocumentDownloadUrl / documentsApi.getDownloadUrl', () => {
    describe('Given the BE returns a signed download url', () => {
        it('When getDownloadUrl is called / Then it GETs /documents/:id/download-url and returns the url', async () => {
            mockSuccess({ url: 'https://signed.example.com/doc?sig=abc', source: 'dms' });

            const url = await documentsApi.getDownloadUrl('doc-9');

            expect(url).toBe('https://signed.example.com/doc?sig=abc');
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/documents/doc-9/download-url'),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('When crmService.getDocumentDownloadUrl delegates / Then it returns the resolved url', async () => {
            mockSuccess({ url: 'https://signed.example.com/d2', source: 'dms' });
            const url = await crmService.getDocumentDownloadUrl('d2');
            expect(url).toBe('https://signed.example.com/d2');
        });
    });
});
