/**
 * crmService.isQuoteAutoNumbering — reads Settings → Numbering from Core (Pulse 0d0775ba)
 *
 * The New Quote modal asks for a hand-typed number only when the org turned
 * Sales Quote auto-numbering off. crm-be enforces the real setting, so when
 * Core cannot be read the form falls back to auto rather than blocking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

const ORG = '7f1c2a9e-1111-4c2b-9b1a-2d3e4f5a6b7c';

const fetchReturning = (body: unknown, ok = true, status = 200) =>
    vi.fn().mockResolvedValue({
        ok,
        status,
        headers: new Headers(),
        text: () => Promise.resolve(JSON.stringify(body)),
        json: async () => body,
    });

describe('crmService.isQuoteAutoNumbering()', () => {
    beforeEach(() => {
        crmService.setOrgId(ORG);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Given the sales_quote scheme has auto-generation enabled', () => {
        it('When asked / Then it is auto, read from the org numbering endpoint', async () => {
            const fetchMock = fetchReturning({ sales_quote: { enabled: true, prefix: 'QT' } });
            vi.stubGlobal('fetch', fetchMock);

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
            expect(String(fetchMock.mock.calls[0][0])).toContain(`/v1/business-settings/${ORG}/numbering`);
        });
    });

    describe('Given the admin turned Sales Quote auto-numbering off', () => {
        it('When asked / Then it is manual', async () => {
            vi.stubGlobal('fetch', fetchReturning({ sales_quote: { enabled: false } }));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(false);
        });
    });

    describe('Given no sales_quote scheme in the response', () => {
        it('When asked / Then it defaults to auto', async () => {
            vi.stubGlobal('fetch', fetchReturning({ invoice: { enabled: false } }));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
        });
    });

    describe('Given Core answers with an error', () => {
        it('When asked / Then it falls back to auto (crm-be still enforces the setting)', async () => {
            vi.stubGlobal('fetch', fetchReturning({ message: 'Unauthorized' }, false, 401));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
        });
    });

    describe('Given the request itself fails', () => {
        it('When asked / Then it falls back to auto', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
        });
    });
});
