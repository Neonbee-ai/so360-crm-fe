import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), settingsWrite: true, loaded: true }));

vi.mock('../services/crmService', () => ({
    crmService: {
        getSettings: vi.fn().mockResolvedValue({
            deal_stages: [{ id: 'st-1', name: 'New', type: 'OPEN' }],
            lead_stages: [], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [],
            lead_scoring: [], score_categories: [], source_type_options: [],
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

import SettingsPage from './SettingsPage';

/** Feature: CRM Settings → "Ideal customers" entry, gated by `submodule:crm:icp_manager`. */

beforeEach(() => {
    flags.on.clear();
    flags.settingsWrite = true;
    flags.loaded = true;
});

const open = async (props: { onOpenIcps?: () => void } | null) => {
    if (props) render(<SettingsPage {...props} />); else render(<SettingsPage />);
    await waitFor(() => screen.getByText('CRM Settings'));
};

describe('Given the CRM settings page', () => {
    describe('When the ICP flag is on and a handler is supplied', () => {
        it('Then the Ideal customers link shows and opens the ICP manager on click', async () => {
            flags.on.add('submodule:crm:icp_manager');
            const onOpenIcps = vi.fn();
            await open({ onOpenIcps });
            fireEvent.click(screen.getByTestId('settings-open-icps'));
            expect(onOpenIcps).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Ideal customers')).toBeTruthy();
        });
    });

    describe('When the ICP flag is off', () => {
        it('Then the link is not shown', async () => {
            await open({ onOpenIcps: vi.fn() });
            expect(screen.queryByTestId('settings-open-icps')).toBeNull();
        });
    });

    describe('When the flag is on but no handler is supplied', () => {
        it('Then the link is not shown (default props)', async () => {
            flags.on.add('submodule:crm:icp_manager');
            await open(null);
            expect(screen.queryByTestId('settings-open-icps')).toBeNull();
        });
    });

    describe('When the effective flags have not loaded yet', () => {
        it('Then the link is not shown even if the key reads on', async () => {
            flags.on.add('submodule:crm:icp_manager');
            flags.loaded = false;
            await open({ onOpenIcps: vi.fn() });
            expect(screen.queryByTestId('settings-open-icps')).toBeNull();
        });
    });

    describe('When only an unrelated flag is on', () => {
        it('Then the link is not shown', async () => {
            flags.on.add('submodule:crm:commissions');
            await open({ onOpenIcps: vi.fn() });
            expect(screen.queryByTestId('settings-open-icps')).toBeNull();
        });
    });
});
