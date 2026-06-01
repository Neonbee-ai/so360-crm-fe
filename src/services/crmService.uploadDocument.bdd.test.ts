import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService, documentsApi } from './crmService';

const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';

const makeFile = (name = 'test.pdf', type = 'application/pdf') =>
    new File(['content'], name, { type });

const makeAttachment = (overrides: Record<string, unknown> = {}) => ({
    id: 'doc-1',
    name: 'test.pdf',
    size: 1024,
    type: 'application/pdf',
    url: 'https://cdn.example.com/test.pdf',
    uploaded_at: '2026-06-01T00:00:00Z',
    uploaded_by: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
});

const mockFetchOk = (url: string) =>
    vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url }),
    });

const mockFetchFail = (status: number, message: string) =>
    vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ message }),
    });

describe('crmService.setTenantId — coreClient propagation', () => {
    let createSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        createSpy = vi.spyOn(documentsApi, 'create').mockResolvedValue(makeAttachment());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        createSpy.mockRestore();
    });

    describe('Given setTenantId is called with a real UUID', () => {
        it('When uploadDocument is called / Then coreClient sends the correct X-Tenant-Id header', async () => {
            const fetchSpy = mockFetchOk('https://cdn.example.com/test.pdf');
            vi.stubGlobal('fetch', fetchSpy);

            crmService.setTenantId(REAL_TENANT);
            await crmService.uploadDocument('lead-abc', makeFile());

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/v1/media/upload'),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Tenant-Id': REAL_TENANT }),
                })
            );
        });

        it('When uploadDocument is called / Then documentsApi.create receives the CDN URL', async () => {
            const cdnUrl = 'https://cdn.example.com/contract.pdf';
            vi.stubGlobal('fetch', mockFetchOk(cdnUrl));

            crmService.setTenantId(REAL_TENANT);
            await crmService.uploadDocument('lead-xyz', makeFile('contract.pdf'));

            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({ url: cdnUrl, lead_id: 'lead-xyz', name: 'contract.pdf' })
            );
        });
    });
});

describe('crmService.uploadDocument', () => {
    let createSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetchOk('https://cdn.example.com/test.pdf'));
        createSpy = vi.spyOn(documentsApi, 'create').mockResolvedValue(makeAttachment());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        createSpy.mockRestore();
    });

    describe('Given a successful upload', () => {
        it('When called with a leadId string / Then returns the created Attachment', async () => {
            const result = await crmService.uploadDocument('lead-1', makeFile());
            expect(result).toMatchObject({ id: 'doc-1', name: 'test.pdf' });
        });

        it('When called with an entity object / Then passes lead_id correctly', async () => {
            await crmService.uploadDocument({ leadId: 'lead-2' }, makeFile());
            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({ lead_id: 'lead-2', deal_id: undefined })
            );
        });

        it('When called with a deal entity / Then passes deal_id correctly', async () => {
            await crmService.uploadDocument({ dealId: 'deal-99' }, makeFile());
            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({ deal_id: 'deal-99', lead_id: undefined })
            );
        });

        it('When called / Then multipart POST is used (no Content-Type header override)', async () => {
            const fetchSpy = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ url: 'https://cdn.example.com/test.pdf' }),
            });
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadDocument('lead-1', makeFile());

            const [, init] = fetchSpy.mock.calls[0];
            expect(init.method).toBe('POST');
            expect(init.body).toBeInstanceOf(FormData);
            expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
        });
    });

    describe('Given the Core API rejects the upload', () => {
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
