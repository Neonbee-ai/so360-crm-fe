import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ListFilters } from '@so360/design-system';
import type { SalesFilters } from '../../services/salesReportService';

/**
 * Feature: shared Sales / Commission report filter config (ListPageTemplate `filterConfig`).
 * Project options come from inventory categories, agents from CRM users,
 * developers from the host page. Failed option loads leave the list empty.
 */

const crm = vi.hoisted(() => ({ getProductCategories: vi.fn(), getUsers: vi.fn() }));
vi.mock('../../services/crmService', () => ({ crmService: crm }));

import { useSalesFilterConfig, hasActiveFilters } from './SalesFiltersBar';

const onChangeSpy = vi.fn();
const Harness: React.FC<{ initial?: SalesFilters; developers?: { id: string; name: string }[] }> = ({ initial = {}, developers = [] }) => {
    const [value, setValue] = useState<SalesFilters>(initial);
    const { config, rangeError } = useSalesFilterConfig(value, (next) => { onChangeSpy(next); setValue(next); }, developers);
    return (
        <div>
            <ListFilters {...config} />
            {rangeError ? <p role="alert">{rangeError}</p> : null}
        </div>
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    crm.getProductCategories.mockResolvedValue([{ id: 'p1', name: 'Marina Heights' }]);
    crm.getUsers.mockResolvedValue([
        { id: 'u1', full_name: 'Asha', email: 'asha@x.com' },
        { id: 'u2', full_name: '', email: 'ben@x.com' },
    ]);
});

describe('Feature: Sales filter config', () => {
    describe('Given the option lists load', () => {
        it('When rendered / Then projects and agents are offered (email stands in for a missing name)', async () => {
            render(<Harness />);
            expect(await screen.findByRole('option', { name: 'Marina Heights' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Asha' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'ben@x.com' })).toBeInTheDocument();
        });

        it('When a project and an agent are chosen / Then onChange carries both ids', async () => {
            render(<Harness />);
            await screen.findByRole('option', { name: 'Marina Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
            fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'u1' } });
            expect(onChangeSpy).toHaveBeenLastCalledWith({ project_id: 'p1', agent_id: 'u1' });
        });

        it('When a choice is reset to "All" / Then the key is dropped, not sent blank', async () => {
            render(<Harness initial={{ project_id: 'p1' }} />);
            await screen.findByRole('option', { name: 'Marina Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: '' } });
            expect(onChangeSpy).toHaveBeenLastCalledWith({});
        });
    });

    describe('Given the option lists fail or return nothing', () => {
        it('When rendered / Then only the placeholder options remain and nothing throws', async () => {
            crm.getProductCategories.mockRejectedValue(new Error('down'));
            crm.getUsers.mockResolvedValue(null);
            render(<Harness />);
            await vi.waitFor(() => expect(crm.getUsers).toHaveBeenCalled());
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Project', 'Agent']);
        });

        it('When the users call rejects and categories return null / Then both lists stay empty', async () => {
            crm.getProductCategories.mockResolvedValue(null);
            crm.getUsers.mockRejectedValue(new Error('down'));
            render(<Harness />);
            await vi.waitFor(() => expect(crm.getProductCategories).toHaveBeenCalled());
            expect(screen.getAllByRole('option')).toHaveLength(2);
        });
    });

    describe('Given the developer list', () => {
        it('When the page supplies none / Then no developer filter is shown', async () => {
            render(<Harness />);
            await screen.findByRole('option', { name: 'Marina Heights' });
            expect(screen.queryByLabelText('Developer')).not.toBeInTheDocument();
        });

        it('When the page supplies developers / Then choosing one sets developer_id', async () => {
            render(<Harness developers={[{ id: 'd1', name: 'Emaar' }]} />);
            fireEvent.change(screen.getByLabelText('Developer'), { target: { value: 'd1' } });
            expect(onChangeSpy).toHaveBeenLastCalledWith({ developer_id: 'd1' });
            await screen.findByRole('option', { name: 'Marina Heights' });
        });
    });

    describe('Given a date range (in the Filters drawer)', () => {
        it('When from is after to / Then a validation message is exposed', async () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('filters-button'));
            fireEvent.change(screen.getByLabelText('Date range start'), { target: { value: '2026-05-10' } });
            fireEvent.change(screen.getByLabelText('Date range end'), { target: { value: '2026-05-01' } });
            expect(onChangeSpy).toHaveBeenLastCalledWith({ from: '2026-05-10', to: '2026-05-01' });
            expect(screen.getByRole('alert')).toHaveTextContent('The start date must be on or before the end date.');
            await screen.findByRole('option', { name: 'Marina Heights' });
        });

        it('When the range is valid / Then no validation message is shown', async () => {
            render(<Harness initial={{ from: '2026-05-01', to: '2026-05-10' }} />);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            await screen.findByRole('option', { name: 'Marina Heights' });
        });
    });

    describe('Given active filters', () => {
        it('When none are set / Then no applied-filter chips are shown', async () => {
            render(<Harness />);
            expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
            await screen.findByRole('option', { name: 'Marina Heights' });
        });

        it('When "Clear all" is pressed / Then every filter is reset in one tap', async () => {
            render(<Harness initial={{ agent_id: 'u1', from: '2026-01-01' }} />);
            fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
            expect(onChangeSpy).toHaveBeenLastCalledWith({});
            expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
            await screen.findByRole('option', { name: 'Marina Heights' });
        });

        it.each([
            [{}, false],
            [{ project_id: 'p' }, true],
            [{ agent_id: 'a' }, true],
            [{ developer_id: 'd' }, true],
            [{ from: '2026-01-01' }, true],
            [{ to: '2026-01-01' }, true],
        ] as Array<[SalesFilters, boolean]>)('hasActiveFilters(%j) → %s', (f, expected) => {
            expect(hasActiveFilters(f)).toBe(expected);
        });
    });

    describe('Given the component unmounts before options arrive', () => {
        it('When the calls resolve late / Then no state update is attempted', async () => {
            let resolveCats: (v: unknown) => void = () => {};
            let resolveUsers: (v: unknown) => void = () => {};
            crm.getProductCategories.mockReturnValue(new Promise((r) => { resolveCats = r; }));
            crm.getUsers.mockReturnValue(new Promise((r) => { resolveUsers = r; }));
            const { unmount } = render(<Harness />);
            unmount();
            resolveCats([{ id: 'p1', name: 'Late' }]);
            resolveUsers([{ id: 'u1', full_name: 'Late', email: 'l@x' }]);
            await Promise.resolve();
            expect(screen.queryByText('Late')).not.toBeInTheDocument();
        });
    });
});
