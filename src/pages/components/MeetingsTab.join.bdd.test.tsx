/**
 * BDD Spec — MeetingsTab Join action (Pulse ab92e893)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flag.on }),
}));

const api = vi.hoisted(() => ({ getByLead: vi.fn(), getByDeal: vi.fn(), cancel: vi.fn(), providers: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('../../services/crmService', () => ({ meetingsApi: api }));

import MeetingsTab from './MeetingsTab';

const JOIN = 'https://meet.google.com/abc-defg-hij';
const meeting = (o: Record<string, unknown> = {}) => ({
    id: 'm-1', title: 'Demo call', status: 'upcoming', scheduled_at: '2026-11-10T10:00:00Z', duration_minutes: 30,
    attendees: [], location: JOIN, meeting_provider: 'google_meet', join_url: JOIN, ...o,
});

let openSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    vi.clearAllMocks();
    flag.on = true;
    api.providers.mockResolvedValue([]);
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => openSpy.mockRestore());

describe('Given an upcoming online meeting with a join link', () => {
    it('When Join is clicked / Then the link opens in a new tab without opener access', async () => {
        api.getByLead.mockResolvedValue([meeting()]);
        render(<MeetingsTab leadId="lead-1" />);
        fireEvent.click(await screen.findByTestId('meeting-join-m-1'));
        expect(openSpy).toHaveBeenCalledWith(JOIN, '_blank', 'noopener,noreferrer');
    });

    it('When listed / Then the platform is named and the link is not repeated as the location', async () => {
        api.getByLead.mockResolvedValue([meeting()]);
        render(<MeetingsTab leadId="lead-1" />);
        expect(await screen.findByTestId('meeting-provider-m-1')).toHaveTextContent('Google Meet');
        expect(screen.queryByText(JOIN)).toBeNull();
    });

    it('When the location differs from the join link / Then the location still shows', async () => {
        api.getByLead.mockResolvedValue([meeting({ location: 'Room 4', meeting_provider: 'microsoft_teams' })]);
        render(<MeetingsTab leadId="lead-1" />);
        expect(await screen.findByText('Room 4')).toBeInTheDocument();
        expect(screen.getByTestId('meeting-provider-m-1')).toHaveTextContent('Teams');
    });

    it('When the provider is unknown / Then Join shows but no platform label', async () => {
        api.getByLead.mockResolvedValue([meeting({ meeting_provider: 'manual' })]);
        render(<MeetingsTab leadId="lead-1" />);
        expect(await screen.findByTestId('meeting-join-m-1')).toBeInTheDocument();
        expect(screen.queryByTestId('meeting-provider-m-1')).toBeNull();
    });

    it('When the flag is off / Then no Join or platform shows and the location renders as before', async () => {
        flag.on = false;
        api.getByLead.mockResolvedValue([meeting()]);
        render(<MeetingsTab leadId="lead-1" />);
        expect(await screen.findByText(JOIN)).toBeInTheDocument();
        expect(screen.queryByTestId('meeting-join-m-1')).toBeNull();
        expect(screen.queryByTestId('meeting-provider-m-1')).toBeNull();
    });
});

describe('Given meetings without a join link or no longer upcoming', () => {
    it('When a meeting has no join link / Then no Join action shows', async () => {
        api.getByDeal.mockResolvedValue([meeting({ join_url: null, meeting_provider: null, location: 'Office' })]);
        render(<MeetingsTab dealId="deal-1" />);
        expect(await screen.findByText('Office')).toBeInTheDocument();
        expect(screen.queryByTestId('meeting-join-m-1')).toBeNull();
    });

    it('When the meeting is completed / Then no Join action shows', async () => {
        api.getByLead.mockResolvedValue([meeting({ status: 'completed' })]);
        render(<MeetingsTab leadId="lead-1" />);
        await waitFor(() => expect(screen.getByText('Demo call')).toBeInTheDocument());
        expect(screen.queryByTestId('meeting-join-m-1')).toBeNull();
    });
});
