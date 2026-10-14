import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { AssignmentRule } from '../../../services/assignmentRulesService';

/**
 * Feature: Settings → Assignment, project-agent pool (RE Phase C).
 *
 * A rule can draw its pool from "Agents assigned to the lead's project"
 * (`pool_source: 'project_assigned'`) instead of picked people or a
 * department. pool_source is only sent once the rule has one.
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

const save = () => fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
const radio = (name: string) => screen.getByRole('radio', { name });

beforeEach(() => {
    vi.clearAllMocks();
    svc.list.mockResolvedValue([rule()]);
    svc.update.mockResolvedValue({});
    svc.create.mockResolvedValue({ id: 'r2' });
});

describe('Feature: choosing the project-agent pool', () => {
    it('Given a new rule / When "Project agents" is chosen / Then no person picker is needed and create sends pool_source project_assigned', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        expect(radio('Project agents')).toHaveAttribute('aria-checked', 'false');
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Project desk' } });
        fireEvent.click(radio('Project agents'));

        expect(radio('Project agents')).toHaveAttribute('aria-checked', 'true');
        expect(radio('People')).toHaveAttribute('aria-checked', 'false');
        expect(radio('Department')).toHaveAttribute('aria-checked', 'false');
        expect(screen.queryByRole('button', { name: 'pick people' })).not.toBeInTheDocument();
        expect(screen.getByText(/allocated to the lead's project/)).toBeInTheDocument();
        save();

        await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
        expect(svc.create.mock.calls[0][0]).toEqual(expect.objectContaining({
            name: 'Project desk', pool_source: 'project_assigned', target_type: 'users', target_user_ids: [],
        }));
    });

    it('Given a new rule on People / When saved without anyone picked / Then the person check still applies', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Empty desk' } });
        save();
        expect(await screen.findByText('Pick at least one person.')).toBeInTheDocument();
        expect(svc.create).not.toHaveBeenCalled();
    });

    it('Given a new rule never set to project agents / When saved / Then no pool_source is sent', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
        fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'People desk' } });
        fireEvent.click(screen.getByRole('button', { name: 'pick people' }));
        save();
        await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
        expect(svc.create.mock.calls[0][0]).not.toHaveProperty('pool_source');
    });
});

describe('Feature: editing a project-agent rule', () => {
    it('Given a saved project-agent rule / Then the list summarises the pool and the editor has Project agents selected', async () => {
        svc.list.mockResolvedValue([rule({ pool_source: 'project_assigned', target_user_ids: [] })]);
        await renderTab();
        expect(screen.getByText(/the lead's project agents · Round robin/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        expect(radio('Project agents')).toHaveAttribute('aria-checked', 'true');
    });

    it('Given a project-agent rule / When switched to Department and a department picked / Then update clears pool_source with null', async () => {
        svc.list.mockResolvedValue([rule({ pool_source: 'project_assigned', target_user_ids: [] })]);
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        fireEvent.click(radio('Department'));
        expect(radio('Department')).toHaveAttribute('aria-checked', 'true');
        expect(radio('Project agents')).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'pick dept' }));
        save();
        await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
        expect(svc.update.mock.calls[0][1]).toEqual(expect.objectContaining({
            pool_source: null, target_type: 'department', target_department_id: 'dept-7',
        }));
    });

    it('Given a people rule without pool_source / When switched between People and Department / Then pool_source stays unsent', async () => {
        await renderTab();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Marina desk' }));
        fireEvent.click(radio('Department'));
        fireEvent.click(radio('People'));
        save();
        await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
        expect(svc.update.mock.calls[0][1]).not.toHaveProperty('pool_source');
    });
});
