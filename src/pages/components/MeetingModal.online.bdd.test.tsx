/**
 * BDD Spec — MeetingModal online meeting platform (Pulse ab92e893)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flag.on }),
}));

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), providers: vi.fn() }));
vi.mock('../../services/crmService', () => ({ meetingsApi: api }));

import MeetingModal from './MeetingModal';

const PROVIDERS = [
    { provider: 'google_meet', label: 'Google Meet', available: true, connect_piece: 'google_calendar' },
    { provider: 'microsoft_teams', label: 'Microsoft Teams', available: false, reason: 'not_connected', connect_piece: 'microsoft_outlook' },
    { provider: 'zoom', label: 'Zoom', available: true },
];

const renderModal = (props: Record<string, unknown> = {}) => {
    const onSuccess = vi.fn();
    render(<MeetingModal leadId="lead-1" onClose={vi.fn()} onSuccess={onSuccess} {...props} />);
    return { onSuccess };
};
const setTitle = () => fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Demo call' } });
const platform = () => screen.getByLabelText('Meeting platform') as HTMLSelectElement;
const schedule = () => fireEvent.click(screen.getByRole('button', { name: /Schedule$/ }));

beforeEach(() => {
    vi.clearAllMocks();
    flag.on = true;
    api.providers.mockResolvedValue(PROVIDERS);
    api.create.mockResolvedValue({ id: 'm-1', title: 'Demo call' });
});

describe('Given the online meetings flag is off', () => {
    it('When the scheduler opens / Then no platform picker shows and providers are not fetched', () => {
        flag.on = false;
        renderModal();
        expect(screen.queryByLabelText('Meeting platform')).toBeNull();
        expect(screen.getByLabelText('Location / Link')).toBeInTheDocument();
        expect(api.providers).not.toHaveBeenCalled();
    });
});

describe('Given an existing meeting is being edited', () => {
    it('When the modal opens / Then the platform picker is hidden and update omits provider fields', async () => {
        api.update.mockResolvedValue({ id: 'm-9' });
        renderModal({ meeting: { id: 'm-9', title: 'Old', scheduled_at: '2026-11-10T10:00:00Z', duration_minutes: 30 } });
        expect(screen.queryByLabelText('Meeting platform')).toBeNull();
        expect(api.providers).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        await waitFor(() => expect(api.update).toHaveBeenCalled());
        expect(api.update.mock.calls[0][1]).not.toHaveProperty('meeting_provider');
    });
});

describe('Given the flag is on and a new meeting is scheduled', () => {
    it('When providers load / Then each shows with its status and unavailable ones are disabled', async () => {
        renderModal();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Microsoft Teams (not connected)' })).toBeInTheDocument());
        expect((screen.getByRole('option', { name: 'Microsoft Teams (not connected)' }) as HTMLOptionElement).disabled).toBe(true);
        expect((screen.getByRole('option', { name: 'Google Meet' }) as HTMLOptionElement).disabled).toBe(false);
        expect(platform().value).toBe('');
        expect(screen.queryByLabelText('Attendee emails')).toBeNull();
    });

    it('When the providers call fails / Then only the in-person option remains', async () => {
        api.providers.mockRejectedValue(new Error('down'));
        renderModal();
        await waitFor(() => expect(api.providers).toHaveBeenCalled());
        expect(platform().options).toHaveLength(1);
    });

    it('When providers returns a non-array / Then only the in-person option remains', async () => {
        api.providers.mockResolvedValue(null);
        renderModal();
        await waitFor(() => expect(api.providers).toHaveBeenCalled());
        expect(platform().options).toHaveLength(1);
    });

    it('When no provider is picked / Then create sends no provider fields', async () => {
        renderModal();
        setTitle();
        schedule();
        await waitFor(() => expect(api.create).toHaveBeenCalled());
        const body = api.create.mock.calls[0][0];
        expect(body).not.toHaveProperty('meeting_provider');
        expect(body).not.toHaveProperty('attendees');
        expect(body.lead_id).toBe('lead-1');
    });

    it('When Google Meet is picked without attendees / Then it asks for an email and does not call the API', async () => {
        renderModal();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Google Meet' })).toBeInTheDocument());
        setTitle();
        fireEvent.change(platform(), { target: { value: 'google_meet' } });
        expect(screen.getByLabelText('Attendee emails')).toBeRequired();
        expect(screen.getByLabelText('Location (optional)')).toBeInTheDocument();
        schedule();
        expect(await screen.findByText('Add at least one attendee email for Google Meet')).toBeInTheDocument();
        expect(api.create).not.toHaveBeenCalled();
    });

    it('When an attendee email is invalid / Then it names the bad entry and does not call the API', async () => {
        renderModal();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Zoom' })).toBeInTheDocument());
        setTitle();
        fireEvent.change(platform(), { target: { value: 'zoom' } });
        fireEvent.change(screen.getByLabelText('Attendee emails'), { target: { value: 'ok@x.com, nope' } });
        schedule();
        expect(await screen.findByText('Not a valid email: nope')).toBeInTheDocument();
        expect(api.create).not.toHaveBeenCalled();
    });

    it('When Google Meet is picked with attendees / Then create sends the provider and attendee emails', async () => {
        const { onSuccess } = renderModal();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Google Meet' })).toBeInTheDocument());
        setTitle();
        fireEvent.change(platform(), { target: { value: 'google_meet' } });
        fireEvent.change(screen.getByLabelText('Attendee emails'), { target: { value: 'A@x.com; b@y.io' } });
        schedule();
        await waitFor(() => expect(api.create).toHaveBeenCalled());
        expect(api.create.mock.calls[0][0]).toMatchObject({
            meeting_provider: 'google_meet',
            attendees: [{ external_email: 'a@x.com' }, { external_email: 'b@y.io' }],
            lead_id: 'lead-1',
        });
        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'm-1', title: 'Demo call' }));
    });

    it('When Zoom is picked with no attendees / Then it is allowed and attendees is empty', async () => {
        renderModal();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Zoom' })).toBeInTheDocument());
        setTitle();
        fireEvent.change(platform(), { target: { value: 'zoom' } });
        expect(screen.getByLabelText('Attendee emails')).not.toBeRequired();
        schedule();
        await waitFor(() => expect(api.create).toHaveBeenCalled());
        expect(api.create.mock.calls[0][0]).toMatchObject({ meeting_provider: 'zoom', attendees: [] });
    });

    it('When the modal unmounts before providers resolve / Then nothing updates after unmount', async () => {
        let resolve: (v: unknown) => void = () => {};
        api.providers.mockReturnValue(new Promise(r => { resolve = r; }));
        const { unmount } = render(<MeetingModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
        unmount();
        resolve(PROVIDERS);
        await Promise.resolve();
        expect(api.providers).toHaveBeenCalledTimes(1);
    });

    it('When the modal unmounts before providers reject / Then the failure is ignored', async () => {
        let reject: (e: unknown) => void = () => {};
        api.providers.mockReturnValue(new Promise((_r, j) => { reject = j; }));
        const { unmount } = render(<MeetingModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
        unmount();
        reject(new Error('late'));
        await Promise.resolve();
        expect(api.providers).toHaveBeenCalledTimes(1);
    });
});
