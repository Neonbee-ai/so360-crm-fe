import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), getBlob: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { ANALYTICS_SECTIONS, normalizeSalesAnalytics, salesAnalyticsService } from './salesAnalyticsService';

/** Feature: RE §30 sales analytics client. */
beforeEach(() => {
    api.get.mockReset();
    api.getBlob.mockReset();
    api.getBlob.mockResolvedValue({ blob: new Blob(['x']), filename: 'f.csv' });
    (window.URL as any).createObjectURL = vi.fn(() => 'blob:x');
    (window.URL as any).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('Feature: sales analytics service', () => {
    describe('Given an empty or malformed payload', () => {
        it.each([null, undefined, {}, 'nope'])('then %p normalises to a full zeroed shape', (raw) => {
            const a = normalizeSalesAnalytics(raw);
            expect(a.period).toBe('month');
            expect(a.totals).toEqual({ bookings: 0, booking_value: 0, avg_deal_value: 0, leads: 0, converted_leads: 0, lost_deals: 0, lost_value: 0 });
            expect(a.reservations).toEqual({ active: 0, committed: 0, released: 0, total: 0 });
            for (const k of ['by_agent', 'by_project', 'by_developer', 'by_period', 'by_source', 'lost_reasons', 'agent_performance'] as const) {
                expect(a[k]).toEqual([]);
            }
        });
    });

    describe('Given rows with missing names and numeric strings', () => {
        const a = normalizeSalesAnalytics({
            period: 'quarter',
            totals: { bookings: '3', booking_value: null, lost_value: 'x' },
            by_agent: [{ agent_id: null, agent_name: ' ', deals: '2', sale_value: '100.5' }],
            by_project: [{ project_id: 'p1', project_name: null }],
            by_developer: [{ developer_id: 'd1' }],
            by_period: [{ period: null, deals: 1 }],
            by_source: [{ source: '', campaign: null, leads: 4 }],
            lost_reasons: [{ key: null, label: '' , count: '1' }],
            agent_performance: [{ user_id: 'u1', name: null }, { person_id: 'p9', user_id: 'u9', name: 'Bilal' }],
        });

        it('then numbers are coerced and bad values become 0', () => {
            expect(a.period).toBe('quarter');
            expect(a.totals.bookings).toBe(3);
            expect(a.totals.booking_value).toBe(0);
            expect(a.totals.lost_value).toBe(0);
            expect(a.by_agent[0]).toEqual({ key: '', label: 'Unassigned', deals: 2, sale_value: 100.5 });
        });

        it('then readable fallback labels are used', () => {
            expect(a.by_project[0].label).toBe('No project');
            expect(a.by_developer[0].label).toBe('No developer');
            expect(a.by_period[0].label).toBe('—');
            expect(a.by_source[0]).toMatchObject({ source: 'Unknown', campaign: '—', leads: 4 });
            expect(a.lost_reasons[0]).toMatchObject({ key: '', label: 'Unspecified', count: 1 });
            expect(a.agent_performance[0]).toMatchObject({ key: 'u1', name: 'Unknown agent' });
        });

        it('then an agent with neither person_id nor user_id gets an empty key', () => {
            expect(normalizeSalesAnalytics({ agent_performance: [{ name: 'Nadia' }] }).agent_performance[0]).toMatchObject({ key: '', name: 'Nadia' });
        });

        it('then an agent is keyed by People Connect person_id before user_id', () => {
            expect(a.agent_performance[1]).toMatchObject({ key: 'p9', name: 'Bilal' });
        });
    });

    describe('When the report is fetched', () => {
        it('then the set filters and the period are sent and the reply is normalised', async () => {
            api.get.mockResolvedValue({ period: 'year', totals: { bookings: 1 } });
            const a = await salesAnalyticsService.get({ project_id: 'p1', agent_id: '', from: '2026-01-01' } as any, 'year');
            expect(api.get).toHaveBeenCalledWith('/reports/sales-analytics', { project_id: 'p1', from: '2026-01-01', period: 'year' });
            expect(a.totals.bookings).toBe(1);
        });

        it('then a server error propagates to the page', async () => {
            api.get.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            await expect(salesAnalyticsService.get({} as any, 'month')).rejects.toThrow('Forbidden');
        });
    });

    describe('When a section is exported', () => {
        it.each(ANALYTICS_SECTIONS.map((s) => [s]))('then section %s goes to the export endpoint with filters, period and format', async (section) => {
            await salesAnalyticsService.exportSection({ developer_id: 'd1' } as any, 'quarter', section, 'xlsx');
            expect(api.getBlob).toHaveBeenLastCalledWith('/reports/sales-analytics/export', {
                developer_id: 'd1', period: 'quarter', section, format: 'xlsx',
            });
        });
    });
});
