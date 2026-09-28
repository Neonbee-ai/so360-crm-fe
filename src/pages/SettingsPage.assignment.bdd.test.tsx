import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>() }));

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
        effectiveFlagsLoaded: true,
        isFeatureEnabled: (key: string) => key === 'submodule:crm:settings' || flags.on.has(key),
        isFeatureHidden: () => false,
    }),
}));

vi.mock('./components/settings/AssignmentRulesSettingsTab', () => ({
    default: ({ canWrite }: { canWrite: boolean }) => (
        <div data-testid="assignment-tab" data-can-write={String(canWrite)} />
    ),
}));

import SettingsPage from './SettingsPage';

beforeEach(() => flags.on.clear());

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
});
