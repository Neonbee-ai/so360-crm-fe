import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityHistoryDrawer from './ActivityHistoryDrawer';
import { activitiesApi, timelineApi } from '../../services/crmService';

// Task 4: ActivityHistoryDrawer now shares useEntityTimeline/TimelineEventCard
// with the inline Activity tab, reading from timelineApi.getTimeline instead
// of activitiesApi.getAllByLeadPaginated + client-side aggregation.
vi.mock('../../services/crmService', () => ({
    activitiesApi: {
        update: vi.fn(),
        delete: vi.fn(),
    },
    timelineApi: {
        getTimeline: vi.fn(),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatDateTime: (d: string) => d,
        formatCurrency: (v: number) => `$${v}`,
    }),
}));

const now = new Date().toISOString();

const ALL_EVENTS = [
    { id: 'call:c1', icon: 'call', title: 'Outbound call logged', description: 'Call with client', actor_id: null, actor_name: 'Alice', created_at: now, module: 'crm', related_type: 'call', related_id: 'c1', status_badge: null, group_key: 'call' },
    { id: 'note:n1', icon: 'note', title: 'Note added', description: 'Sent proposal', actor_id: null, actor_name: null, created_at: now, module: 'crm', related_type: 'note', related_id: 'n1', status_badge: null, group_key: 'note' },
    { id: 'field:f1', icon: 'edit', title: 'status changed', description: 'New → Qualified', actor_id: null, actor_name: null, created_at: now, module: 'crm', related_type: 'lead', related_id: null, status_badge: 'manual', group_key: 'field:status' },
];

const SUMMARY = {
    last_interaction_at: now,
    most_active_contact: 'Alice',
    counts: {},
    pending_tasks: 0,
    latest_stage: null,
    idle_days: 0,
    health_status: 'healthy' as const,
};

function mockGetTimeline(filters: { search?: string; module?: string } = {}) {
    let events = ALL_EVENTS;
    if (filters.module) events = events.filter((e) => e.module === filters.module);
    if (filters.search) {
        const q = filters.search.toLowerCase();
        events = events.filter((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    return Promise.resolve({ data: events, nextCursor: null, summary: SUMMARY });
}

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    entityType: 'lead',
    entityId: 'lead-1',
};

function renderDrawer(props: Partial<typeof defaultProps> = {}) {
    return render(
        <MemoryRouter>
            <ActivityHistoryDrawer {...defaultProps} {...props} />
        </MemoryRouter>,
    );
}

describe('ActivityHistoryDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(timelineApi.getTimeline).mockImplementation((_entityType, _entityId, filters = {}) => mockGetTimeline(filters as any));
    });

    describe('Given the drawer is closed', () => {
        it('When isOpen=false / Then renders nothing', () => {
            const { container } = renderDrawer({ isOpen: false });
            expect(container.firstChild).toBeNull();
        });
    });

    describe('Given the drawer is open', () => {
        it('When rendered / Then shows Activity History header', async () => {
            renderDrawer();
            await waitFor(() => expect(screen.getByText('Activity History')).toBeInTheDocument());
        });

        it('When events load / Then displays event titles', async () => {
            renderDrawer();
            await waitFor(() => expect(screen.getByText('Outbound call logged')).toBeInTheDocument());
            expect(screen.getByText('Note added')).toBeInTheDocument();
        });

        it('When rendered / Then calls timelineApi.getTimeline for the given entity', async () => {
            renderDrawer();
            await waitFor(() => expect(timelineApi.getTimeline).toHaveBeenCalledWith('lead', 'lead-1', expect.any(Object)));
        });
    });

    describe('Given the search input is used', () => {
        it('When user types in search / Then re-queries and shows matching items', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            const input = screen.getByPlaceholderText('Search activities…');
            fireEvent.change(input, { target: { value: 'proposal' } });

            await waitFor(() => expect(screen.getByText('Note added')).toBeInTheDocument());
            expect(screen.queryByText('Outbound call logged')).not.toBeInTheDocument();
        });

        it('When search yields no results / Then shows empty state message', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            fireEvent.change(screen.getByPlaceholderText('Search activities…'), {
                target: { value: 'zzznomatch' },
            });

            await waitFor(() => expect(screen.getByText('No matching activities')).toBeInTheDocument());
        });
    });

    describe('Given module filter buttons', () => {
        it('When CRM filter is clicked / Then re-queries scoped to the crm module', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            fireEvent.click(screen.getByRole('button', { name: 'CRM' }));

            await waitFor(() =>
                expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ module: 'crm' })),
            );
        });

        it('When All filter is clicked after filtering / Then shows all events again', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            fireEvent.click(screen.getByRole('button', { name: 'CRM' }));
            fireEvent.click(screen.getByRole('button', { name: 'All' }));

            await waitFor(() => expect(screen.getByText('Outbound call logged')).toBeInTheDocument());
            expect(screen.getByText('Note added')).toBeInTheDocument();
        });
    });

    describe('Given the close button', () => {
        it('When close button is clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            renderDrawer({ onClose });
            await waitFor(() => screen.getByText('Activity History'));

            const panel = document.querySelector('.fixed.right-0') as HTMLElement;
            const closeBtn = panel.querySelector('button');
            fireEvent.click(closeBtn!);
            expect(onClose).toHaveBeenCalled();
        });

        it('When overlay is clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            renderDrawer({ onClose });
            await waitFor(() => screen.getByText('Activity History'));

            const overlay = document.querySelector('.fixed.inset-0');
            if (overlay) fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Given the drawer positioning relative to the fixed shell header', () => {
        it('When open / Then the panel starts below the 56px glass-nav header (top-14, not top-0)', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Activity History'));

            const panel = document.querySelector('.fixed.right-0');
            expect(panel).not.toBeNull();
            expect(panel).toHaveClass('top-14');
            expect(panel).not.toHaveClass('top-0');
        });

        it('When open / Then the panel height is the remaining viewport below the header, not full height', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Activity History'));

            const panel = document.querySelector('.fixed.right-0');
            expect(panel).not.toBeNull();
            expect(panel).toHaveClass('h-[calc(100vh-3.5rem)]');
            expect(panel).not.toHaveClass('h-full');
        });
    });

    describe('Given API returns no events', () => {
        it('When no events exist / Then shows empty state', async () => {
            vi.mocked(timelineApi.getTimeline).mockResolvedValue({ data: [], nextCursor: null, summary: SUMMARY });

            renderDrawer();
            await waitFor(() => expect(screen.getByText('No Activity Yet')).toBeInTheDocument());
        });
    });

    describe('Given more events are available (nextCursor set)', () => {
        it('When rendered / Then shows Load More button', async () => {
            vi.mocked(timelineApi.getTimeline).mockResolvedValue({ data: ALL_EVENTS, nextCursor: now, summary: SUMMARY });

            renderDrawer();
            await waitFor(() => expect(screen.getByText('Load More')).toBeInTheDocument());
        });
    });
});
