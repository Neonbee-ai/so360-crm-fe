import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { SalesSettings } from '../../../services/salesSettingsService';

/**
 * Feature: Settings → Sales & commission (RE Phase C).
 *
 * Commission fields show with `submodule:crm:commissions`; the unit
 * visibility switch shows with `action:crm:unit_allocation`. Everything is
 * validated client-side and saved with one PUT.
 */

const svc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const flags = vi.hoisted(() => ({ on: new Set<string>() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../../services/salesSettingsService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/salesSettingsService')>();
    return { ...actual, salesSettingsService: svc };
});
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        currentOrg: { id: 'org-1' },
        currentTenant: { id: 'ten-1' },
        isFeatureEnabled: (k: string) => flags.on.has(k),
    }),
}));
vi.mock('@so360/design-system', async () => {
    const R = await import('react');
    const btn = (label: string, v: unknown, p: { onChange: (v: unknown) => void }) =>
        R.createElement('button', { key: label, type: 'button', onClick: () => p.onChange(v) }, label);
    const UserSelector = (p: { onChange: (v: unknown) => void }) => R.createElement('span', {},
        btn('pick person', 'u9', p), btn('pick list', ['u3', 'u4'], p), btn('pick empty', [], p), btn('pick none', null, p));
    return { toast: toasts, UserSelector };
});

import SalesCommissionSettingsTab from './SalesCommissionSettingsTab';

const settings = (over: Partial<SalesSettings> = {}): SalesSettings => ({
    earn_trigger: 'booking',
    approval_required: true,
    vat_percent: 5,
    default_agent_share_percent: 50,
    team_leader_override_percent: 10,
    overrides: [],
    unit_visibility: 'all',
    ...over,
});

const COMM = 'submodule:crm:commissions';
const ALLOC = 'action:crm:unit_allocation';

const renderTab = async (canWrite = true) => {
    render(<SalesCommissionSettingsTab canWrite={canWrite} />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
};

beforeEach(() => {
    svc.get.mockReset();
    svc.save.mockReset();
    toasts.success.mockReset();
    flags.on = new Set([COMM, ALLOC]);
    svc.get.mockResolvedValue(settings());
    svc.save.mockImplementation(async (s: SalesSettings) => s);
});

describe('Given the Sales & commission settings tab', () => {
    describe('When settings are still loading', () => {
        it('Then a loading indicator is shown', () => {
            svc.get.mockReturnValue(new Promise(() => {}));
            render(<SalesCommissionSettingsTab canWrite />);
            expect(screen.getByRole('status')).toHaveTextContent(/loading sales settings/i);
        });
    });

    describe('When loading fails', () => {
        it('Then the error is shown and Retry reloads', async () => {
            svc.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            await renderTab();
            expect(screen.getByRole('alert')).toHaveTextContent('Could not load sales settings.');
            fireEvent.click(screen.getByRole('button', { name: /retry/i }));
            expect(await screen.findByLabelText(/vat on commission/i)).toHaveValue(5);
            expect(svc.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('When both flags are on and settings load', () => {
        it('Then the commission fields and unit visibility show the saved values', async () => {
            await renderTab();
            expect(screen.getByLabelText(/commission is earned/i)).toHaveValue('booking');
            expect(screen.getByLabelText(/default agent share/i)).toHaveValue(50);
            expect(screen.getByLabelText(/team-leader override \(%\)/i)).toHaveValue(10);
            expect(screen.getByRole('checkbox')).toBeChecked();
            expect(screen.getByRole('radio', { name: /any available unit/i })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByText(/no overrides/i)).toBeInTheDocument();
        });
    });

    describe('When the user edits every field and saves', () => {
        it('Then the full settings are PUT and a toast confirms', async () => {
            await renderTab();
            fireEvent.change(screen.getByLabelText(/commission is earned/i), { target: { value: 'spa_signed' } });
            fireEvent.change(screen.getByLabelText(/vat on commission/i), { target: { value: '0' } });
            fireEvent.change(screen.getByLabelText(/default agent share/i), { target: { value: '60' } });
            fireEvent.change(screen.getByLabelText(/team-leader override \(%\)/i), { target: { value: '5' } });
            fireEvent.click(screen.getByRole('checkbox'));
            fireEvent.click(screen.getByRole('radio', { name: /only units allocated/i }));
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalledTimes(1));
            expect(svc.save).toHaveBeenCalledWith({
                earn_trigger: 'spa_signed',
                approval_required: false,
                vat_percent: 0,
                default_agent_share_percent: 60,
                team_leader_override_percent: 5,
                overrides: [],
                unit_visibility: 'assigned_only',
            });
            expect(toasts.success).toHaveBeenCalledWith('Sales settings saved');
        });
    });

    describe('When an unknown earn trigger value arrives from the select', () => {
        it('Then it is ignored', async () => {
            await renderTab();
            const sel = screen.getByLabelText(/commission is earned/i) as HTMLSelectElement;
            const bogus = document.createElement('option');
            bogus.value = 'bogus';
            sel.appendChild(bogus);
            fireEvent.change(sel, { target: { value: 'bogus' } });
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalled());
            expect(svc.save.mock.calls[0][0].earn_trigger).toBe('booking');
        });
    });

    describe('When a percentage is cleared', () => {
        it('Then save is blocked with a validation message', async () => {
            await renderTab();
            fireEvent.change(screen.getByLabelText(/vat on commission/i), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('VAT must be between 0 and 100%.');
            expect(svc.save).not.toHaveBeenCalled();
        });
    });

    describe('When the agent share and override exceed 100%', () => {
        it('Then save is blocked, and editing clears the message', async () => {
            await renderTab();
            fireEvent.change(screen.getByLabelText(/default agent share/i), { target: { value: '95' } });
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(screen.getByRole('alert')).toHaveTextContent(/cannot exceed 100%/);
            fireEvent.change(screen.getByLabelText(/default agent share/i), { target: { value: '40' } });
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('When the backend rejects the save', () => {
        it('Then its 4xx message is shown and no toast fires', async () => {
            svc.save.mockRejectedValueOnce(Object.assign(new Error('VAT locked by policy'), { status: 400 }));
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent('VAT locked by policy');
            expect(toasts.success).not.toHaveBeenCalled();
        });
    });

    describe('When the user adds a role override', () => {
        it('Then it starts from the defaults and must name a role', async () => {
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: /add override/i }));
            expect(screen.getByLabelText('Override 1 agent share')).toHaveValue(50);
            expect(screen.getByLabelText('Override 1 team-leader override')).toHaveValue(10);
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Override 1: pick a role.');
            fireEvent.change(screen.getByLabelText('Override 1 role'), { target: { value: 'senior_agent' } });
            fireEvent.change(screen.getByLabelText('Override 1 agent share'), { target: { value: '70' } });
            fireEvent.change(screen.getByLabelText('Override 1 team-leader override'), { target: { value: '0' } });
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalled());
            expect(svc.save.mock.calls[0][0].overrides).toEqual([
                { scope: 'role', role_key: 'senior_agent', agent_share_percent: 70, team_leader_override_percent: 0 },
            ]);
        });
    });

    describe('When an override is switched to a person', () => {
        it('Then the person picker replaces the role and the user id is saved', async () => {
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: /add override/i }));
            fireEvent.change(screen.getByLabelText('Override 1 applies to'), { target: { value: 'user' } });
            expect(screen.queryByLabelText('Override 1 role')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /pick person/i }));
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalled());
            expect(svc.save.mock.calls[0][0].overrides[0]).toEqual({
                scope: 'user', user_id: 'u9', agent_share_percent: 50, team_leader_override_percent: 10,
            });
        });

        it('Then switching back to role clears the person', async () => {
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: /add override/i }));
            fireEvent.change(screen.getByLabelText('Override 1 applies to'), { target: { value: 'user' } });
            fireEvent.change(screen.getByLabelText('Override 1 applies to'), { target: { value: 'role' } });
            expect(screen.getByLabelText('Override 1 role')).toHaveValue('');
        });
    });

    describe('When the picker yields a list or nothing', () => {
        it('Then the first id is used, or the person is cleared', async () => {
            svc.get.mockResolvedValue(settings({
                overrides: [{ scope: 'user', user_id: 'u1', agent_share_percent: 40, team_leader_override_percent: 0 }],
            }));
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: /pick list/i }));
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalledTimes(1));
            expect(svc.save.mock.calls[0][0].overrides[0].user_id).toBe('u3');
            fireEvent.click(screen.getByRole('button', { name: /pick empty/i }));
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Override 1: pick a user.');
            fireEvent.click(screen.getByRole('button', { name: /pick none/i }));
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Override 1: pick a user.');
        });
    });

    describe('When the user removes an override', () => {
        it('Then it is dropped from the saved settings', async () => {
            svc.get.mockResolvedValue(settings({
                overrides: [
                    { scope: 'role', role_key: 'a', agent_share_percent: 40, team_leader_override_percent: 0 },
                    { scope: 'role', role_key: 'b', agent_share_percent: 30, team_leader_override_percent: 0 },
                ],
            }));
            await renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Remove override 1' }));
            expect(screen.getByLabelText('Override 1 role')).toHaveValue('b');
            fireEvent.click(screen.getByRole('button', { name: /save sales settings/i }));
            await waitFor(() => expect(svc.save).toHaveBeenCalled());
            expect(svc.save.mock.calls[0][0].overrides.map((o: { role_key: string }) => o.role_key)).toEqual(['b']);
        });
    });

    describe('When only the commissions flag is on', () => {
        it('Then unit visibility is hidden', async () => {
            flags.on = new Set([COMM]);
            await renderTab();
            expect(screen.getByLabelText(/vat on commission/i)).toBeInTheDocument();
            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        });
    });

    describe('When only the unit allocation flag is on', () => {
        it('Then only unit visibility shows', async () => {
            flags.on = new Set([ALLOC]);
            await renderTab();
            expect(screen.queryByLabelText(/vat on commission/i)).not.toBeInTheDocument();
            expect(screen.getByRole('radiogroup', { name: /agents can book/i })).toBeInTheDocument();
        });
    });

    describe('When the user cannot write settings', () => {
        it('Then every field is read-only and there is no save, add or remove', async () => {
            svc.get.mockResolvedValue(settings({
                overrides: [
                    { scope: 'role', role_key: 'a', agent_share_percent: 40, team_leader_override_percent: 0 },
                    { scope: 'user', user_id: 'u1', agent_share_percent: 30, team_leader_override_percent: 0 },
                    { scope: 'user', user_id: '', agent_share_percent: 30, team_leader_override_percent: 0 },
                ],
            }));
            await renderTab(false);
            expect(screen.getByLabelText(/vat on commission/i)).toBeDisabled();
            expect(screen.getByRole('checkbox')).toBeDisabled();
            expect(screen.getByRole('radio', { name: /any available unit/i })).toBeDisabled();
            expect(screen.getByText('u1')).toBeInTheDocument();
            expect(screen.getByText('—')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /pick person/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /save sales settings/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /add override/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /remove override/i })).not.toBeInTheDocument();
            expect(screen.getByText(/view these settings but not change them/i)).toBeInTheDocument();
        });
    });
});
