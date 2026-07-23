import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';

const makeFile = (name = 'call.mp3', type = 'audio/mpeg') =>
    new File(['audio-bytes'], name, { type });

const makeCallRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'call-1',
    tenant_id: REAL_TENANT,
    org_id: 'org-1',
    lead_id: 'lead-1',
    deal_id: null,
    direction: 'outbound',
    occurred_at: '2026-07-23T00:00:00Z',
    duration_seconds: 120,
    phone_number: '+15550000000',
    owner_person_id: null,
    dms_document_id: 'dms-call-1',
    transcript: null,
    transcript_text: 'Hello, this is a test call.',
    sentiment: 'positive',
    emotion_scores: null,
    external_call_id: null,
    source: 'manual',
    created_by: 'user-1',
    created_at: '2026-07-23T00:00:00Z',
    updated_at: '2026-07-23T00:00:00Z',
    ...overrides,
});

const mockFetchOk = (body: unknown) =>
    vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        json: async () => body,
    });

const mockFetchFail = (status: number, message: string) =>
    vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: () => Promise.resolve(JSON.stringify({ message })),
        json: async () => ({ message }),
    });

describe('callsApi / crmService — call recordings, transcripts, sentiment', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Given getCallsByLeadId is called', () => {
        it('When the lead has calls / Then it GETs /calls/lead/:id and returns the array', async () => {
            const fetchSpy = mockFetchOk([makeCallRecord()]);
            vi.stubGlobal('fetch', fetchSpy);

            const calls = await crmService.getCallsByLeadId('lead-1');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/lead/lead-1'),
                expect.objectContaining({ method: 'GET' })
            );
            expect(calls).toHaveLength(1);
            expect(calls[0]).toMatchObject({ id: 'call-1', sentiment: 'positive' });
        });
    });

    describe('Given getCallsByDealId is called', () => {
        it('When the deal has calls / Then it GETs /calls/deal/:id and returns the array', async () => {
            const fetchSpy = mockFetchOk([makeCallRecord({ id: 'call-2', lead_id: null, deal_id: 'deal-1' })]);
            vi.stubGlobal('fetch', fetchSpy);

            const calls = await crmService.getCallsByDealId('deal-1');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/deal/deal-1'),
                expect.objectContaining({ method: 'GET' })
            );
            expect(calls[0]).toMatchObject({ id: 'call-2', deal_id: 'deal-1' });
        });
    });

    describe('Given uploadCallRecording is called for a lead', () => {
        it('When called / Then it POSTs multipart to /calls/upload with the X-Tenant-Id header and lead_id in the form body', async () => {
            const fetchSpy = mockFetchOk(makeCallRecord());
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadCallRecording(makeFile(), {
                lead_id: 'lead-1',
                direction: 'outbound',
                occurred_at: '2026-07-23T00:00:00Z',
                duration_seconds: 90,
                phone_number: '+15550000000',
                transcript_text: 'Test transcript',
                sentiment: 'neutral',
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/upload'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ 'X-Tenant-Id': REAL_TENANT }),
                })
            );
            const [, init] = fetchSpy.mock.calls[0];
            const form = init.body as FormData;
            expect(form.get('file')).toBeInstanceOf(File);
            expect(form.get('lead_id')).toBe('lead-1');
            expect(form.get('deal_id')).toBeNull();
            expect(form.get('direction')).toBe('outbound');
            expect(form.get('duration_seconds')).toBe('90');
            expect(form.get('transcript_text')).toBe('Test transcript');
            expect(form.get('sentiment')).toBe('neutral');
            expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
        });
    });

    describe('Given uploadCallRecording is called for a deal', () => {
        it('When called / Then deal_id is sent and lead_id is absent', async () => {
            const fetchSpy = mockFetchOk(makeCallRecord({ lead_id: null, deal_id: 'deal-9' }));
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.uploadCallRecording(makeFile(), { deal_id: 'deal-9' });

            const form = (fetchSpy.mock.calls[0][1].body) as FormData;
            expect(form.get('deal_id')).toBe('deal-9');
            expect(form.get('lead_id')).toBeNull();
        });

        it('When the upload fails / Then the error message propagates to the caller', async () => {
            vi.stubGlobal('fetch', mockFetchFail(400, 'exactly one of lead_id or deal_id is required'));

            await expect(crmService.uploadCallRecording(makeFile(), {})).rejects.toThrow(
                'exactly one of lead_id or deal_id is required'
            );
        });
    });

    describe('Given getCallPlaybackUrl is called', () => {
        it('When the BE returns a signed url / Then it GETs /calls/:id/playback-url and returns { url, expires_in }', async () => {
            const fetchSpy = mockFetchOk({ url: 'https://signed.example.com/call.mp3', expires_in: 600 });
            vi.stubGlobal('fetch', fetchSpy);

            const result = await crmService.getCallPlaybackUrl('call-1');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/call-1/playback-url'),
                expect.objectContaining({ method: 'GET' })
            );
            expect(result).toEqual({ url: 'https://signed.example.com/call.mp3', expires_in: 600 });
        });
    });

    describe('Given updateCallRecord is called', () => {
        it('When called with transcript/sentiment/emotion_scores / Then it PATCHes /calls/:id with the JSON body', async () => {
            const fetchSpy = mockFetchOk(makeCallRecord({ sentiment: 'mixed' }));
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.updateCallRecord('call-1', {
                transcript_text: 'Updated transcript',
                sentiment: 'mixed',
                emotion_scores: { anger: 0.1, joy: 0.6 },
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/call-1'),
                expect.objectContaining({ method: 'PATCH' })
            );
            const [, init] = fetchSpy.mock.calls[0];
            expect(JSON.parse(init.body as string)).toEqual({
                transcript_text: 'Updated transcript',
                sentiment: 'mixed',
                emotion_scores: { anger: 0.1, joy: 0.6 },
            });
        });
    });

    describe('Given deleteCallRecord is called', () => {
        it('When called / Then it DELETEs /calls/:id', async () => {
            const fetchSpy = mockFetchOk({});
            vi.stubGlobal('fetch', fetchSpy);

            await crmService.deleteCallRecord('call-1');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/calls/call-1'),
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });
});
