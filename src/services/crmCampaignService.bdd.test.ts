import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    crmCampaignService, normalizeCampaign, normalizeRoi, normalizeRoiList, normalizeRoiRow, sumRoi,
} from './crmCampaignService';

beforeEach(() => { api.get.mockReset(); });

const raw = {
    campaign: { id: 'c1', name: 'Marina Q4', status: 'active', budget: '5000', spend: '1200', utm_campaign: 'marina_q4' },
    roi: { leads: '12', qualified: 4, deals_won: 1, revenue: '3600', spend: '1200', cpl: '100', roi: '2', conversion_rate: null },
};

describe('Given the CRM campaign ROI service', () => {
    describe('When the report is requested without a status', () => {
        it('Then GET /crm-campaigns/roi is called with no query and rows are normalised', async () => {
            api.get.mockResolvedValueOnce([raw]);
            const rows = await crmCampaignService.roiReport('');
            expect(api.get).toHaveBeenCalledWith('/crm-campaigns/roi', {});
            expect(rows[0].campaign).toMatchObject({ id: 'c1', status: 'active', budget: 5000, spend: 1200 });
            expect(rows[0].roi).toMatchObject({ leads: 12, revenue: 3600, cpl: 100, roi: 2, conversion_rate: null });
        });
    });
    describe('When a status is picked', () => {
        it('Then it is sent as the status query param', async () => {
            api.get.mockResolvedValueOnce({ data: [] });
            await crmCampaignService.roiReport('paused');
            expect(api.get).toHaveBeenCalledWith('/crm-campaigns/roi', { status: 'paused' });
        });
    });
    describe('When one campaign ROI is requested', () => {
        it('Then the id is URL-encoded into the path', async () => {
            api.get.mockResolvedValueOnce(raw);
            const r = await crmCampaignService.campaignRoi('a/b');
            expect(api.get).toHaveBeenCalledWith('/crm-campaigns/a%2Fb/roi');
            expect(r.campaign.name).toBe('Marina Q4');
        });
    });
    describe('When the API errors', () => {
        it('Then the error propagates to the page', async () => {
            api.get.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 403 }));
            await expect(crmCampaignService.roiReport()).rejects.toMatchObject({ status: 403 });
        });
    });
});

describe('Given the normalisers', () => {
    it('When a campaign is sparse or has an unknown status, Then it falls back safely', () => {
        expect(normalizeCampaign({ id: 7, status: 'weird' })).toMatchObject({
            id: '7', name: 'Untitled campaign', status: 'draft', budget: null, spend: 0, channel: null,
        });
    });
    it('When ROI numbers are missing or junk, Then counts default to 0 and ratios to null', () => {
        expect(normalizeRoi({ leads: 'x', cpl: '', roi: undefined })).toEqual({
            leads: 0, qualified: 0, deals_won: 0, revenue: 0, spend: 0, cpl: null, roi: null, conversion_rate: null,
        });
    });
    it('When the envelope is an array, {data}, {rows}, {items} or junk, Then rows are derived', () => {
        expect(normalizeRoiList([raw])).toHaveLength(1);
        expect(normalizeRoiList({ data: [raw, raw] })).toHaveLength(2);
        expect(normalizeRoiList({ rows: [raw] })).toHaveLength(1);
        expect(normalizeRoiList({ items: [raw] })).toHaveLength(1);
        expect(normalizeRoiList(null)).toEqual([]);
    });
});

describe('Given sumRoi', () => {
    it('When campaigns have spend, Then blended ROI and CPL come from the totals', () => {
        const rows = normalizeRoiList([raw, { campaign: { id: 'c2' }, roi: { leads: 8, spend: 800, revenue: 0 } }]);
        expect(sumRoi(rows)).toEqual({ leads: 20, qualified: 4, deals_won: 1, revenue: 3600, spend: 2000, roi: 0.8, cpl: 100 });
    });
    it('When nothing was spent and there are no leads, Then ROI and CPL are null', () => {
        expect(sumRoi([])).toMatchObject({ leads: 0, spend: 0, roi: null, cpl: null });
    });
});

describe('Given a fully populated or absent API payload', () => {
    describe('When a campaign carries channel, currency, dates and a numeric id', () => {
        it('Then every field is kept as sent', () => {
            expect(normalizeCampaign({
                id: 'c9', name: 'Palm launch', channel: 'google', status: 'completed', budget: 0, spend: 50,
                currency: 'USD', start_date: '2026-09-01', end_date: '2026-09-30', utm_campaign: 'palm',
            })).toEqual({
                id: 'c9', name: 'Palm launch', channel: 'google', status: 'completed', budget: 0, spend: 50,
                currency: 'USD', start_date: '2026-09-01', end_date: '2026-09-30', utm_campaign: 'palm',
            });
        });
    });
    describe('When the campaign or ROI payload is undefined', () => {
        it('Then the normalisers return safe defaults', () => {
            expect(normalizeCampaign(undefined)).toMatchObject({ id: '', name: 'Untitled campaign', status: 'draft', currency: null });
            expect(normalizeRoi(undefined)).toMatchObject({ leads: 0, cpl: null });
        });
    });
    describe('When a row is null or missing its campaign / roi halves', () => {
        it('Then a default campaign and zeroed ROI are produced', () => {
            for (const r of [null, {}]) {
                const row = normalizeRoiRow(r);
                expect(row.campaign).toMatchObject({ id: '', status: 'draft' });
                expect(row.roi).toMatchObject({ leads: 0, spend: 0, roi: null });
            }
        });
    });
    describe('When a numeric field is non-finite', () => {
        it('Then it is treated as missing', () => {
            expect(normalizeRoi({ roi: 'Infinity', leads: Infinity })).toMatchObject({ roi: null, leads: 0 });
        });
    });
});
