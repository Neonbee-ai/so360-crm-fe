import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';

const makeFile = (name = 'test.pdf', type = 'application/pdf') =>
    new File(['content'], name, { type });

// CRM BE /documents/upload returns the persisted documents row (carrying
// dms_document_id). mapDocumentFromApi normalises it into an Attachment.
const makeUploadResponse = (overrides: Record<string, unknown> = {}) => ({
    id: 'doc-1',
    name: 'test.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    dms_document_id: 'dms-abc',
    uploaded_at: '2026-06-01T00:00:00Z',
    uploaded_by: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
});

const mockFetchOk = (body: Record<string, unknown>) =>
    vi.fn().mockResolvedValue({
        ok: true,
        json: async () => body,
    });

const mockFetchFail = (status: number, message: string) =>
    vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ message }),
    });

describe('crmService.uploadDocument — single-step DMS upload', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Given setTenantId is called with a real UUID', () => {
        it('When uploadDocument is called / Then it POSTs to /documents/upload with the X-Tenant-Id header', async () => {
            const fetchSpy = mockFetchOk(makeUploadResponse());
            vi.stubGlobal('fetch', fetchSpy);

            crmService.setTenantId(REAL_TENANT);
            await crmService.uploadDocument('lead-abc', makeFile());

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/documents/upload'),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Tenant-Id': REAL_TENANT }),
                })
            );
        });
    });

    describe('Given a successful upload', () => {
        beforeEach(() => {
            crmService.setTenantId(REAL_TENANT);
        });

        it('When called with a leadId string / Then returns the mapped Attachment with dmsDocumentId', async () => {
            vi.stubGlobal('fetch', mockFetchOk(makeUploadResponse()));
            const result = await crmService.uploadDocument('lead-1', makeFile());
            expect(result).toMatchObject({ id: 'doc-1', name: 'test.pdf', dmsDocumentId: 'dms-abc' });
        });

        it('When called with a leadId string / Then lead_id is sent in the multipart body', async () => {
            const fetchSpy = mockFetchOk(makeUploadResponse());
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadDocument('lead-xyz', makeFile());

            const [, init] = fetchSpy.mock.calls[0];
            const form = init.body as FormData;
            expect(form.get('lead_id')).toBe('lead-xyz');
            expect(form.get('deal_id')).toBeNull();
            expect(form.get('file')).toBeInstanceOf(File);
        });

        it('When called with a lead entity object / Then lead_id is sent', async () => {
            const fetchSpy = mockFetchOk(makeUploadResponse());
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadDocument({ leadId: 'lead-2' }, makeFile());

            const form = (fetchSpy.mock.calls[0][1].body) as FormData;
            expect(form.get('lead_id')).toBe('lead-2');
        });

        it('When called with a deal entity object / Then deal_id is sent', async () => {
            const fetchSpy = mockFetchOk(makeUploadResponse());
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadDocument({ dealId: 'deal-99' }, makeFile());

            const form = (fetchSpy.mock.calls[0][1].body) as FormData;
            expect(form.get('deal_id')).toBe('deal-99');
            expect(form.get('lead_id')).toBeNull();
        });

        it('When called / Then multipart POST is used (no Content-Type header override)', async () => {
            const fetchSpy = mockFetchOk(makeUploadResponse());
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadDocument('lead-1', makeFile());

            const [, init] = fetchSpy.mock.calls[0];
            expect(init.method).toBe('POST');
            expect(init.body).toBeInstanceOf(FormData);
            expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
        });
    });

    describe('Given the CRM API rejects the upload', () => {
        it('When the response is not ok / Then the error message propagates to the caller', async () => {
            vi.stubGlobal('fetch', mockFetchFail(403, 'Tenant not found'));
            await expect(crmService.uploadDocument('lead-1', makeFile())).rejects.toThrow('Tenant not found');
        });

        it('When the response body has no message / Then a generic upload-failed error is thrown', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({}),
            }));
            await expect(crmService.uploadDocument('lead-1', makeFile())).rejects.toThrow(/Upload failed: 500/);
        });
    });
});
