import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { LeadTemperatureSettings } from '../../../services/leadTemperatureSettingsService';

/**
 * Feature: Lead temperature settings card icon fallbacks (RE plan E §20).
 *
 * The shared lucide stub lacks Thermometer but has Loader2 / Save. This spec
 * flips that: Thermometer present, Loader2 and Save missing — so every
 * `Icon ? <Icon/> : null` guard is exercised on its other side.
 */
vi.mock('lucide-react', () => ({
    Thermometer: (p: any) => <svg data-testid="icon-Thermometer" {...p} />,
    Loader2: undefined,
    Save: undefined,
}));

const svc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../../services/leadTemperatureSettingsService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/leadTemperatureSettingsService')>();
    return { ...actual, leadTemperatureSettingsService: svc };
});
vi.mock('@so360/design-system', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LeadTemperatureSettingsCard from './LeadTemperatureSettingsCard';

const settings: LeadTemperatureSettings = {
    hot_min: 70,
    warm_min: 40,
    weights: { budget_fit: 30, timeline: 30, engagement: 25, source_quality: 15 },
    source_quality: {},
    timeline: {},
    is_default: true,
};

beforeEach(() => {
    svc.get.mockReset();
    svc.save.mockReset();
});

describe('Given the settings card with Thermometer available and Loader2/Save missing', () => {
    describe('When settings are loading', () => {
        it('Then the heading shows the thermometer and the loading text renders without a spinner', () => {
            svc.get.mockReturnValue(new Promise(() => {}));
            render(<LeadTemperatureSettingsCard canWrite />);
            expect(screen.getByTestId('icon-Thermometer')).toBeInTheDocument();
            const status = screen.getByRole('status');
            expect(status).toHaveTextContent(/loading lead temperature/i);
            expect(status.querySelector('svg')).toBeNull();
        });
    });

    describe('When the form is idle and then saving', () => {
        it('Then the Save button renders with no icon in either state', async () => {
            svc.get.mockResolvedValue(settings);
            let resolve: (v: LeadTemperatureSettings) => void = () => {};
            svc.save.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
            render(<LeadTemperatureSettingsCard canWrite />);
            const btn = await screen.findByRole('button', { name: /save temperature/i });
            expect(btn.querySelector('svg')).toBeNull();
            fireEvent.click(btn);
            await waitFor(() => expect(btn).toBeDisabled());
            expect(btn.querySelector('svg')).toBeNull();
            resolve(settings);
            await waitFor(() => expect(btn).not.toBeDisabled());
        });
    });
});
