import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    describe('Given the module quick filter', () => {
        it('When CRM filter is clicked / Then re-queries scoped to the crm module', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            fireEvent.change(screen.getByTestId('filter-module'), { target: { value: 'crm' } });

            await waitFor(() =>
                expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ module: 'crm' })),
            );
        });

        it('When All filter is clicked after filtering / Then shows all events again', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            fireEvent.change(screen.getByTestId('filter-module'), { target: { value: 'crm' } });
            fireEvent.change(screen.getByTestId('filter-module'), { target: { value: '' } });

            await waitFor(() => expect(screen.getByText('Outbound call logged')).toBeInTheDocument());
            expect(screen.getByText('Note added')).toBeInTheDocument();
        });
    });

    describe('Given the close button', () => {
        it('When close button is clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            renderDrawer({ onClose });
            await waitFor(() => screen.getByText('Activity History'));

            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Given the DS Drawer shell', () => {
        it('When open / Then it renders as the activity-history drawer dialog', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Activity History'));
            expect(screen.getByTestId('activity-history-drawer')).toHaveAttribute('role', 'dialog');
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

    describe('Given the G8 Client 360 interaction-type filter (Filters drawer)', () => {
        const SUMMARY_WITH_COUNTS = {
            ...SUMMARY,
            type_counts: { call: 3, whatsapp: 2, email: 0, meeting: 1, booking: 4 },
        };
        const openTypes = async () => {
            fireEvent.click(screen.getByTestId('filters-button'));
            return screen.getByTestId('filter-types') as HTMLSelectElement;
        };

        beforeEach(() => {
            vi.mocked(timelineApi.getTimeline).mockImplementation((_t, _id, filters: any = {}) => {
                const types = filters.types ? String(filters.types).split(',') : null;
                const data = types ? ALL_EVENTS.filter((e) => types.includes(e.icon)) : ALL_EVENTS;
                return Promise.resolve({ data, nextCursor: null, summary: SUMMARY_WITH_COUNTS }) as any;
            });
        });

        it('When the drawer opens / Then no types filter is sent and the drawer lists every type', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            const el = await openTypes();
            expect(Array.from(el.options).map((o) => o.value)).toEqual(['call', 'whatsapp', 'email', 'meeting', 'task', 'note', 'document', 'booking']);
            expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ types: undefined }));
        });

        it('When summary.type_counts is present / Then options show counts (including zero) and omit counts for absent types', async () => {
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            const el = await openTypes();
            const label = (v: string) => Array.from(el.options).find((o) => o.value === v)?.textContent;
            expect(label('call')).toBe('Calls (3)');
            expect(label('whatsapp')).toBe('WhatsApp (2)');
            expect(label('email')).toBe('Email (0)');
            expect(label('booking')).toBe('Bookings (4)');
            expect(label('task')).toBe('Tasks');
        });

        it('When summary has no type_counts / Then options render without counts', async () => {
            vi.mocked(timelineApi.getTimeline).mockResolvedValue({ data: ALL_EVENTS, nextCursor: null, summary: SUMMARY } as any);
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));
            const el = await openTypes();
            expect(Array.from(el.options).find((o) => o.value === 'call')?.textContent).toBe('Calls');
        });

        it('When Calls then WhatsApp are selected / Then the query sends types=call,whatsapp', async () => {
            const user = userEvent.setup();
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            const el = await openTypes();
            await user.selectOptions(el, 'call');
            await waitFor(() =>
                expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ types: 'call' })),
            );
            await waitFor(() => expect(screen.queryByText('Note added')).not.toBeInTheDocument());
            expect(screen.getByText('Outbound call logged')).toBeInTheDocument();

            await user.selectOptions(screen.getByTestId('filter-types'), 'whatsapp');
            await waitFor(() =>
                expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ types: 'call,whatsapp' })),
            );
        });

        it('When a selected type chip is removed / Then the types filter is dropped', async () => {
            const user = userEvent.setup();
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            await user.selectOptions(await openTypes(), 'call');
            const chip = await screen.findByRole('button', { name: 'Remove Interaction type filter' });
            fireEvent.click(chip);

            await waitFor(() =>
                expect(timelineApi.getTimeline).toHaveBeenLastCalledWith('lead', 'lead-1', expect.objectContaining({ types: undefined })),
            );
            await waitFor(() => expect(screen.getByText('Note added')).toBeInTheDocument());
        });

        it('When a type filter matches nothing / Then the "No matching activities" empty state is shown', async () => {
            const user = userEvent.setup();
            renderDrawer();
            await waitFor(() => screen.getByText('Outbound call logged'));

            await user.selectOptions(await openTypes(), 'booking');

            await waitFor(() => expect(screen.getByText('No matching activities')).toBeInTheDocument());
            expect(screen.getByText('Try adjusting your search or filter.')).toBeInTheDocument();
        });

        it('When no filters are set and nothing exists / Then the generic empty-state copy refers to the record, not a lead', async () => {
            vi.mocked(timelineApi.getTimeline).mockResolvedValue({ data: [], nextCursor: null, summary: SUMMARY } as any);
            renderDrawer({ entityType: 'deal', entityId: 'deal-1' });
            await waitFor(() => expect(screen.getByText('No Activity Yet')).toBeInTheDocument());
            expect(screen.getByText(/interact with this record\./)).toBeInTheDocument();
            expect(timelineApi.getTimeline).toHaveBeenCalledWith('deal', 'deal-1', expect.any(Object));
        });
    });
});
