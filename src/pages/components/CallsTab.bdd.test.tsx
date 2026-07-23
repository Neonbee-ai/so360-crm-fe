/**
 * BDD Spec — CallsTab
 *
 * Covers: empty state, rendering a list of calls with sentiment badges,
 * uploading a call recording via the inline form, and the Play button
 * lazily fetching + rendering the signed playback URL.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetCallsByLeadId = vi.fn();
const mockGetCallsByDealId = vi.fn();
const mockUploadCallRecording = vi.fn();
const mockGetCallPlaybackUrl = vi.fn();
const mockDeleteCallRecord = vi.fn();

vi.mock('../../services/crmService', () => ({
    crmService: {
        getCallsByLeadId: (...a: any[]) => mockGetCallsByLeadId(...a),
        getCallsByDealId: (...a: any[]) => mockGetCallsByDealId(...a),
        uploadCallRecording: (...a: any[]) => mockUploadCallRecording(...a),
        getCallPlaybackUrl: (...a: any[]) => mockGetCallPlaybackUrl(...a),
        deleteCallRecord: (...a: any[]) => mockDeleteCallRecord(...a),
    },
}));

import CallsTab from './CallsTab';

const makeCall = (overrides: Record<string, unknown> = {}) => ({
    id: 'call-1',
    lead_id: 'lead-1',
    deal_id: null,
    direction: 'outbound',
    occurred_at: '2026-07-23T10:00:00Z',
    duration_seconds: 125,
    phone_number: '+15550000000',
    dms_document_id: null,
    transcript_text: 'This is a test transcript.',
    sentiment: 'positive',
    emotion_scores: null,
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetCallsByLeadId.mockResolvedValue([]);
    mockGetCallsByDealId.mockResolvedValue([]);
});

describe('Given CallsTab', () => {
    describe('Given no calls exist for the lead', () => {
        it('When rendered / Then shows the empty state message', async () => {
            render(<CallsTab leadId="lead-1" />);
            await waitFor(() => {
                expect(screen.getByText(/No calls logged yet/i)).toBeInTheDocument();
            });
        });
    });

    describe('Given calls exist for the lead', () => {
        it('When rendered / Then each call renders with a color-coded sentiment badge', async () => {
            mockGetCallsByLeadId.mockResolvedValue([
                makeCall({ id: 'call-positive', sentiment: 'positive' }),
                makeCall({ id: 'call-negative', sentiment: 'negative', phone_number: '+15551111111' }),
            ]);

            render(<CallsTab leadId="lead-1" />);

            await waitFor(() => {
                expect(screen.getByText('positive')).toBeInTheDocument();
                expect(screen.getByText('negative')).toBeInTheDocument();
            });
            expect(mockGetCallsByLeadId).toHaveBeenCalledWith('lead-1');
        });
    });

    describe('Given the Upload Call Recording form is submitted', () => {
        it('When a file is selected and Upload Recording is clicked / Then uploadCallRecording is called and the new call is prepended to the list', async () => {
            mockGetCallsByLeadId.mockResolvedValue([]);
            mockUploadCallRecording.mockResolvedValue(makeCall({ id: 'call-new', phone_number: '+15559999999' }));

            render(<CallsTab leadId="lead-1" />);
            await waitFor(() => screen.getByText(/No calls logged yet/i));

            fireEvent.click(screen.getByRole('button', { name: /Upload Call Recording/i }));

            const file = new File(['audio-bytes'], 'call.mp3', { type: 'audio/mpeg' });
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(fileInput, { target: { files: [file] } });

            fireEvent.click(screen.getByRole('button', { name: /Upload Recording/i }));

            await waitFor(() => {
                expect(mockUploadCallRecording).toHaveBeenCalledTimes(1);
            });
            const [uploadedFile, fields] = mockUploadCallRecording.mock.calls[0];
            expect(uploadedFile).toBeInstanceOf(File);
            expect(fields.lead_id).toBe('lead-1');

            await waitFor(() => {
                expect(screen.getByText('+15559999999')).toBeInTheDocument();
            });
        });
    });

    describe('Given a call has a linked recording (dms_document_id)', () => {
        it('When the Play button is clicked / Then the playback URL is fetched lazily and an audio element is rendered', async () => {
            mockGetCallsByLeadId.mockResolvedValue([
                makeCall({ id: 'call-audio', dms_document_id: 'dms-1' }),
            ]);
            mockGetCallPlaybackUrl.mockResolvedValue({ url: 'https://signed.example.com/call.mp3', expires_in: 600 });

            render(<CallsTab leadId="lead-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Play/i }));

            expect(mockGetCallPlaybackUrl).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: /Play/i }));

            await waitFor(() => {
                expect(mockGetCallPlaybackUrl).toHaveBeenCalledWith('call-audio');
            });

            await waitFor(() => {
                const audio = document.querySelector('audio');
                expect(audio).not.toBeNull();
                expect(audio?.getAttribute('src')).toBe('https://signed.example.com/call.mp3');
            });
        });
    });
});
