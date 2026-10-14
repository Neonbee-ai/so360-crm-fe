import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineEventCard from './TimelineEventCard';
import type { EntityTimelineEvent } from '../../../services/crmService';

vi.mock('../../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatDateTime: (d: string) => d }),
}));

const baseEvent = (overrides: Partial<EntityTimelineEvent> = {}): EntityTimelineEvent => ({
    id: 'evt-1',
    icon: 'activity',
    title: 'Event title',
    description: 'Event description',
    actor_id: null,
    actor_name: null,
    created_at: '2026-09-28T10:00:00Z',
    module: 'crm',
    related_type: null,
    related_id: null,
    status_badge: null,
    group_key: 'activity',
    ...overrides,
});

function renderCard(event: EntityTimelineEvent) {
    return render(
        <MemoryRouter>
            <TimelineEventCard event={event} />
        </MemoryRouter>,
    );
}

describe('TimelineEventCard — G8 Client 360 icons', () => {
    describe('Given events of the new Client 360 interaction types', () => {
        it.each([
            ['meeting', 'Users'],
            ['email', 'AtSign'],
            ['whatsapp', 'MessageCircle'],
            ['message', 'MessageSquare'],
            ['booking', 'Home'],
        ])('When the event icon is "%s" / Then the %s icon is rendered', (icon, lucideName) => {
            renderCard(baseEvent({ icon, type: icon, module: icon === 'booking' ? 'crm' : 'inbox' }));
            expect(screen.getByTestId(`icon-${lucideName}`)).toBeInTheDocument();
            expect(screen.queryByTestId('icon-Info')).not.toBeInTheDocument();
        });
    });

    describe('Given an Inbox-sourced WhatsApp conversation', () => {
        it('When rendered / Then the title, description and inbox module badge are shown', () => {
            renderCard(baseEvent({ icon: 'whatsapp', type: 'whatsapp', module: 'inbox', title: 'WhatsApp conversation', description: 'Is the unit still available?' }));
            expect(screen.getByText('WhatsApp conversation')).toBeInTheDocument();
            expect(screen.getByText('Is the unit still available?')).toBeInTheDocument();
            expect(screen.getByText('inbox')).toBeInTheDocument();
        });
    });

    describe('Given an unrecognised icon', () => {
        it('When rendered / Then it falls back to the Info icon', () => {
            renderCard(baseEvent({ icon: 'something-new' }));
            expect(screen.getByTestId('icon-Info')).toBeInTheDocument();
        });
    });
});
