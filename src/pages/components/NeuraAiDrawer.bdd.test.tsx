import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NeuraAiDrawer from './NeuraAiDrawer';
import { neuraAiService } from '../../services/crmService';

vi.mock('../../services/crmService', () => ({
    neuraAiService: {
        createConversation: vi.fn(),
        sendMessage: vi.fn(),
    },
}));

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    leadId: 'lead-1',
    leadLabel: 'Acme Corp',
};

describe('NeuraAiDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.mocked(neuraAiService.createConversation).mockResolvedValue({ id: 'conv-1' });
        vi.mocked(neuraAiService.sendMessage).mockResolvedValue({
            userMessage: { id: 'um-1', role: 'user', content: 'Summarize this customer' },
            assistantMessage: { id: 'am-1', role: 'assistant', content: 'Here is the summary' },
        } as any);
    });

    describe('Given the drawer is closed', () => {
        it('When isOpen=false / Then renders nothing and never starts a conversation', () => {
            const { container } = render(<NeuraAiDrawer {...defaultProps} isOpen={false} />);
            expect(container.firstChild).toBeNull();
            expect(neuraAiService.createConversation).not.toHaveBeenCalled();
        });
    });

    describe('Given the drawer is open', () => {
        it('When rendered / Then shows the Neura AI header and the lead label', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('Neura AI')).toBeInTheDocument());
            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        });

        it('When first opened for this lead / Then starts a new conversation scoped to the lead', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() =>
                expect(neuraAiService.createConversation).toHaveBeenCalledWith('Neura AI · Lead Acme Corp'),
            );
        });

        it('When the conversation is ready / Then shows all four predefined prompts', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('Summarize this customer')).toBeInTheDocument());
            expect(screen.getByText('What happened in the last 30 days?')).toBeInTheDocument();
            expect(screen.getByText('What are the biggest risks?')).toBeInTheDocument();
            expect(screen.getByText('What should I do next?')).toBeInTheDocument();
        });

        it('When no message has been sent yet / Then shows the empty-state prompt', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => expect(screen.getByText('Ask Neura AI about this lead')).toBeInTheDocument());
        });
    });

    describe('Given a conversation already exists for this lead (reopened drawer)', () => {
        it('When the drawer opens / Then reuses the cached conversation instead of creating a new one', async () => {
            sessionStorage.setItem('neura_ai_conversation:lead-1', 'conv-cached');
            render(<NeuraAiDrawer {...defaultProps} />);

            await waitFor(() => expect(screen.getByText('Summarize this customer')).toBeInTheDocument());
            expect(neuraAiService.createConversation).not.toHaveBeenCalled();
        });
    });

    describe('Given a predefined prompt is clicked', () => {
        it('When "Summarize this customer" is clicked / Then sends the prompt scoped to this CRM lead', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('Summarize this customer'));

            fireEvent.click(screen.getByText('Summarize this customer'));

            await waitFor(() =>
                expect(neuraAiService.sendMessage).toHaveBeenCalledWith(
                    'conv-1',
                    'Summarize this customer',
                    { module: 'crm', entity: 'leads', id: 'lead-1', label: 'Acme Corp' },
                ),
            );
        });

        it('When the assistant replies / Then both the user and assistant messages render', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('Summarize this customer'));

            fireEvent.click(screen.getByText('Summarize this customer'));

            await waitFor(() => expect(screen.getByText('Here is the summary')).toBeInTheDocument());
            // The user's own bubble echoes the exact prompt text sent.
            expect(screen.getAllByText('Summarize this customer').length).toBeGreaterThan(0);
        });

        it('When a kpi block comes back / Then renders the kpi label and value', async () => {
            vi.mocked(neuraAiService.sendMessage).mockResolvedValueOnce({
                userMessage: { id: 'um-2', role: 'user', content: 'What are the biggest risks?' },
                assistantMessage: { id: 'am-2', role: 'assistant', content: 'Risk assessment:' },
                blocks: [{ type: 'kpi', label: 'Risk Score', value: '72%' }],
            } as any);

            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('What are the biggest risks?'));
            fireEvent.click(screen.getByText('What are the biggest risks?'));

            await waitFor(() => expect(screen.getByText('Risk Score')).toBeInTheDocument());
            expect(screen.getByText('72%')).toBeInTheDocument();
        });
    });

    describe('Given free-text input', () => {
        it('When the user types a question and presses Enter / Then sends it', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByPlaceholderText('Ask Neura AI anything about this lead…'));

            const input = screen.getByPlaceholderText('Ask Neura AI anything about this lead…');
            fireEvent.change(input, { target: { value: 'What deals are open?' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() =>
                expect(neuraAiService.sendMessage).toHaveBeenCalledWith(
                    'conv-1',
                    'What deals are open?',
                    { module: 'crm', entity: 'leads', id: 'lead-1', label: 'Acme Corp' },
                ),
            );
        });

        it('When the input is empty / Then the send button is disabled', async () => {
            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByPlaceholderText('Ask Neura AI anything about this lead…'));

            const sendButton = screen.getByPlaceholderText('Ask Neura AI anything about this lead…')
                .parentElement!.querySelector('button:last-child') as HTMLButtonElement;
            expect(sendButton).toBeDisabled();
        });
    });

    describe('Given Neura AI fails to answer', () => {
        it('When sendMessage rejects / Then shows an inline error instead of crashing', async () => {
            vi.mocked(neuraAiService.sendMessage).mockRejectedValueOnce(new Error('network error'));

            render(<NeuraAiDrawer {...defaultProps} />);
            await waitFor(() => screen.getByText('Summarize this customer'));
            fireEvent.click(screen.getByText('Summarize this customer'));

            await waitFor(() =>
                expect(screen.getByText('Neura AI could not answer that — please try again.')).toBeInTheDocument(),
            );
        });

        it('When createConversation rejects on open / Then shows a start-up error', async () => {
            vi.mocked(neuraAiService.createConversation).mockRejectedValueOnce(new Error('down'));

            render(<NeuraAiDrawer {...defaultProps} />);

            await waitFor(() =>
                expect(screen.getByText('Could not start Neura AI — please try again.')).toBeInTheDocument(),
            );
        });
    });

    describe('Given the close button', () => {
        it('When clicked / Then calls onClose', async () => {
            const onClose = vi.fn();
            render(<NeuraAiDrawer {...defaultProps} onClose={onClose} />);
            await waitFor(() => screen.getByText('Neura AI'));

            const overlay = document.querySelector('.fixed.inset-0');
            if (overlay) fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalled();
        });
    });
});
