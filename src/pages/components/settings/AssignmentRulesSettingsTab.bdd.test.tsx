import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    test: vi.fn(),
}));
const mockGetUsers = vi.hoisted(() => vi.fn());

vi.mock('../../../services/assignmentRulesService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/assignmentRulesService')>();
    return { ...actual, assignmentRulesService: svc };
});
vi.mock('../../../services/crmService', () => ({ crmService: { getUsers: (...a: any[]) => mockGetUsers(...a) } }));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ currentOrg: { id: 'org-1' }, currentTenant: { id: 'ten-1' } }),
}));

import { toast } from '@so360/design-system';
import AssignmentRulesSettingsTab from './AssignmentRulesSettingsTab';

const rule = (over: Record<string, any> = {}) => ({
    id: 'r1',
    name: 'Facebook leads',
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

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    svc.list.mockResolvedValue([rule(), rule({ id: 'r2', name: 'Catch all', priority: 1, conditions: [] })]);
    svc.update.mockResolvedValue({});
    svc.create.mockResolvedValue({ id: 'r3' });
    svc.remove.mockResolvedValue({ success: true });
    mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Priya Nair', email: 'p@x.com' }]);
});

describe('Given the Assignment settings tab', () => {
    describe('When rules load', () => {
        it('Then each rule shows in evaluation order with a readable summary', async () => {
            render(<AssignmentRulesSettingsTab canWrite />);
            const rows = await screen.findAllByTestId('assignment-rule-row');
            expect(rows).toHaveLength(2);
            expect(within(rows[0]).getByText('Facebook leads')).toBeInTheDocument();
            expect(within(rows[0]).getByText(/Source is facebook → 1 person · Round robin/)).toBeInTheDocument();
            expect(within(rows[1]).getByText(/Every new lead/)).toBeInTheDocument();
        });
    });

    describe('When loading fails', () => {
        it('Then an error message is shown instead of the list', async () => {
            svc.list.mockRejectedValueOnce(new Error('boom'));
            render(<AssignmentRulesSettingsTab canWrite />);
            expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
        });
    });

    describe('When the user cannot write settings', () => {
        it('Then no add, move, toggle, edit or delete controls render', async () => {
            render(<AssignmentRulesSettingsTab canWrite={false} />);
            await screen.findAllByTestId('assignment-rule-row');
            expect(screen.queryByRole('button', { name: /add rule/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /delete facebook leads/i })).not.toBeInTheDocument();
        });
    });

    describe('When a new rule is saved without a name', () => {
        it('Then the editor explains why and nothing is posted', async () => {
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
            fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/name/i);
            expect(svc.create).not.toHaveBeenCalled();
        });
    });

    describe('When a new people rule is filled in and saved', () => {
        it('Then it is created with the picked users and the list reloads', async () => {
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
            fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Marina' } });
            fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
            fireEvent.change(screen.getByLabelText('Condition 1 value'), { target: { value: 'google' } });
            fireEvent.click(screen.getByTestId('user-selector'));
            fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'least_loaded' } });
            fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
            await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Marina',
                target_type: 'users',
                target_user_ids: ['user-1', 'user-2'],
                method: 'least_loaded',
                conditions: [{ field: 'source', op: 'eq', value: 'google' }],
            })));
            expect(toast.success).toHaveBeenCalled();
            expect(svc.list).toHaveBeenCalledTimes(2);
            expect(screen.queryByTestId('assignment-rule-editor')).not.toBeInTheDocument();
        });
    });

    describe('When an existing rule is switched to a department target', () => {
        it('Then the department selector replaces the people picker and the patch carries the department', async () => {
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
            expect(screen.getByLabelText('Rule name')).toHaveValue('Facebook leads');
            fireEvent.click(screen.getByRole('radio', { name: 'Department' }));
            expect(screen.queryByTestId('user-selector')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('department-selector'));
            fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
            await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.objectContaining({
                target_type: 'department',
                target_department_id: 'dept-1',
            })));
        });
    });

    describe('When a rule is toggled off', () => {
        it('Then only is_active is patched', async () => {
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: 'Turn off Facebook leads' }));
            await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { is_active: false }));
            expect(await screen.findByRole('button', { name: 'Turn on Facebook leads' })).toBeInTheDocument();
        });
    });

    describe('When the second rule is moved up', () => {
        it('Then reorder is sent with the new id order', async () => {
            svc.reorder.mockResolvedValue([]);
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: 'Move Catch all up' }));
            await waitFor(() => expect(svc.reorder).toHaveBeenCalledWith(['r2', 'r1']));
            const rows = screen.getAllByTestId('assignment-rule-row');
            expect(within(rows[0]).getByText('Catch all')).toBeInTheDocument();
        });

        it('Then a failed reorder restores the old order', async () => {
            svc.reorder.mockRejectedValue(new Error('x'));
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: 'Move Catch all up' }));
            await waitFor(() => expect(toast.error).toHaveBeenCalled());
            const rows = screen.getAllByTestId('assignment-rule-row');
            expect(within(rows[0]).getByText('Facebook leads')).toBeInTheDocument();
        });
    });

    describe('When a rule is deleted after confirming', () => {
        it('Then it leaves the list', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: 'Delete Facebook leads' }));
            await waitFor(() => expect(svc.remove).toHaveBeenCalledWith('r1'));
            await waitFor(() => expect(screen.getAllByTestId('assignment-rule-row')).toHaveLength(1));
        });
    });

    describe('When a sample lead is tested', () => {
        it('Then the owner name and rule are shown', async () => {
            svc.test.mockResolvedValue({ assigned: true, user_id: 'u1', rule_id: 'r1', rule_name: 'Facebook leads', evaluated: [] });
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.change(screen.getByLabelText('Source'), { target: { value: ' facebook ' } });
            fireEvent.click(screen.getByRole('button', { name: /run test/i }));
            await waitFor(() => expect(svc.test).toHaveBeenCalledWith({ source: 'facebook' }));
            await waitFor(() => expect(screen.getByTestId('assignment-test-result')).toHaveTextContent('Goes to Priya Nair via "Facebook leads".'));
        });

        it('Then an unassigned result says no rule would assign it', async () => {
            svc.test.mockResolvedValue({ assigned: false, reason: 'no rule matched', evaluated: [] });
            render(<AssignmentRulesSettingsTab canWrite />);
            await screen.findAllByTestId('assignment-rule-row');
            fireEvent.click(screen.getByRole('button', { name: /run test/i }));
            expect(await screen.findByTestId('assignment-test-result')).toHaveTextContent('No rule would assign this lead (no rule matched).');
        });
    });
});
