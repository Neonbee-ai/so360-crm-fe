import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Window context setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
    (window as any).VITE_SO360_SIGN_API = 'http://localhost:3038';
    (window as any).__SO360_SHELL_CONTEXT__ = {
        accessToken: 'tok',
        tenantId: 'ten1',
        orgId: 'org1',
        userId: 'usr1',
    };
    mockFetch.mockReset();
});

afterEach(() => {
    delete (window as any).VITE_SO360_SIGN_API;
    delete (window as any).__SO360_SHELL_CONTEXT__;
});

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const templates = [
    { id: 'tpl1', name: 'NDA Standard', fields: [], roles: [] },
    { id: 'tpl2', name: 'Service Agreement', fields: [], roles: [] },
];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
function mockTemplatesFetch(list = templates) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => list,
    } as any);
}

function mockSendSuccess() {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'req1', state: 'sent' }),
    } as any);
}

function mockSendError(statusText = 'Bad Request') {
    mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => statusText,
    } as any);
}

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------
import SignRequestModal from './SignRequestModal';

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
function renderModal(props: Partial<React.ComponentProps<typeof SignRequestModal>> = {}) {
    const onClose = vi.fn();
    const result = render(
        <SignRequestModal
            onClose={onClose}
            prefillName="Jane Doe"
            prefillEmail="jane@example.com"
            sourceModel="crm.lead"
            sourceId="lead-123"
            {...props}
        />,
    );
    return { ...result, onClose };
}

// ===========================================================================
// describe: Given SignRequestModal renders
// ===========================================================================
describe('Given SignRequestModal renders', () => {

    it('When VITE_SO360_SIGN_API is not set, Then error "Sign service not configured" is shown', () => {
        // Remove before render — no fetch should be called
        delete (window as any).VITE_SO360_SIGN_API;

        renderModal();

        expect(screen.getByText('Sign service not configured')).toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('When templates are loading, Then template select shows "Loading…"', () => {
        // Never-resolving promise keeps phase at 'loading'
        mockFetch.mockReturnValueOnce(new Promise(() => { /* never resolves */ }));

        renderModal();

        expect(screen.getByRole('option', { name: 'Loading…' })).toBeInTheDocument();
    });

    it('When templates load, Then select shows each template name', async () => {
        mockTemplatesFetch();

        renderModal();

        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'NDA Standard' })).toBeInTheDocument();
        });
        expect(screen.getByRole('option', { name: 'Service Agreement' })).toBeInTheDocument();
    });

    it('When no templates are available, Then select shows "No templates available"', async () => {
        mockTemplatesFetch([]);

        renderModal();

        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'No templates available' })).toBeInTheDocument();
        });
    });

    it('When prefillName and prefillEmail props are set, Then inputs are pre-populated', async () => {
        mockTemplatesFetch();

        renderModal({ prefillName: 'Alice Smith', prefillEmail: 'alice@example.com' });

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        const nameInput = screen.getByPlaceholderText('Full name') as HTMLInputElement;
        const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;

        expect(nameInput.value).toBe('Alice Smith');
        expect(emailInput.value).toBe('alice@example.com');
    });

    it('When backdrop is clicked, Then onClose is called', async () => {
        mockTemplatesFetch();

        const { onClose } = renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        // The backdrop is the fixed overlay div — click it directly
        const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
        fireEvent.click(backdrop);

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// describe: Given the send flow
// ===========================================================================
describe('Given the send flow', () => {

    it('When signer name is empty, Then Send button is disabled', async () => {
        mockTemplatesFetch();

        renderModal({ prefillName: '' });

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        const sendBtn = screen.getByRole('button', { name: /send for signature/i });
        expect(sendBtn).toBeDisabled();
    });

    it('When signer email is invalid, Then Send button is disabled', async () => {
        mockTemplatesFetch();

        renderModal({ prefillEmail: 'not-an-email' });

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        const sendBtn = screen.getByRole('button', { name: /send for signature/i });
        expect(sendBtn).toBeDisabled();
    });

    it('When all fields are valid, Then Send button is enabled', async () => {
        mockTemplatesFetch();

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        const sendBtn = screen.getByRole('button', { name: /send for signature/i });
        expect(sendBtn).not.toBeDisabled();
    });

    it('When Send is clicked, Then fetch POSTs to /v1/sign/requests with correct body', async () => {
        mockTemplatesFetch();
        mockSendSuccess();

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        fireEvent.click(screen.getByRole('button', { name: /send for signature/i }));

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

        const [, sendCall] = mockFetch.mock.calls;
        expect(sendCall[0]).toBe('http://localhost:3038/v1/sign/requests');
        expect(sendCall[1].method).toBe('POST');

        const body = JSON.parse(sendCall[1].body);
        expect(body.template_id).toBe('tpl1');
        expect(body.routing).toBe('parallel');
        expect(body.signers[0].name).toBe('Jane Doe');
        expect(body.signers[0].email).toBe('jane@example.com');
        expect(body.source_res_model).toBe('crm.lead');
        expect(body.source_res_id).toBe('lead-123');
    });

    it('When Send is clicked, Then request includes correct auth headers', async () => {
        mockTemplatesFetch();
        mockSendSuccess();

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        fireEvent.click(screen.getByRole('button', { name: /send for signature/i }));

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

        const [, sendCall] = mockFetch.mock.calls;
        const headers = sendCall[1].headers as Record<string, string>;

        expect(headers['Authorization']).toBe('Bearer tok');
        expect(headers['X-Tenant-Id']).toBe('ten1');
        expect(headers['X-Org-Id']).toBe('org1');
        expect(headers['X-User-Id']).toBe('usr1');
    });

    it('When send succeeds, Then "Sent ✓" text appears', async () => {
        mockTemplatesFetch();
        mockSendSuccess();

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        fireEvent.click(screen.getByRole('button', { name: /send for signature/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /sent ✓/i })).toBeInTheDocument();
        });
    });

    it('When send fails, Then error message is displayed with server error text', async () => {
        mockTemplatesFetch();
        mockSendError('Template not found');

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        fireEvent.click(screen.getByRole('button', { name: /send for signature/i }));

        await waitFor(() => {
            expect(screen.getByText('Template not found')).toBeInTheDocument();
        });
    });
});

// ===========================================================================
// describe: Given modal controls
// ===========================================================================
describe('Given modal controls', () => {

    it('When X button is clicked, Then onClose is called', async () => {
        mockTemplatesFetch();

        const { onClose } = renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        // The X close button is the only button in the header without visible text
        // Find it by its proximity to the header via aria-label or by querying all buttons
        const buttons = screen.getAllByRole('button');
        // X button is the first button rendered (in the header)
        const xButton = buttons.find(btn => !btn.textContent?.trim() || btn.closest('header'));
        // More reliably: find the button that contains no meaningful text (just the icon)
        const headerButtons = document.querySelectorAll('header button');
        expect(headerButtons.length).toBeGreaterThan(0);
        fireEvent.click(headerButtons[0]);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('When send is in progress, Then Send button shows "Sending…"', async () => {
        mockTemplatesFetch();
        // Keep the send call pending so we can observe the 'sending' phase
        mockFetch.mockReturnValueOnce(new Promise(() => { /* never resolves */ }));

        renderModal();

        await waitFor(() => screen.getByRole('option', { name: 'NDA Standard' }));

        fireEvent.click(screen.getByRole('button', { name: /send for signature/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /sending…/i })).toBeInTheDocument();
        });
    });
});
