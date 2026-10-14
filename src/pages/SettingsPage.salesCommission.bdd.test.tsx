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

vi.mock('./components/settings/SalesCommissionSettingsTab', () => ({
    default: ({ canWrite }: { canWrite: boolean }) => (
        <div data-testid="sales-tab" data-can-write={String(canWrite)} />
    ),
}));

import SettingsPage from './SettingsPage';

/**
 * Feature: CRM Settings → "Sales & commission" tab (RE Phase C).
 * Shown when either `submodule:crm:commissions` or `action:crm:unit_allocation` is on.
 */

beforeEach(() => {
    flags.on.clear();
    flags.settingsWrite = true;
    flags.loaded = true;
});

const openPage = async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('CRM Settings'));
};

describe('Given CRM Settings', () => {
    describe('When neither commissions nor unit allocation is on', () => {
        it('Then there is no Sales & commission tab', async () => {
            await openPage();
            expect(screen.queryByRole('button', { name: /sales & commission/i })).not.toBeInTheDocument();
            expect(screen.queryByTestId('sales-tab')).not.toBeInTheDocument();
        });
    });

    describe('When the commissions flag is on', () => {
        it('Then the tab opens the sales settings with write access', async () => {
            flags.on.add('submodule:crm:commissions');
            await openPage();
            fireEvent.click(screen.getByRole('button', { name: /sales & commission/i }));
            expect(await screen.findByTestId('sales-tab')).toHaveAttribute('data-can-write', 'true');
        });
    });

    describe('When only unit allocation is on and the user lacks settings write', () => {
        it('Then the tab opens read-only', async () => {
            flags.on.add('action:crm:unit_allocation');
            flags.settingsWrite = false;
            await openPage();
            fireEvent.click(screen.getByRole('button', { name: /sales & commission/i }));
            expect(await screen.findByTestId('sales-tab')).toHaveAttribute('data-can-write', 'false');
        });
    });

    describe('When the shell flags have not loaded yet', () => {
        it('Then the tab stays hidden', async () => {
            flags.on.add('submodule:crm:commissions');
            flags.loaded = false;
            await openPage();
            expect(screen.queryByRole('button', { name: /sales & commission/i })).not.toBeInTheDocument();
        });
    });
});
