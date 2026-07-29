import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NeuraAiSummaryCard from './NeuraAiSummaryCard';
import { neuraAiService, inboxIntegrationApi } from '../../services/crmService';

vi.mock('../../services/crmService', () => ({
    neuraAiService: {
        createConversation: vi.fn(),
        sendMessage: vi.fn(),
    },
    inboxIntegrationApi: {
        getConversationsForLead: vi.fn(),
    },
}));

const defaultProps = {
    leadId: 'lead-1',
    leadLabel: 'Acme Corp',
    isInboxEnabled: true,
};

describe('NeuraAiSummaryCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.mocked(neuraAiService.createConversation).mockResolvedValue({ id: 'conv-1' });
        vi.mocked(neuraAiService.sendMessage).mockResolvedValue({
            userMessage: { id: 'um-1', role: 'user', content: 'Summarize' },
            assistantMessage: { id: 'am-1', role: 'assistant', content: 'Acme Corp is an active opportunity in Negotiation.' },
        } as any);
        vi.mocked(inboxIntegrationApi.getConversationsForLead).mockResolvedValue({ data: [], total: 0 });
    });

    describe('Given the card mounts for a lead', () => {
        it('When it loads / Then shows a loading state, then the summary', async () => {
            render(<NeuraAiSummaryCard {...defaultProps} />);
            expect(screen.getByText('Neura AI is reviewing this lead…')).toBeInTheDocument();

            await waitFor(() =>
                expect(screen.getByText('Acme Corp is an active opportunity in Negotiation.')).toBeInTheDocument(),
            );
        });

        it('When it loads / Then starts a conversation scoped to this lead automatically (no button click)', async () => {
            render(<NeuraAiSummaryCard {...defaultProps} />);
            await waitFor(() => expect(neuraAiService.createConversation).toHaveBeenCalledWith('Neura AI · Lead Acme Corp'));
            expect(neuraAiService.sendMessage).toHaveBeenCalledWith(
                'conv-1',
                expect.stringContaining('Summarize this customer'),
                { module: 'crm', entity: 'leads', id: 'lead-1', label: 'Acme Corp' },
            );
        });

        it('When a Neura AI conversation is already cached for this lead / Then reuses it instead of creating a new one', async () => {
            sessionStorage.setItem('neura_ai_conversation:lead-1', 'conv-cached');
            render(<NeuraAiSummaryCard {...defaultProps} />);

            await waitFor(() => expect(neuraAiService.sendMessage).toHaveBeenCalled());
            expect(neuraAiService.createConversation).not.toHaveBeenCalled();
            expect(neuraAiService.sendMessage.mock.calls[0][0]).toBe('conv-cached');
        });
    });

    describe('Given Inbox is enabled for the org and has conversations for this lead', () => {
        it('When the summary is requested / Then Inbox context is appended to the prompt', async () => {
            vi.mocked(inboxIntegrationApi.getConversationsForLead).mockResolvedValue({
                data: [
                    { id: 'ic1', entity_id: 'e1', platform: 'whatsapp', status: 'open', handler: 'ai', topic: 'Pricing question', message_count: 4, last_message_at: '2026-07-20T10:00:00Z' },
                ],
                total: 1,
            });

            render(<NeuraAiSummaryCard {...defaultProps} />);

            await waitFor(() => expect(neuraAiService.sendMessage).toHaveBeenCalled());
            const [, prompt] = vi.mocked(neuraAiService.sendMessage).mock.calls[0];
            expect(prompt).toContain('Inbox context');
            expect(prompt).toContain('whatsapp');
            expect(prompt).toContain('Pricing question');
        });
    });

    describe('Given Inbox is disabled for the org', () => {
        it('When the summary is requested / Then Inbox is never called and no Inbox context is sent', async () => {
            render(<NeuraAiSummaryCard {...defaultProps} isInboxEnabled={false} />);

            await waitFor(() => expect(neuraAiService.sendMessage).toHaveBeenCalled());
            expect(inboxIntegrationApi.getConversationsForLead).not.toHaveBeenCalled();
            const [, prompt] = vi.mocked(neuraAiService.sendMessage).mock.calls[0];
            expect(prompt).not.toContain('Inbox context');
        });
    });

    describe('Given the Inbox call fails or is denied by RBAC', () => {
        it('When getConversationsForLead rejects / Then the summary still generates without Inbox context', async () => {
            vi.mocked(inboxIntegrationApi.getConversationsForLead).mockRejectedValue(new Error('403 Forbidden'));

            render(<NeuraAiSummaryCard {...defaultProps} />);

            await waitFor(() =>
                expect(screen.getByText('Acme Corp is an active opportunity in Negotiation.')).toBeInTheDocument(),
            );
            const [, prompt] = vi.mocked(neuraAiService.sendMessage).mock.calls[0];
            expect(prompt).not.toContain('Inbox context');
        });
    });

    describe('Given the refresh button', () => {
        it('When clicked / Then regenerates the summary', async () => {
            const user = userEvent.setup();
            render(<NeuraAiSummaryCard {...defaultProps} />);
            await waitFor(() => screen.getByText('Acme Corp is an active opportunity in Negotiation.'));

            vi.mocked(neuraAiService.sendMessage).mockResolvedValueOnce({
                userMessage: { id: 'um-2', role: 'user', content: 'Summarize' },
                assistantMessage: { id: 'am-2', role: 'assistant', content: 'Updated summary.' },
            } as any);

            await user.click(screen.getByTitle('Refresh summary'));

            await waitFor(() => expect(screen.getByText('Updated summary.')).toBeInTheDocument());
            expect(neuraAiService.sendMessage).toHaveBeenCalledTimes(2);
        });
    });

    describe('Given Neura AI fails to generate a summary', () => {
        it('When sendMessage rejects on first load / Then shows an inline error, not a crash', async () => {
            vi.mocked(neuraAiService.sendMessage).mockRejectedValueOnce(new Error('down'));

            render(<NeuraAiSummaryCard {...defaultProps} />);

            await waitFor(() =>
                expect(screen.getByText('Could not generate a summary right now.')).toBeInTheDocument(),
            );
        });
    });

    describe('Given the viewed lead changes', () => {
        it('When leadId prop changes / Then refetches the summary for the new lead', async () => {
            const { rerender } = render(<NeuraAiSummaryCard {...defaultProps} />);
            await waitFor(() => expect(neuraAiService.createConversation).toHaveBeenCalledWith('Neura AI · Lead Acme Corp'));

            vi.mocked(neuraAiService.sendMessage).mockResolvedValueOnce({
                userMessage: { id: 'um-3', role: 'user', content: 'Summarize' },
                assistantMessage: { id: 'am-3', role: 'assistant', content: 'Beta Inc summary.' },
            } as any);

            rerender(<NeuraAiSummaryCard {...defaultProps} leadId="lead-2" leadLabel="Beta Inc" />);

            await waitFor(() => expect(neuraAiService.createConversation).toHaveBeenCalledWith('Neura AI · Lead Beta Inc'));
            expect(screen.getByText('Beta Inc summary.')).toBeInTheDocument();
        });
    });
});
