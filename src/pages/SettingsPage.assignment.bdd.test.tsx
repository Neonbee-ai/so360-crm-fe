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

vi.mock('./components/settings/AssignmentRulesSettingsTab', () => ({
    default: ({ canWrite }: { canWrite: boolean }) => (
        <div data-testid="assignment-tab" data-can-write={String(canWrite)} />
    ),
}));

import SettingsPage from './SettingsPage';

beforeEach(() => {
    flags.on.clear();
    flags.settingsWrite = true;
    flags.loaded = true;
});

describe('Given CRM Settings', () => {
    describe('When the lead assignment flag is off (non-RE tenant)', () => {
        it('Then there is no Assignment tab', async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            expect(screen.queryByRole('button', { name: /^assignment$/i })).not.toBeInTheDocument();
            expect(screen.queryByTestId('assignment-tab')).not.toBeInTheDocument();
        });
    });

    describe('When the lead assignment flag is on', () => {
        it('Then the Assignment tab opens the rules editor with write access', async () => {
            flags.on.add('submodule:crm:lead_assignment');
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            fireEvent.click(screen.getByRole('button', { name: /^assignment$/i }));
            expect(await screen.findByTestId('assignment-tab')).toHaveAttribute('data-can-write', 'true');
        });
    });

    describe('When the flag is on but the user lacks the settings write flag', () => {
        it('Then the rules editor opens read-only', async () => {
            flags.on.add('submodule:crm:lead_assignment');
            flags.settingsWrite = false;
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            fireEvent.click(screen.getByRole('button', { name: /^assignment$/i }));
            expect(await screen.findByTestId('assignment-tab')).toHaveAttribute('data-can-write', 'false');
        });
    });

    describe('When the Assignment tab is active and another tab is chosen', () => {
        it('Then the Assignment button is highlighted only while active and the editor unmounts', async () => {
            flags.on.add('submodule:crm:lead_assignment');
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            const tab = screen.getByRole('button', { name: /^assignment$/i });
            expect(tab.className).toMatch(/text-slate-500/);
            fireEvent.click(tab);
            await screen.findByTestId('assignment-tab');
            expect(tab.className).toMatch(/bg-blue-600/);
            fireEvent.click(screen.getByRole('button', { name: /^pipeline$/i }));
            await waitFor(() => expect(screen.queryByTestId('assignment-tab')).not.toBeInTheDocument());
            expect(tab.className).not.toMatch(/bg-blue-600/);
        });
    });

    describe('When the flag is on but effective flags have not loaded', () => {
        it('Then there is no Assignment tab (fail closed)', async () => {
            flags.on.add('submodule:crm:lead_assignment');
            flags.loaded = false;
            render(<SettingsPage />);
            await waitFor(() => screen.getByText('CRM Settings'));
            expect(screen.queryByRole('button', { name: /^assignment$/i })).not.toBeInTheDocument();
        });
    });
});
