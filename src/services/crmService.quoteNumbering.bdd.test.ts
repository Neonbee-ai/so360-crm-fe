/**
 * crmService.isQuoteAutoNumbering — reads Settings → Documents → Numbering from Core (Pulse 0d0775ba)
 *
 * The New Quote modal asks for a hand-typed number only when the org turned
 * Sales Quote auto-numbering off. Same rule as crm-be: the panel's
 * "Auto-number documents sequentially" checkbox (auto_numbering) is the master
 * switch; when it is on, numbering_schemes.sales_quote.enabled decides. crm-be
 * enforces the real setting, so when Core cannot be read the form falls back
 * to auto.
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

const settings = (document_settings: unknown) => ({ base_currency: 'INR', document_settings });

describe('crmService.isQuoteAutoNumbering()', () => {
    beforeEach(() => {
        crmService.setOrgId(ORG);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Given the Sales Quote switch is saved ON', () => {
        it("When asked / Then it is auto, read from the org's business settings", async () => {
            const fetchMock = fetchReturning(settings({ numbering_schemes: { sales_quote: { enabled: true } } }));
            vi.stubGlobal('fetch', fetchMock);

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
            expect(String(fetchMock.mock.calls[0][0])).toMatch(new RegExp(`/v1/business-settings/${ORG}$`));
        });
    });

    describe('Given the Sales Quote switch is saved OFF', () => {
        it('When asked / Then it is manual, even if "Auto-number documents" is ticked', async () => {
            vi.stubGlobal('fetch', fetchReturning(settings({
                auto_numbering: true,
                numbering_schemes: { sales_quote: { enabled: false } },
            })));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(false);
        });
    });

    describe('Given only the "Auto-number documents" checkbox was saved', () => {
        it('When it is unticked / Then quotes are manual', async () => {
            vi.stubGlobal('fetch', fetchReturning(settings({ auto_numbering: false })));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(false);
        });

        it('When it is unticked but the Sales Quote scheme says ON / Then the checkbox wins (manual)', async () => {
            vi.stubGlobal('fetch', fetchReturning(settings({
                auto_numbering: false,
                numbering_schemes: { sales_quote: { enabled: true } },
            })));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(false);
        });

        it('When it is ticked / Then quotes are auto', async () => {
            vi.stubGlobal('fetch', fetchReturning(settings({ auto_numbering: true })));

            await expect(crmService.isQuoteAutoNumbering()).resolves.toBe(true);
        });
    });

    describe('Given nothing numbering-related was ever saved', () => {
        it('When asked / Then it defaults to auto', async () => {
            vi.stubGlobal('fetch', fetchReturning({ base_currency: 'INR' }));

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
