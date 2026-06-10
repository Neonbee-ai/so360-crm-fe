import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActivityHistoryDrawer from './ActivityHistoryDrawer';
import { activitiesApi } from '../../services/crmService';

vi.mock('../../services/crmService', () => ({
    activitiesApi: {
        getAllByLeadPaginated: vi.fn(),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatDateTime: (d: string) => d,
        formatCurrency: (v: number) => `$${v}`,
    }),
}));

const mockActivities = [
    { id: 'a1', type: 'CALL', notes: 'Call with client', date: new Date().toISOString(), created_at: new Date().toISOString(), author: { id: 'u1', full_name: 'Alice', avatar_url: null } },
    { id: 'a2', type: 'EMAIL', notes: 'Sent proposal', date: new Date().toISOString(), created_at: new Date().toISOString(), author: null },
    { id: 'a3', type: 'STATUS_CHANGE', notes: 'Status updated', date: new Date().toISOString(), created_at: new Date().toISOString(), author: null },
];

const mockLead = {
    id: 'lead-1',
    notes: [{ id: 'n1', content: 'Important note', created_at: new Date().toISOString(), author: null }],
    documents: [],
    activities: [],
} as any;

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    leadId: 'lead-1',
    lead: mockLead,
    associatedTasks: [],
    associatedDeals: [],
};

describe('ActivityHistoryDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(activitiesApi.getAllByLeadPaginated).mockResolvedValue({
            data: mockActivities,
            total: 3,
        });
    });

    describe('Given the drawer is closed', () => {
        it('When isOpen=false / Then renders nothing', () => {
            const { container } = render(<ActivityHistoryDrawer {...defaultProps} isOpen={false} />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('Given the drawer is open', () => {
        it('When rendered / Then shows Activity History header', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('Activity History')).toBeInTheDocument());
        });

        it('When activities load / Then displays activity items', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('CALL Logged')).toBeInTheDocument());
            expect(screen.getByText('EMAIL Logged')).toBeInTheDocument();
        });

        it('When activities load / Then shows total count in header', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('3 total activities')).toBeInTheDocument());
        });

        it('When rendered / Then calls getAllByLeadPaginated with reset offset 0', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => expect(activitiesApi.getAllByLeadPaginated).toHaveBeenCalledWith('lead-1', 50, 0));
        });
    });

    describe('Given the search input is used', () => {
        it('When user types in search / Then filters timeline to matching items', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('CALL Logged'));

            const input = screen.getByPlaceholderText('Search activities…');
            fireEvent.change(input, { target: { value: 'proposal' } });

            expect(screen.getByText('EMAIL Logged')).toBeInTheDocument();
            expect(screen.queryByText('CALL Logged')).not.toBeInTheDocument();
        });

        it('When search yields no results / Then shows empty state message', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('CALL Logged'));

            fireEvent.change(screen.getByPlaceholderText('Search activities…'), {
                target: { value: 'zzznomatch' },
            });

            expect(screen.getByText('No matching activities')).toBeInTheDocument();
        });
    });

    describe('Given activity filter buttons', () => {
        it('When Calls filter is clicked / Then shows only CALL events', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('CALL Logged'));

            fireEvent.click(screen.getByRole('button', { name: 'Calls' }));

            expect(screen.getByText('CALL Logged')).toBeInTheDocument();
            expect(screen.queryByText('EMAIL Logged')).not.toBeInTheDocument();
        });

        it('When System Events filter is clicked / Then shows only system events', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('STATUS CHANGE'));

            fireEvent.click(screen.getByRole('button', { name: 'System Events' }));

            expect(screen.queryByText('CALL Logged')).not.toBeInTheDocument();
        });

        it('When All filter is clicked after filtering / Then shows all events', async () => {
            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('CALL Logged'));

            fireEvent.click(screen.getByRole('button', { name: 'Calls' }));
            fireEvent.click(screen.getByRole('button', { name: 'All' }));

            expect(screen.getByText('CALL Logged')).toBeInTheDocument();
            expect(screen.getByText('EMAIL Logged')).toBeInTheDocument();
        });
    });

    describe('Given the close button', () => {
        it('When close button is clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            render(<ActivityHistoryDrawer {...defaultProps} onClose={onClose} />);
            await waitFor(() => screen.getByText('Activity History'));

            fireEvent.click(screen.getByRole('button', { name: '' })); // X button
            expect(onClose).toHaveBeenCalled();
        });

        it('When overlay is clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            render(<ActivityHistoryDrawer {...defaultProps} onClose={onClose} />);
            await waitFor(() => screen.getByText('Activity History'));

            // Click the overlay div
            const overlay = document.querySelector('.fixed.inset-0');
            if (overlay) fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Given API returns no activities', () => {
        it('When no activities exist / Then shows empty state', async () => {
            vi.mocked(activitiesApi.getAllByLeadPaginated).mockResolvedValue({ data: [], total: 0 });
            const emptyLead = { ...mockLead, notes: [], documents: [] };

            render(<ActivityHistoryDrawer {...defaultProps} lead={emptyLead} associatedTasks={[]} associatedDeals={[]} />);
            await waitFor(() => expect(screen.getByText('No Activity Yet')).toBeInTheDocument());
        });
    });

    describe('Given hasMore is true (more activities available)', () => {
        it('When rendered / Then shows Load More button', async () => {
            vi.mocked(activitiesApi.getAllByLeadPaginated).mockResolvedValue({
                data: mockActivities,
                total: 100,
            });

            render(<ActivityHistoryDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText(/Load More/)).toBeInTheDocument());
        });
    });
});
