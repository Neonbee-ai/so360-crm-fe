import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { emailComposeService, normalizeTemplates, normalizePreview, MERGE_FIELDS } from './emailComposeService';

beforeEach(() => { api.get.mockReset(); api.post.mockReset(); });

describe('Given the email compose service (RE G9)', () => {
    describe('When templates are listed', () => {
        it('Then GET /email-compose/templates is called and rows normalised', async () => {
            api.get.mockResolvedValueOnce([{ id: 't1', name: 'RE brochure', subject: '{{project}} brochure' }, { id: 't2', title: 'Offer' }]);
            const list = await emailComposeService.listTemplates();
            expect(api.get).toHaveBeenCalledWith('/email-compose/templates');
            expect(list).toEqual([
                { id: 't1', name: 'RE brochure', subject: '{{project}} brochure' },
                { id: 't2', name: 'Offer', subject: '' },
            ]);
        });
        it('Then {data} envelopes are unwrapped and junk / id-less rows dropped', () => {
            expect(normalizeTemplates({ data: [{ id: 'a', name: 'A' }, { name: 'no id' }, null] })).toEqual([{ id: 'a', name: 'A', subject: '' }]);
            expect(normalizeTemplates(null)).toEqual([]);
            expect(normalizeTemplates({ data: 'x' })).toEqual([]);
        });
        it('Then empty-string or non-string ids are dropped and nameless rows become Untitled', () => {
            expect(normalizeTemplates([{ id: '' , name: 'Empty' }, { id: 7, name: 'Num' }, { id: 'u', name: 3, title: null, subject: 9 }]))
                .toEqual([{ id: 'u', name: 'Untitled', subject: '' }]);
        });
    });

    describe('When a preview is requested', () => {
        it('Then it POSTs to the encoded target with only non-empty fields', async () => {
            api.post.mockResolvedValueOnce({ to_email: 'sara@x.com', subject: 'Hi Sara', body_html: '<p>Hi</p>', missing_fields: ['brochure_link'] });
            const p = await emailComposeService.preview('lead', 'l 1', { template_id: '', subject: ' Hi {{lead_name}} ', body_html: '<p>Hi</p>', to_email: '  ' });
            expect(api.post).toHaveBeenCalledWith('/email-compose/lead/l%201/preview', { subject: 'Hi {{lead_name}}', body_html: '<p>Hi</p>' });
            expect(p).toEqual({ to_email: 'sara@x.com', to_name: null, subject: 'Hi Sara', body_html: '<p>Hi</p>', missing_fields: ['brochure_link'] });
        });
        it('Then a malformed response normalises to safe empties', () => {
            expect(normalizePreview(undefined)).toEqual({ to_email: null, to_name: null, subject: '', body_html: '', missing_fields: [] });
            expect(normalizePreview({ missing_fields: ['project', 3] }).missing_fields).toEqual(['project']);
            expect(normalizePreview({ to_email: 5, to_name: 'Sara', subject: {}, body_html: [], missing_fields: 'x' }))
                .toEqual({ to_email: null, to_name: 'Sara', subject: '', body_html: '', missing_fields: [] });
        });
    });

    describe('When an email is sent', () => {
        it('Then it POSTs to /send and maps the result', async () => {
            api.post.mockResolvedValueOnce({ success: true, conversation_id: 'c1', message_id: 'm1', tracking_id: 'tk', activity_id: 'a1' });
            const r = await emailComposeService.send('deal', 'd1', { template_id: 't1' });
            expect(api.post).toHaveBeenCalledWith('/email-compose/deal/d1/send', { template_id: 't1' });
            expect(r).toEqual({ success: true, conversation_id: 'c1', message_id: 'm1', tracking_id: 'tk', activity_id: 'a1' });
        });
        it('Then a response without success:true is reported as not sent', async () => {
            api.post.mockResolvedValueOnce({});
            expect((await emailComposeService.send('contact', 'c1', {})).success).toBe(false);
        });
        it('Then a null response maps to not sent with null ids', async () => {
            api.post.mockResolvedValueOnce(null);
            expect(await emailComposeService.send('lead', 'l1', { subject: 's', body_html: 'b', to_email: ' a@b.com ' })).toEqual({
                success: false, conversation_id: null, message_id: null, tracking_id: null, activity_id: null,
            });
            expect(api.post).toHaveBeenCalledWith('/email-compose/lead/l1/send', { subject: 's', body_html: 'b', to_email: 'a@b.com' });
        });
        it('Then backend errors propagate to the caller', async () => {
            api.post.mockRejectedValueOnce(new Error('Recipient has no email address'));
            await expect(emailComposeService.send('lead', 'l1', { subject: 's', body_html: 'b' })).rejects.toThrow('Recipient has no email address');
        });
    });

    describe('When the merge-field list is read', () => {
        it('Then it matches the six RFP merge fields', () => {
            expect([...MERGE_FIELDS]).toEqual(['lead_name', 'agent_name', 'project', 'unit', 'price', 'brochure_link']);
        });
    });
});
