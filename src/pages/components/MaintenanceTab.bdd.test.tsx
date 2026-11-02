import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

/**
 * Feature: Customer / Deal → Maintenance tab (`submodule:crm:maintenance-tab`).
 *
 * The tab is only offered when the flag is on. It lists the maintenance plans
 * and open requests linked to the customer or deal, with loading, error
 * (retry) and empty states.
 */

const svc = vi.hoisted(() => ({ listPlans: vi.fn(), listOpenRequests: vi.fn() }));

vi.mock('../../services/maintenanceTabService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/maintenanceTabService')>();
    return { ...actual, maintenanceTabService: svc };
});

import MaintenanceTab from './MaintenanceTab';
import { withMaintenanceTab, unwrapList, isOpenRequest } from '../../services/maintenanceTabService';

beforeEach(() => {
    svc.listPlans.mockReset();
    svc.listOpenRequests.mockReset();
});

describe('Feature: Maintenance tab flag gating', () => {
    const base = [{ id: 'activity', label: 'Activity' }];
    it('Given the flag is off / When tabs are built / Then no Maintenance tab is added', () => {
        expect(withMaintenanceTab(base, false)).toEqual(base);
    });
    it('Given the flag is on / When tabs are built / Then Maintenance is appended', () => {
        expect(withMaintenanceTab(base, true).map((t) => t.id)).toEqual(['activity', 'maintenance']);
    });
});

describe('Feature: list envelopes', () => {
    it('Given array, data and items envelopes / When unwrapped / Then rows are returned; junk gives []', () => {
        expect(unwrapList([{ id: 1 }])).toHaveLength(1);
        expect(unwrapList({ data: [{ id: 1 }] })).toHaveLength(1);
        expect(unwrapList({ items: [{ id: 1 }] })).toHaveLength(1);
        expect(unwrapList(null)).toEqual([]);
    });
});

describe('Feature: Maintenance tab rendering', () => {
    it('Given no customer or deal link / When rendered / Then a no-linked-customer empty state shows and nothing is fetched', () => {
        render(<MaintenanceTab />);
        expect(screen.getByText('No linked customer')).toBeTruthy();
        expect(svc.listPlans).not.toHaveBeenCalled();
    });

    it('Given a customer with nothing linked / When loaded / Then the empty state shows', async () => {
        svc.listPlans.mockResolvedValue([]);
        svc.listOpenRequests.mockResolvedValue([]);
        render(<MaintenanceTab customerPartnerId="p1" />);
        await waitFor(() => expect(screen.getByText('No maintenance yet')).toBeTruthy());
        expect(svc.listPlans).toHaveBeenCalledWith({ customerPartnerId: 'p1', dealId: undefined });
    });

    it('Given plans and open requests / When loaded / Then both tables list them', async () => {
        svc.listPlans.mockResolvedValue([{ id: 'pl1', name: 'Quarterly AC', active: true, interval_unit: 'days', interval_value: 90, next_due_at: '2026-11-01T00:00:00Z' }]);
        svc.listOpenRequests.mockResolvedValue([{ id: 'r1', number: 'MR-1', title: 'Leak', stage: { name: 'In progress' }, priority: 2 }]);
        render(<MaintenanceTab dealId="d1" />);
        await waitFor(() => expect(screen.getByText('Quarterly AC')).toBeTruthy());
        expect(screen.getByText('2026-11-01')).toBeTruthy();
        expect(screen.getByText('MR-1')).toBeTruthy();
        expect(screen.getByText('Leak')).toBeTruthy();
    });

    it('Given the load fails / When Retry is pressed and succeeds / Then data replaces the error', async () => {
        svc.listPlans.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([{ id: 'pl1', name: 'Plan A' }]);
        svc.listOpenRequests.mockResolvedValue([]);
        render(<MaintenanceTab dealId="d1" />);
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
        fireEvent.click(screen.getByText('Retry'));
        await waitFor(() => expect(screen.getByText('Plan A')).toBeTruthy());
    });

    it('Given a slow load / When rendered / Then a loading status shows', () => {
        svc.listPlans.mockReturnValue(new Promise(() => {}));
        svc.listOpenRequests.mockReturnValue(new Promise(() => {}));
        render(<MaintenanceTab dealId="d1" />);
        expect(screen.getByRole('status')).toBeTruthy();
    });
});

describe('isOpenRequest', () => {
    it('Given done, scrap and active stages / When filtered / Then only active stays open', () => {
        expect(isOpenRequest({ id: '1', stage: { request_done: true } })).toBe(false);
        expect(isOpenRequest({ id: '2', stage: { is_scrap: true } })).toBe(false);
        expect(isOpenRequest({ id: '3', is_scrap: true })).toBe(false);
        expect(isOpenRequest({ id: '4', stage: { name: 'New' } })).toBe(true);
    });
});
