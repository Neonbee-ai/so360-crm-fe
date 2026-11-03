import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    leadTemperatureSettingsService,
    normalizeLeadTemperatureSettings,
    validateLeadTemperatureSettings,
    toLeadTemperatureBody,
    DEFAULT_LEAD_TEMPERATURE_SETTINGS,
    type LeadTemperatureSettings,
} from './leadTemperatureSettingsService';

/**
 * Feature: per-org Hot/Warm/Cold thresholds and factor weights (RE plan E §20).
 * Tenant/org scoping is carried by crmApiClient headers; the service never
 * sends ids in the URL or body.
 */

beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

const valid = (over: Partial<LeadTemperatureSettings> = {}): LeadTemperatureSettings => ({
    ...DEFAULT_LEAD_TEMPERATURE_SETTINGS,
    weights: { ...DEFAULT_LEAD_TEMPERATURE_SETTINGS.weights },
    is_default: false,
    ...over,
});

describe('Given the lead temperature settings service', () => {
    describe('When settings are read', () => {
        it('Then GET /settings/lead-temperature is called and the payload normalised', async () => {
            api.get.mockResolvedValueOnce({
                hot_min: '75', warm_min: 45,
                weights: { budget_fit: 40, timeline: '20', engagement: 30, source_quality: 10 },
                source_quality: { referral: 100, cold_call: 'x' },
                timeline: { immediate: 100 },
                is_default: false,
            });
            const s = await leadTemperatureSettingsService.get();
            expect(api.get).toHaveBeenCalledWith('/settings/lead-temperature');
            expect(s).toEqual({
                hot_min: 75, warm_min: 45,
                weights: { budget_fit: 40, timeline: 20, engagement: 30, source_quality: 10 },
                source_quality: { referral: 100 },
                timeline: { immediate: 100 },
                is_default: false,
            });
        });

        it('Then a failing request propagates to the caller', async () => {
            api.get.mockRejectedValueOnce(new Error('403'));
            await expect(leadTemperatureSettingsService.get()).rejects.toThrow('403');
        });
    });

    describe('When settings are saved', () => {
        it('Then PUT /settings/lead-temperature carries only thresholds and weights', async () => {
            api.put.mockResolvedValueOnce({ hot_min: 80, warm_min: 50, weights: { budget_fit: 25, timeline: 25, engagement: 25, source_quality: 25 } });
            const saved = await leadTemperatureSettingsService.save(valid({
                hot_min: 80, warm_min: 50,
                weights: { budget_fit: 25, timeline: 25, engagement: 25, source_quality: 25 },
                source_quality: { referral: 90 },
            }));
            expect(api.put).toHaveBeenCalledWith('/settings/lead-temperature', {
                hot_min: 80, warm_min: 50,
                weights: { budget_fit: 25, timeline: 25, engagement: 25, source_quality: 25 },
            });
            expect(saved.hot_min).toBe(80);
            expect(saved.weights.source_quality).toBe(25);
        });
    });
});

describe('Given raw temperature settings to normalise', () => {
    it('When nothing is stored, Then the defaults apply (hot 70, warm 40, 30/30/25/15)', () => {
        const d = normalizeLeadTemperatureSettings(null);
        expect(d.hot_min).toBe(70);
        expect(d.warm_min).toBe(40);
        expect(d.weights).toEqual({ budget_fit: 30, timeline: 30, engagement: 25, source_quality: 15 });
        expect(d.is_default).toBe(true);
    });

    it('When values are junk, Then each field falls back to its default', () => {
        const d = normalizeLeadTemperatureSettings({ hot_min: 'abc', warm_min: null, weights: 'x', source_quality: [1], timeline: 'y' });
        expect(d).toEqual({ ...DEFAULT_LEAD_TEMPERATURE_SETTINGS, weights: { ...DEFAULT_LEAD_TEMPERATURE_SETTINGS.weights }, is_default: false });
    });

    it('When weights are absent and thresholds are blank strings, Then defaults fill every gap', () => {
        const d = normalizeLeadTemperatureSettings({ hot_min: '  ', warm_min: '', is_default: true });
        expect(d).toEqual({ ...DEFAULT_LEAD_TEMPERATURE_SETTINGS, weights: { ...DEFAULT_LEAD_TEMPERATURE_SETTINGS.weights } });
    });

    it('When the payload is not an object, Then the defaults apply', () => {
        expect(normalizeLeadTemperatureSettings('nope').hot_min).toBe(70);
    });

    it('When a point map holds numeric strings and junk, Then only finite numbers are kept', () => {
        const d = normalizeLeadTemperatureSettings({ source_quality: { a: '40', b: '', c: Infinity }, timeline: null });
        expect(d.source_quality).toEqual({ a: 40 });
        expect(d.timeline).toEqual({});
    });

    it('When normalised twice, Then the defaults object is not mutated', () => {
        const a = normalizeLeadTemperatureSettings(undefined);
        a.weights.budget_fit = 99;
        expect(DEFAULT_LEAD_TEMPERATURE_SETTINGS.weights.budget_fit).toBe(30);
    });
});

describe('Given temperature settings to validate', () => {
    it('When the defaults are used, Then there is no problem', () => {
        expect(validateLeadTemperatureSettings(valid())).toBeNull();
    });
    it('When a threshold is outside 0–100 or empty, Then it is rejected', () => {
        expect(validateLeadTemperatureSettings(valid({ hot_min: 101 }))).toMatch(/Hot threshold/);
        expect(validateLeadTemperatureSettings(valid({ warm_min: -1 }))).toMatch(/Warm threshold/);
        expect(validateLeadTemperatureSettings(valid({ hot_min: Number.NaN }))).toMatch(/Hot threshold/);
        expect(validateLeadTemperatureSettings(valid({ hot_min: -5 }))).toMatch(/Hot threshold/);
        expect(validateLeadTemperatureSettings(valid({ warm_min: Number.NaN }))).toMatch(/Warm threshold/);
        expect(validateLeadTemperatureSettings(valid({ warm_min: 150 }))).toMatch(/Warm threshold/);
    });
    it('When Hot is not above Warm, Then it is rejected', () => {
        expect(validateLeadTemperatureSettings(valid({ hot_min: 40, warm_min: 40 }))).toBe('Hot threshold must be greater than the Warm threshold.');
    });
    it('When a weight is out of range, Then the factor is named', () => {
        expect(validateLeadTemperatureSettings(valid({ weights: { budget_fit: 30, timeline: 30, engagement: 200, source_quality: 15 } })))
            .toBe('Engagement weight must be between 0 and 100.');
    });
    it('When a weight is negative or empty, Then that factor is named', () => {
        expect(validateLeadTemperatureSettings(valid({ weights: { budget_fit: -1, timeline: 30, engagement: 25, source_quality: 15 } })))
            .toBe('Budget fit weight must be between 0 and 100.');
        expect(validateLeadTemperatureSettings(valid({ weights: { budget_fit: 30, timeline: 30, engagement: 25, source_quality: Number.NaN } })))
            .toBe('Source quality weight must be between 0 and 100.');
    });
    it('When every weight is 0, Then it is rejected', () => {
        expect(validateLeadTemperatureSettings(valid({ weights: { budget_fit: 0, timeline: 0, engagement: 0, source_quality: 0 } })))
            .toBe('At least one weight must be above 0.');
    });
});

describe('Given settings to send', () => {
    it('When the body is built, Then the point maps and is_default are left out', () => {
        const body = toLeadTemperatureBody(valid({ source_quality: { referral: 1 }, timeline: { soon: 2 } }));
        expect(body).toEqual({ hot_min: 70, warm_min: 40, weights: { budget_fit: 30, timeline: 30, engagement: 25, source_quality: 15 } });
    });
});
