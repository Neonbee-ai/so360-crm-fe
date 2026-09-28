import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import type { AssignmentRule, AssignmentTestResult } from '../../../services/assignmentRulesService';

/**
 * Branch-coverage companion to AssignmentRulesSettingsTab.bdd.test.tsx. It
 * lives in its own file because it swaps the people / department pickers for
 * probes that record their props and can emit every onChange shape (array,
 * single id, null), and makes the shell bridge configurable per test.
 */

const svc = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    test: vi.fn(),
}));
const mockGetUsers = vi.hoisted(() => vi.fn());
const shellState = vi.hoisted(() => ({
    value: { currentOrg: { id: 'org-1' }, currentTenant: { id: 'ten-1' } } as Record<string, unknown> | null,
}));
const picked = vi.hoisted(() => ({
    user: null as null | Record<string, unknown>,
    dept: null as null | Record<string, unknown>,
}));

vi.mock('../../../services/assignmentRulesService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/assignmentRulesService')>();
    return { ...actual, assignmentRulesService: svc };
});
vi.mock('../../../services/crmService', () => ({
    crmService: { getUsers: (...a: unknown[]) => mockGetUsers(...a) },
}));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => shellState.value,
}));
vi.mock('@so360/design-system', async (importActual) => {
    const actual = await importActual<Record<string, unknown>>();
    const R = await import('react');
    type Props = { value?: unknown; onChange: (v: unknown) => void; orgId?: string; tenantId?: string };
    const UserSelector = (p: Props) => {
        picked.user = p as unknown as Record<string, unknown>;
        return R.createElement('div', { 'data-testid': 'user-probe', 'data-value': Array.isArray(p.value) ? p.value.join(',') : String(p.value ?? '') },
            R.createElement('button', { type: 'button', onClick: () => p.onChange(['u7', 'u8']) }, 'pick many'),
            R.createElement('button', { type: 'button', onClick: () => p.onChange('user-9') }, 'pick one'),
            R.createElement('button', { type: 'button', onClick: () => p.onChange(null) }, 'pick none'),
        );
    };
    const DepartmentSelector = (p: Props) => {
        picked.dept = p as unknown as Record<string, unknown>;
        return R.createElement('button', { type: 'button', 'data-testid': 'dept-probe', 'data-value': String(p.value ?? ''), onClick: () => p.onChange('dept-7') }, 'pick dept');
    };
    return { ...actual, UserSelector, DepartmentSelector };
});

import { toast } from '@so360/design-system';
import AssignmentRulesSettingsTab from './AssignmentRulesSettingsTab';

const rule = (over: Partial<AssignmentRule> & Record<string, unknown> = {}): AssignmentRule => ({
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
} as AssignmentRule);

const renderTab = async (canWrite = true) => {
    const view = render(<AssignmentRulesSettingsTab canWrite={canWrite} />);
    await waitFor(() => expect(screen.queryByTestId('icon-Loader2')).not.toBeInTheDocument());
    return view;
};

const deferred = <T,>() => {
    let resolve: (v: T) => void = () => {};
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    shellState.value = { currentOrg: { id: 'org-1' }, currentTenant: { id: 'ten-1' } };
    picked.user = null;
    picked.dept = null;
    svc.list.mockResolvedValue([rule(), rule({ id: 'r2', name: 'Catch all', priority: 1, conditions: [] })]);
    svc.update.mockResolvedValue({});
    svc.create.mockResolvedValue({ id: 'r3' });
    svc.remove.mockResolvedValue({ success: true });
    svc.reorder.mockResolvedValue([]);
    mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Priya Nair', email: 'p@x.com' }]);
});

describe('Given the rules list is still loading', () => {
    it('When list has not settled / Then a spinner shows and no list or empty state', () => {
        svc.list.mockReturnValueOnce(new Promise(() => {}));
        render(<AssignmentRulesSettingsTab canWrite />);
        expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Assignment rules' })).not.toBeInTheDocument();
        expect(screen.queryByText(/No rules yet/)).not.toBeInTheDocument();
    });
});

describe('Given an org with no rules', () => {
    it('When the list is empty / Then the empty state explains that owners are kept', async () => {
        svc.list.mockResolvedValueOnce([]);
        await renderTab();
        expect(screen.getByText('No rules yet. New leads keep the owner they are created with.')).toBeInTheDocument();
        expect(screen.queryAllByTestId('assignment-rule-row')).toHaveLength(0);
    });
});

describe('Given a load failure that the backend explains', () => {
    it('When list rejects with a 403 message / Then that message is shown', async () => {
        svc.list.mockRejectedValueOnce(Object.assign(new Error('You cannot view assignment rules'), { status: 403 }));
        await renderTab();
        expect(screen.getByRole('alert')).toHaveTextContent('You cannot view assignment rules');
    });
});

describe('Given rules with unusual shapes', () => {
    it('When summaries render / Then unknown fields, ops and methods fall back to raw values and counts pluralise', async () => {
        svc.list.mockResolvedValueOnce([
            rule({
                id: 'a', name: 'Odd',
                conditions: [
                    { field: 'custom:tier', op: 'weird' as never, value: ['gold', 'silver'] },
                    { field: 'city', op: 'in', value: 'Dubai' },
                ],
                method: 'mystery' as never,
                target_user_ids: undefined as never,
            }),
            rule({ id: 'b', name: 'Dept', target_type: 'department', target_department_id: 'd1', method: 'least_loaded' }),
            rule({ id: 'c', name: 'Pair', target_user_ids: ['u1', 'u2'], method: 'fixed', conditions: [{ field: 'campaign', op: 'contains', value: 'spring' }] }),
            rule({ id: 'd', name: 'Nulls', conditions: null as never }),
        ]);
        await renderTab();
        const rows = screen.getAllByTestId('assignment-rule-row');
        expect(within(rows[0]).getByText('custom:tier weird gold, silver and City is one of Dubai → 0 people · mystery')).toBeInTheDocument();
        expect(within(rows[1]).getByText('Source is facebook → a department · Least loaded')).toBeInTheDocument();
        expect(within(rows[2]).getByText('Campaign contains spring → 2 people · Fixed (first person)')).toBeInTheDocument();
        expect(within(rows[3]).getByText('Every new lead → 1 person · Round robin')).toBeInTheDocument();
    });

    it('When an inactive rule renders / Then its name is struck through and the toggle offers Turn on', async () => {
        svc.list.mockResolvedValueOnce([rule({ is_active: false })]);
        await renderTab();
        expect(screen.getByText('Facebook leads').className).toMatch(/line-through/);
        const toggle = screen.getByRole('button', { name: 'Turn on Facebook leads' });
        expect(within(toggle).getByTestId('icon-ToggleLeft')).toBeInTheDocument();
    });

    it('When an active rule renders / Then its name is not struck through and shows ToggleRight', async () => {
        await renderTab();
        expect(screen.getByText('Facebook leads').className).not.toMatch(/line-through/);
        expect(within(screen.getByRole('button', { name: 'Turn off Facebook leads' })).getByTestId('icon-ToggleRight')).toBeInTheDocument();
    });
});

describe('Given the rule editor', () => {
    it('When opened for a new rule / Then it is titled New rule, has no conditions, and hides Add rule', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(screen.getByText('New rule')).toBeInTheDocument();
        expect(screen.getByText('No conditions — this rule catches every lead that reaches it.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /add rule/i })).not.toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'People' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Department' })).toHaveAttribute('aria-checked', 'false');
    });

    it('When the X is pressed / Then the editor closes and Add rule returns', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Close rule editor' }));
        expect(screen.queryByTestId('assignment-rule-editor')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
    });

    it('When Cancel is pressed after a validation error / Then the editor closes and reopening shows no error', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        expect(screen.getByRole('alert')).toHaveTextContent('Give the rule a name.');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByTestId('assignment-rule-editor')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('When editing a rule with an "in" list, no ids and no department / Then the editor normalises them', async () => {
        svc.list.mockResolvedValueOnce([
            rule({
                name: 'Listy',
                conditions: [{ field: 'source', op: 'in', value: ['facebook', 'google'] }],
                target_user_ids: undefined as never,
                target_department_id: undefined as never,
            }),
        ]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Listy' }));
        expect(screen.getByText('Edit rule')).toBeInTheDocument();
        const value = screen.getByLabelText('Condition 1 value');
        expect(value).toHaveValue('facebook, google');
        expect(value).toHaveAttribute('placeholder', 'facebook, google');
        expect(screen.getByTestId('user-probe')).toHaveAttribute('data-value', '');
        fireEvent.click(screen.getByRole('radio', { name: 'Department' }));
        expect(screen.getByTestId('dept-probe')).toHaveAttribute('data-value', '');
    });

    it('When editing a rule whose conditions are null / Then the no-conditions hint shows', async () => {
        svc.list.mockResolvedValueOnce([rule({ conditions: null as never })]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        expect(screen.getByText('No conditions — this rule catches every lead that reaches it.')).toBeInTheDocument();
        expect(screen.queryAllByTestId('assignment-condition-row')).toHaveLength(0);
    });

    it('When a condition field and operator are changed / Then the placeholder follows the op and the patch carries both', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        const value = screen.getByLabelText('Condition 1 value');
        expect(value).toHaveAttribute('placeholder', 'facebook');
        fireEvent.change(screen.getByLabelText('Condition 1 field'), { target: { value: 'city' } });
        fireEvent.change(screen.getByLabelText('Condition 1 operator'), { target: { value: 'in' } });
        expect(value).toHaveAttribute('placeholder', 'facebook, google');
        fireEvent.change(value, { target: { value: 'Dubai, Abu Dhabi' } });
        fireEvent.change(screen.getByLabelText('Condition 1 operator'), { target: { value: 'contains' } });
        expect(value).toHaveAttribute('placeholder', 'facebook');
        fireEvent.change(screen.getByLabelText('Condition 1 operator'), { target: { value: 'in' } });
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.objectContaining({
            conditions: [{ field: 'city', op: 'in', value: ['Dubai', 'Abu Dhabi'] }],
        })));
        expect(toast.success).toHaveBeenCalledWith('Assignment rule saved');
    });

    it('When the only condition is removed / Then the no-conditions hint returns', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove condition 1' }));
        expect(screen.queryAllByTestId('assignment-condition-row')).toHaveLength(0);
        expect(screen.getByText('No conditions — this rule catches every lead that reaches it.')).toBeInTheDocument();
    });

    it('When the second of two conditions is removed / Then the first is kept', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        fireEvent.change(screen.getByLabelText('Condition 2 value'), { target: { value: 'spring' } });
        fireEvent.click(screen.getByRole('button', { name: 'Remove condition 2' }));
        expect(screen.getAllByTestId('assignment-condition-row')).toHaveLength(1);
        expect(screen.getByLabelText('Condition 1 value')).toHaveValue('facebook');
    });

    it('When 20 conditions exist / Then Add condition is hidden', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        for (let i = 0; i < 19; i += 1) fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        expect(screen.getAllByTestId('assignment-condition-row')).toHaveLength(19);
        fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
        expect(screen.getAllByTestId('assignment-condition-row')).toHaveLength(20);
        expect(screen.queryByRole('button', { name: /add condition/i })).not.toBeInTheDocument();
    });

    it('When skip-inactive is unticked / Then the body carries skip_inactive false', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        const box = screen.getByRole('checkbox', { name: /skip people who are inactive/i });
        expect(box).toBeChecked();
        fireEvent.click(box);
        expect(box).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.objectContaining({ skip_inactive: false })));
    });
});

describe('Given the people picker emits different shapes', () => {
    it('When it emits an array / Then those ids are used', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.click(screen.getByRole('button', { name: 'pick many' }));
        expect(screen.getByTestId('user-probe')).toHaveAttribute('data-value', 'u7,u8');
    });

    it('When it emits a single id / Then it is wrapped in a list and saved', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Solo' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick one' }));
        expect(screen.getByTestId('user-probe')).toHaveAttribute('data-value', 'user-9');
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ target_user_ids: ['user-9'] })));
        expect(toast.success).toHaveBeenCalledWith('Assignment rule created');
    });

    it('When it emits null / Then the list is cleared and saving asks for a person', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        expect(screen.getByTestId('user-probe')).toHaveAttribute('data-value', 'u1');
        fireEvent.click(screen.getByRole('button', { name: 'pick none' }));
        expect(screen.getByTestId('user-probe')).toHaveAttribute('data-value', '');
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one person.');
        expect(svc.update).not.toHaveBeenCalled();
    });

    it('When the department target has none picked / Then saving asks for a department', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Dept rule' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Department' }));
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        expect(screen.getByRole('alert')).toHaveTextContent('Pick a department.');
        fireEvent.click(screen.getByTestId('dept-probe'));
        expect(screen.getByTestId('dept-probe')).toHaveAttribute('data-value', 'dept-7');
    });
});

describe('Given the shell context', () => {
    it('When org and tenant are known / Then both pickers are scoped to them', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(picked.user).toEqual(expect.objectContaining({ orgId: 'org-1', tenantId: 'ten-1', multiSelect: true }));
        fireEvent.click(screen.getByRole('radio', { name: 'Department' }));
        expect(picked.dept).toEqual(expect.objectContaining({ orgId: 'org-1', tenantId: 'ten-1', allowClear: true }));
    });

    it('When the bridge returns nothing / Then pickers get an empty org and no tenant', async () => {
        shellState.value = null;
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(picked.user?.orgId).toBe('');
        expect(picked.user?.tenantId).toBeUndefined();
    });

    it('When the bridge has no current org or tenant / Then the same fallbacks apply', async () => {
        shellState.value = {};
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.click(screen.getByRole('radio', { name: 'Department' }));
        expect(picked.dept?.orgId).toBe('');
        expect(picked.dept?.tenantId).toBeUndefined();
    });
});

describe('Given saving a rule', () => {
    it('When the save is in flight / Then Save is disabled with a spinner until it settles', async () => {
        const d = deferred<unknown>();
        svc.create.mockReturnValueOnce(d.promise);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Slow' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick one' }));
        const save = screen.getByRole('button', { name: /save rule/i });
        fireEvent.click(save);
        await waitFor(() => expect(save).toBeDisabled());
        expect(within(save).getByTestId('icon-Loader2')).toBeInTheDocument();
        d.resolve({ id: 'r9' });
        await waitFor(() => expect(screen.queryByTestId('assignment-rule-editor')).not.toBeInTheDocument());
    });

    it('When the save fails without explanation / Then the editor stays open with the fallback', async () => {
        svc.update.mockRejectedValueOnce(new Error('boom'));
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save the rule.'));
        expect(screen.getByTestId('assignment-rule-editor')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save rule/i })).toBeEnabled();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('When the backend explains a 4xx / Then that message is shown', async () => {
        svc.create.mockRejectedValueOnce(Object.assign(new Error('A rule with this name exists'), { status: 409 }));
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Facebook leads' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick many' }));
        fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A rule with this name exists'));
        expect(svc.list).toHaveBeenCalledTimes(1);
    });
});

describe('Given toggling a rule fails', () => {
    it('When update rejects / Then an error toast shows and the rule stays active', async () => {
        svc.update.mockRejectedValueOnce(new Error('boom'));
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Turn off Facebook leads' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update the rule.'));
        expect(screen.getByRole('button', { name: 'Turn off Facebook leads' })).toBeEnabled();
    });

    it('When an inactive rule is turned on / Then is_active true is patched', async () => {
        svc.list.mockResolvedValueOnce([rule({ is_active: false })]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Turn on Facebook leads' }));
        await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', { is_active: true }));
        expect(await screen.findByRole('button', { name: 'Turn off Facebook leads' })).toBeInTheDocument();
    });
});

describe('Given deleting a rule', () => {
    it('When the confirm is declined / Then nothing is removed', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Delete Facebook leads' }));
        expect(confirm).toHaveBeenCalledWith('Delete the rule "Facebook leads"?');
        expect(svc.remove).not.toHaveBeenCalled();
        expect(screen.getAllByTestId('assignment-rule-row')).toHaveLength(2);
    });

    it('When the rule being edited is deleted / Then the editor closes too', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        expect(screen.getByTestId('assignment-rule-editor')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Delete Facebook leads' }));
        await waitFor(() => expect(screen.queryByTestId('assignment-rule-editor')).not.toBeInTheDocument());
        expect(toast.success).toHaveBeenCalledWith('Assignment rule deleted');
    });

    it('When a different rule is deleted while editing / Then the editor stays open', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Facebook leads' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Catch all' }));
        await waitFor(() => expect(screen.getAllByTestId('assignment-rule-row')).toHaveLength(1));
        expect(screen.getByTestId('assignment-rule-editor')).toBeInTheDocument();
    });

    it('When remove rejects / Then an error toast shows and the row stays', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        svc.remove.mockRejectedValueOnce(new Error('boom'));
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Delete Facebook leads' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not delete the rule.'));
        expect(screen.getAllByTestId('assignment-rule-row')).toHaveLength(2);
    });
});

describe('Given reordering', () => {
    it('When the list renders / Then the first rule cannot move up and the last cannot move down', async () => {
        await renderTab();
        expect(screen.getByRole('button', { name: 'Move Facebook leads up' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move Facebook leads down' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Move Catch all up' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Move Catch all down' })).toBeDisabled();
    });

    it('When a rule moves down and the server returns its order / Then the saved rows replace the list', async () => {
        svc.reorder.mockResolvedValueOnce([
            rule({ id: 'r2', name: 'Catch all (saved)', conditions: [] }),
            rule({ name: 'Facebook leads (saved)' }),
        ]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Move Facebook leads down' }));
        await waitFor(() => expect(svc.reorder).toHaveBeenCalledWith(['r2', 'r1']));
        const rows = await screen.findAllByTestId('assignment-rule-row');
        await waitFor(() => expect(within(rows[0]).getByText('Catch all (saved)')).toBeInTheDocument());
        expect(within(screen.getAllByTestId('assignment-rule-row')[1]).getByText('Facebook leads (saved)')).toBeInTheDocument();
    });

    it('When a reorder is in flight / Then every row control is disabled', async () => {
        const d = deferred<AssignmentRule[]>();
        svc.reorder.mockReturnValueOnce(d.promise);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Move Catch all up' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Facebook leads' })).toBeDisabled());
        expect(screen.getByRole('button', { name: 'Delete Catch all' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Turn off Catch all' })).toBeDisabled();
        d.resolve([]);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Facebook leads' })).toBeEnabled());
    });
});

describe('Given the test-a-lead panel', () => {
    it('When the test is running / Then Run test is disabled with a spinner, and an unexplained miss reads plainly', async () => {
        const d = deferred<AssignmentTestResult>();
        svc.test.mockReturnValueOnce(d.promise);
        await renderTab();
        const run = screen.getByRole('button', { name: /run test/i });
        fireEvent.click(run);
        await waitFor(() => expect(run).toBeDisabled());
        expect(within(run).getByTestId('icon-Loader2')).toBeInTheDocument();
        expect(svc.test).toHaveBeenCalledWith({});
        d.resolve({ assigned: false });
        expect(await screen.findByTestId('assignment-test-result')).toHaveTextContent('No rule would assign this lead.');
        expect(run).toBeEnabled();
        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('When every sample field is filled / Then all trimmed values are sent', async () => {
        svc.test.mockResolvedValueOnce({ assigned: false });
        await renderTab();
        fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'facebook' } });
        fireEvent.change(screen.getByLabelText('Project'), { target: { value: ' Marina ' } });
        fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: '   ' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Dubai' } });
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(svc.test).toHaveBeenCalledWith({ source: 'facebook', project: 'Marina', city: 'Dubai' }));
    });

    it('When the assignee is not among the users / Then the raw user id is shown', async () => {
        svc.test.mockResolvedValueOnce({ assigned: true, user_id: 'u-404', rule_name: 'Facebook leads' });
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(screen.getByTestId('assignment-test-result')).toHaveTextContent('Goes to u-404 via "Facebook leads".'));
    });

    it('When the user lookup fails / Then the raw user id is shown and no error toast fires', async () => {
        mockGetUsers.mockRejectedValueOnce(new Error('users down'));
        svc.test.mockResolvedValueOnce({ assigned: true, user_id: 'u1', rule_name: 'Facebook leads' });
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(screen.getByTestId('assignment-test-result')).toHaveTextContent('Goes to u1 via "Facebook leads".'));
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('When an assigned result has no user id / Then no user lookup is made', async () => {
        svc.test.mockResolvedValueOnce({ assigned: true, rule_name: 'Catch all' });
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(screen.getByTestId('assignment-test-result')).toHaveTextContent('via "Catch all".'));
        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('When the test call fails / Then an error toast shows and no result renders', async () => {
        svc.test.mockRejectedValueOnce(new Error('boom'));
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not run the test.'));
        expect(screen.queryByTestId('assignment-test-result')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /run test/i })).toBeEnabled();
    });

    it('When a second test runs / Then the previous result and name are cleared first', async () => {
        svc.test.mockResolvedValueOnce({ assigned: true, user_id: 'u1', rule_name: 'Facebook leads' });
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(screen.getByTestId('assignment-test-result')).toHaveTextContent('Priya Nair'));
        const d = deferred<AssignmentTestResult>();
        svc.test.mockReturnValueOnce(d.promise);
        fireEvent.click(screen.getByRole('button', { name: /run test/i }));
        await waitFor(() => expect(screen.queryByTestId('assignment-test-result')).not.toBeInTheDocument());
        d.resolve({ assigned: false, reason: 'no pool' });
        expect(await screen.findByTestId('assignment-test-result')).toHaveTextContent('No rule would assign this lead (no pool).');
    });
});
