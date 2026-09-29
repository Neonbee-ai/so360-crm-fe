import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    salesSettingsService, normalizeSalesSettings, validateSalesSettings, toSalesSettingsBody,
    DEFAULT_SALES_SETTINGS, EARN_TRIGGERS, type SalesSettings,
} from './salesSettingsService';

beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

const valid = (over: Partial<SalesSettings> = {}): SalesSettings => ({ ...DEFAULT_SALES_SETTINGS, overrides: [], ...over });

describe('Given the sales settings service', () => {
    describe('When settings are read', () => {
        it('Then GET /sales-settings is called and the payload normalised', async () => {
            api.get.mockResolvedValueOnce({
                earn_trigger: 'spa_signed', approval_required: false, vat_percent: '7.5',
                default_agent_share_percent: 40, team_leader_override_percent: '10',
                overrides: [{ scope: 'role', role_key: 'sales_rep', agent_share_percent: '60', team_leader_override_percent: 5 }, { scope: 'x' }, null],
                unit_visibility: 'assigned_only',
            });
            const s = await salesSettingsService.get();
            expect(api.get).toHaveBeenCalledWith('/sales-settings');
            expect(s).toEqual({
                earn_trigger: 'spa_signed', approval_required: false, vat_percent: 7.5,
                default_agent_share_percent: 40, team_leader_override_percent: 10,
                overrides: [{ scope: 'role', role_key: 'sales_rep', agent_share_percent: 60, team_leader_override_percent: 5 }],
                unit_visibility: 'assigned_only',
            });
        });
    });

    describe('When settings are saved', () => {
        it('Then PUT /sales-settings carries the trimmed body and the reply is normalised', async () => {
            api.put.mockResolvedValueOnce(null);
            const saved = await salesSettingsService.save(valid({
                overrides: [{ scope: 'user', user_id: ' u1 ', role_key: 'stale', agent_share_percent: 70, team_leader_override_percent: 0 }],
            }));
            expect(api.put).toHaveBeenCalledWith('/sales-settings', expect.objectContaining({
                overrides: [{ scope: 'user', user_id: 'u1', agent_share_percent: 70, team_leader_override_percent: 0 }],
            }));
            expect(saved).toEqual(valid());
        });
    });
});

describe('Given raw sales settings to normalise', () => {
    it('When nothing is stored, Then the contract defaults apply', () => {
        expect(normalizeSalesSettings(null)).toEqual(valid());
        expect(normalizeSalesSettings('x')).toEqual(valid());
    });
    it('When values are junk, Then each field falls back to its default', () => {
        expect(normalizeSalesSettings({
            earn_trigger: 'whenever', approval_required: 'yes', vat_percent: 'abc',
            default_agent_share_percent: null, team_leader_override_percent: undefined,
            overrides: 'nope', unit_visibility: 'mine',
        })).toEqual(valid());
    });
    it('When an override omits its keys and numbers, Then they read as blank and 0', () => {
        expect(normalizeSalesSettings({ overrides: [{ scope: 'user' }, { scope: 'role' }] }).overrides).toEqual([
            { scope: 'user', user_id: '', agent_share_percent: 0, team_leader_override_percent: 0 },
            { scope: 'role', role_key: '', agent_share_percent: 0, team_leader_override_percent: 0 },
        ]);
    });
    it('Then every earn trigger option is a contract value', () => {
        expect(EARN_TRIGGERS.map((t) => t.value)).toEqual(['booking', 'spa_signed', 'developer_paid']);
    });
});

describe('Given sales settings to validate', () => {
    it('When everything is in range, Then there is no error', () => {
        expect(validateSalesSettings(valid())).toBeNull();
    });
    it.each([
        [{ vat_percent: -1 }, 'VAT must be between 0 and 100%.'],
        [{ vat_percent: NaN }, 'VAT must be between 0 and 100%.'],
        [{ default_agent_share_percent: 101 }, 'Agent share must be between 0 and 100%.'],
        [{ team_leader_override_percent: -5 }, 'Team-leader override must be between 0 and 100%.'],
        [{ default_agent_share_percent: 80, team_leader_override_percent: 30 }, 'Agent share and team-leader override together cannot exceed 100%.'],
    ])('When %o, Then it says "%s"', (over, msg) => {
        expect(validateSalesSettings(valid(over as Partial<SalesSettings>))).toBe(msg);
    });
    it('When an override has no role or user, Then it asks for one', () => {
        expect(validateSalesSettings(valid({ overrides: [{ scope: 'role', role_key: ' ', agent_share_percent: 1, team_leader_override_percent: 0 }] })))
            .toBe('Override 1: pick a role.');
        expect(validateSalesSettings(valid({ overrides: [{ scope: 'user', agent_share_percent: 1, team_leader_override_percent: 0 }] })))
            .toBe('Override 1: pick a user.');
    });
    it('When the same user is overridden twice, Then the duplicate is flagged', () => {
        const o = { scope: 'user' as const, user_id: 'u1', agent_share_percent: 10, team_leader_override_percent: 0 };
        expect(validateSalesSettings(valid({ overrides: [o, o] }))).toBe('Override 2: this user already has an override.');
    });
    it('When an override percent is out of range or totals over 100, Then it is flagged', () => {
        expect(validateSalesSettings(valid({ overrides: [{ scope: 'role', role_key: 'r', agent_share_percent: 120, team_leader_override_percent: 0 }] })))
            .toBe('Override 1: percentages must be between 0 and 100.');
        expect(validateSalesSettings(valid({ overrides: [{ scope: 'role', role_key: 'r', agent_share_percent: 60, team_leader_override_percent: 50 }] })))
            .toBe('Override 1: agent share and override together cannot exceed 100%.');
    });
    it('When a role override has blank keys, Then the body trims it to an empty role', () => {
        expect(toSalesSettingsBody(valid({ overrides: [{ scope: 'role', agent_share_percent: 1, team_leader_override_percent: 2 }] })).overrides)
            .toEqual([{ scope: 'role', role_key: '', agent_share_percent: 1, team_leader_override_percent: 2 }]);
        expect(toSalesSettingsBody(valid({ overrides: [{ scope: 'user', agent_share_percent: 1, team_leader_override_percent: 2 }] })).overrides)
            .toEqual([{ scope: 'user', user_id: '', agent_share_percent: 1, team_leader_override_percent: 2 }]);
    });
});
