import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { AssignmentRule } from '../../../services/assignmentRulesService';

/**
 * Feature: Settings → Assignment, G5 controls (RE plan G5).
 *
 * The rule editor offers a Language condition, a "reassign if not contacted
 * within N minutes" window (empty = never) and a "skip people on leave"
 * toggle (on by default). G5 values are only saved once the rule has them.
 */

const svc = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    test: vi.fn(),
}));

vi.mock('../../../services/assignmentRulesService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/assignmentRulesService')>();
    return { ...actual, assignmentRulesService: svc };
});
vi.mock('../../../services/crmService', () => ({
    crmService: { getUsers: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ currentOrg: { id: 'org-1' }, currentTenant: { id: 'ten-1' } }),
}));
vi.mock('@so360/design-system', async (importActual) => {
    const actual = await importActual<Record<string, unknown>>();
    const R = await import('react');
    type Props = { onChange: (v: unknown) => void };
    const UserSelector = (p: Props) =>
        R.createElement('button', { type: 'button', onClick: () => p.onChange(['u7']) }, 'pick people');
    const DepartmentSelector = (p: Props) =>
        R.createElement('button', { type: 'button', onClick: () => p.onChange('dept-7') }, 'pick dept');
    return { ...actual, UserSelector, DepartmentSelector };
});

import AssignmentRulesSettingsTab from './AssignmentRulesSettingsTab';

const rule = (over: Partial<AssignmentRule> = {}): AssignmentRule => ({
    id: 'r1',
    name: 'Marina desk',
    priority: 0,
    is_active: true,
    conditions: [{ field: 'source', op: 'eq', value: 'facebook' }],
    target_type: 'users',
    target_department_id: null,
    target_user_ids: ['u1'],
    method: 'round_robin',
    skip_inactive: true,
    ...over,
});

const renderTab = async () => {
    render(<AssignmentRulesSettingsTab canWrite />);
    await waitFor(() => expect(screen.queryByTestId('icon-Loader2')).not.toBeInTheDocument());
};

const reassignInput = () => screen.getByLabelText('Reassign if not contacted within (minutes)');
const leaveBox = () => screen.getByRole('checkbox', { name: /skip people on leave today/i });
const save = () => fireEvent.click(screen.getByRole('button', { name: /save rule/i }));

beforeEach(() => {
    vi.clearAllMocks();
    svc.list.mockResolvedValue([rule()]);
    svc.update.mockResolvedValue({});
    svc.create.mockResolvedValue({ id: 'r2' });
});

describe('Feature: new rule defaults', () => {
    it('Given a new rule / Then the window is empty ("Never") and skip-on-leave is on, and neither is sent unless changed', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(reassignInput()).toHaveValue(null);
        expect(reassignInput()).toHaveAttribute('placeholder', 'Never');
        expect(reassignInput()).toHaveAttribute('min', '1');
        expect(reassignInput()).toHaveAttribute('max', '10080');
        expect(leaveBox()).toBeChecked();

        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'New desk' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick people' }));
        save();

        await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
        const input = svc.create.mock.calls[0][0];
        expect(input.skip_on_leave).toBeUndefined();
        expect(input.reassign_after_minutes).toBeUndefined();
    });

    it('Given a new rule / When a 30-minute window is set and skip-on-leave turned off / Then create receives both', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Fast desk' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick people' }));
        fireEvent.change(reassignInput(), { target: { value: '30' } });
        fireEvent.click(leaveBox());
        expect(leaveBox()).not.toBeChecked();
        save();

        await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Fast desk',
            reassign_after_minutes: 30,
            skip_on_leave: false,
        })));
    });
});

describe('Feature: editing a rule', () => {
    it('Given a rule saved before migration 075 / When saved unchanged / Then no G5 field is sent', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        save();
        await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
        const body = svc.update.mock.calls[0][1];
        expect(body).not.toHaveProperty('skip_on_leave');
        expect(body).not.toHaveProperty('reassign_after_minutes');
    });

    it('Given a rule with a 45-minute window and skip-on-leave off / Then the editor shows both and the list summarises the window', async () => {
        svc.list.mockResolvedValue([rule({ reassign_after_minutes: 45, skip_on_leave: false })]);
        await renderTab();
        expect(screen.getByText(/reassign after 45 min/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        expect(reassignInput()).toHaveValue(45);
        expect(leaveBox()).not.toBeChecked();
    });

    it('Given a rule with no window / Then the list shows no reassign summary', async () => {
        svc.list.mockResolvedValue([rule({ reassign_after_minutes: null, skip_on_leave: true })]);
        await renderTab();
        expect(screen.getByText(/1 person · Round robin$/)).toBeInTheDocument();
        expect(screen.queryByText(/reassign after/)).not.toBeInTheDocument();
    });

    it('Given a rule with a window / When the field is cleared / Then the patch turns reassignment off (null)', async () => {
        svc.list.mockResolvedValue([rule({ reassign_after_minutes: 45, skip_on_leave: true })]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        fireEvent.change(reassignInput(), { target: { value: '' } });
        save();
        await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.objectContaining({
            reassign_after_minutes: null,
            skip_on_leave: true,
        })));
    });

    it.each([['0'], ['10081'], ['2.5']])('When the window is %s / Then saving is blocked with the allowed range', async (text) => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        fireEvent.change(reassignInput(), { target: { value: text } });
        save();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Reassign after must be a whole number of minutes from 1 to 10080, or empty.',
        );
        expect(svc.update).not.toHaveBeenCalled();
    });
});

describe('Feature: language condition and dry run', () => {
    it('Given a condition row / When Language is picked / Then the patch carries field language', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        fireEvent.change(screen.getByLabelText('Condition 1 field'), { target: { value: 'language' } });
        fireEvent.change(screen.getByLabelText('Condition 1 value'), { target: { value: 'Arabic' } });
        save();
        await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.objectContaining({
            conditions: [{ field: 'language', op: 'eq', value: 'Arabic' }],
        })));
    });

    it('Given the Test a lead panel / When a language is entered / Then the dry run sends it', async () => {
        svc.test.mockResolvedValue({ assigned: false, reason: 'no rule matched' });
        await renderTab();
        fireEvent.change(screen.getByLabelText('Language'), { target: { value: ' Arabic ' } });
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(svc.test).toHaveBeenCalledWith({ language: 'Arabic' }));
    });

    it('Given a saved language rule / Then the list summary names the Language field', async () => {
        svc.list.mockResolvedValue([rule({ conditions: [{ field: 'language', op: 'in', value: ['Arabic', 'Hindi'] }] })]);
        await renderTab();
        expect(screen.getByText(/Language is one of Arabic, Hindi/)).toBeInTheDocument();
    });
});
