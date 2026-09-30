import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), settingsWrite: true, loaded: true }));

vi.mock('../services/crmService', () => ({
    crmService: {
        getSettings: vi.fn().mockResolvedValue({
            deal_stages: [{ id: 'st-1', name: 'New', type: 'OPEN' }],
            lead_stages: [],
            lead_custom_fields: [],
            deal_custom_fields: [],
            lead_sources: [],
            lead_scoring: [],
            score_categories: [],
            source_type_options: [],
        }),
        updateSettings: vi.fn(),
        updateDealNamingSettings: vi.fn(),
    },
    settingsApi: {
        sourceTypes: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        scoringRules: { getAll: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), recalculate: vi.fn() },
        scoreCategories: { getAll: vi.fn().mockResolvedValue([]), update: vi.fn() },
    },
}));

vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
    useShellBridge: () => ({
        effectiveFlagsLoaded: flags.loaded,
        isFeatureEnabled: (key: string) => (key === 'submodule:crm:settings' ? flags.settingsWrite : flags.on.has(key)),
        isFeatureHidden: () => false,
    }),
}));

vi.mock('./components/settings/LeadTemperatureSettingsCard', () => ({
    default: ({ canWrite }: { canWrite: boolean }) => (
        <div data-testid="temperature-card" data-can-write={String(canWrite)} />
    ),
}));

import SettingsPage from './SettingsPage';

/**
 * Feature: CRM Settings → Lead Scoring → Lead temperature card (RE plan E §20).
 * Shown only when `submodule:crm:re_lead_temperature` is on; write access
 * follows `submodule:crm:settings`.
 */

const FLAG = 'submodule:crm:re_lead_temperature';

beforeEach(() => {
    flags.on.clear();
    flags.settingsWrite = true;
    flags.loaded = true;
});

const openScoring = async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('CRM Settings'));
    fireEvent.click(screen.getByRole('button', { name: /lead scoring/i }));
};

describe('Given CRM Settings → Lead Scoring', () => {
    describe('When the lead temperature flag is off', () => {
        it('Then the temperature card is not shown', async () => {
            await openScoring();
            await waitFor(() => expect(screen.getByText('Lead Scoring Rules')).toBeInTheDocument());
            expect(screen.queryByTestId('temperature-card')).not.toBeInTheDocument();
        });
    });

    describe('When the flag is on and the user can write settings', () => {
        it('Then the card shows with write access', async () => {
            flags.on.add(FLAG);
            await openScoring();
            expect(await screen.findByTestId('temperature-card')).toHaveAttribute('data-can-write', 'true');
        });
    });

    describe('When the flag is on but the user lacks settings write', () => {
        it('Then the card shows read-only', async () => {
            flags.on.add(FLAG);
            flags.settingsWrite = false;
            await openScoring();
            expect(await screen.findByTestId('temperature-card')).toHaveAttribute('data-can-write', 'false');
        });
    });

    describe('When another tab is open', () => {
        it('Then the card is not mounted (no settings request)', async () => {
            flags.on.add(FLAG);
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            expect(screen.queryByTestId('temperature-card')).not.toBeInTheDocument();
        });
    });
});
