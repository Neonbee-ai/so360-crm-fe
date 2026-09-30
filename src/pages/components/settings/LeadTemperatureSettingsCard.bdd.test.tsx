import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { LeadTemperatureSettings } from '../../../services/leadTemperatureSettingsService';

/**
 * Feature: Settings → Lead Scoring → Lead temperature (RE plan E §20).
 * Per-org Hot/Warm thresholds and factor weights; validated client-side,
 * saved with one PUT (which re-bands the org's leads server-side).
 */

const svc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../../services/leadTemperatureSettingsService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/leadTemperatureSettingsService')>();
    return { ...actual, leadTemperatureSettingsService: svc };
});
vi.mock('@so360/design-system', () => ({ toast: toasts }));

import LeadTemperatureSettingsCard from './LeadTemperatureSettingsCard';

const settings = (over: Partial<LeadTemperatureSettings> = {}): LeadTemperatureSettings => ({
    hot_min: 70,
    warm_min: 40,
    weights: { budget_fit: 30, timeline: 30, engagement: 25, source_quality: 15 },
    source_quality: {},
    timeline: {},
    is_default: true,
    ...over,
});

const renderCard = async (canWrite = true) => {
    render(<LeadTemperatureSettingsCard canWrite={canWrite} />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
};

const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
    svc.get.mockReset();
    svc.save.mockReset();
    toasts.success.mockReset();
    svc.get.mockResolvedValue(settings());
    svc.save.mockImplementation(async (s: LeadTemperatureSettings) => ({ ...s, is_default: false }));
});

describe('Given the lead temperature settings card', () => {
    describe('When settings are still loading', () => {
        it('Then a loading indicator is shown', () => {
            svc.get.mockReturnValue(new Promise(() => {}));
            render(<LeadTemperatureSettingsCard canWrite />);
            expect(screen.getByRole('status')).toHaveTextContent(/loading lead temperature/i);
        });
    });

    describe('When the org settings load', () => {
        it('Then thresholds and the four weights are prefilled', async () => {
            svc.get.mockResolvedValue(settings({ hot_min: 75, warm_min: 45 }));
            await renderCard();
            expect(input(/hot at or above/i).value).toBe('75');
            expect(input(/warm at or above/i).value).toBe('45');
            expect(input(/budget fit weight/i).value).toBe('30');
            expect(input(/timeline weight/i).value).toBe('30');
            expect(input(/engagement weight/i).value).toBe('25');
            expect(input(/source quality weight/i).value).toBe('15');
        });
    });

    describe('When loading fails', () => {
        it('Then the error is shown with a Retry that reloads', async () => {
            svc.get.mockRejectedValueOnce(new Error('boom'));
            await renderCard();
            expect(screen.getByRole('alert')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /retry/i }));
            await waitFor(() => expect(input(/hot at or above/i).value).toBe('70'));
            expect(svc.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('When valid changes are saved', () => {
        it('Then one save carries the edited values and a success toast shows', async () => {
            await renderCard();
            fireEvent.change(input(/hot at or above/i), { target: { value: '80' } });
            fireEvent.change(input(/engagement weight/i), { target: { value: '40' } });
            fireEvent.click(screen.getByRole('button', { name: /save temperature/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalledTimes(1));
            expect(svc.save.mock.calls[0][0]).toMatchObject({
                hot_min: 80, warm_min: 40,
                weights: { budget_fit: 30, timeline: 30, engagement: 40, source_quality: 15 },
            });
            await waitFor(() => expect(toasts.success).toHaveBeenCalled());
        });
    });

    describe('When Hot is not above Warm', () => {
        it('Then the problem is shown and nothing is saved', async () => {
            await renderCard();
            fireEvent.change(input(/hot at or above/i), { target: { value: '30' } });
            fireEvent.click(screen.getByRole('button', { name: /save temperature/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Hot threshold must be greater than the Warm threshold.');
            expect(svc.save).not.toHaveBeenCalled();
        });
    });

    describe('When a field is cleared', () => {
        it('Then validation blocks the save', async () => {
            await renderCard();
            fireEvent.change(input(/warm at or above/i), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: /save temperature/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/Warm threshold/);
            expect(svc.save).not.toHaveBeenCalled();
        });
    });

    describe('When the save is rejected by the server', () => {
        it('Then the error is shown and no success toast fires', async () => {
            svc.save.mockRejectedValueOnce(new Error('nope'));
            await renderCard();
            fireEvent.click(screen.getByRole('button', { name: /save temperature/i }));
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(toasts.success).not.toHaveBeenCalled();
        });
    });

    describe('When the user cannot write settings', () => {
        it('Then fields are read-only and there is no Save button', async () => {
            await renderCard(false);
            expect(input(/hot at or above/i)).toBeDisabled();
            expect(input(/source quality weight/i)).toBeDisabled();
            expect(screen.queryByRole('button', { name: /save temperature/i })).toBeNull();
        });
    });
});
