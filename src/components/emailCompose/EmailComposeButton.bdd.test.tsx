import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const h = vi.hoisted(() => ({
    flags: new Set<string>(),
    perms: new Set<string>(),
    loaded: true,
    bridge: 'default' as 'default' | 'none' | 'noHasPermission',
    listTemplates: vi.fn(),
    preview: vi.fn(),
    send: vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => {
        if (h.bridge === 'none') return undefined;
        if (h.bridge === 'noHasPermission') return { permissionsLoaded: true };
        return { permissionsLoaded: h.loaded, hasPermission: (p: string) => h.perms.has(p) };
    },
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { EMAIL_COMPOSE: 'action:crm:leads:email_compose' },
    useCrmFeatureFlag: (k: string) => h.flags.has(k),
}));

vi.mock('../../services/emailComposeService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/emailComposeService')>();
    return {
        ...actual,
        emailComposeService: {
            listTemplates: (...a: unknown[]) => h.listTemplates(...a),
            preview: (...a: unknown[]) => h.preview(...a),
            send: (...a: unknown[]) => h.send(...a),
        },
    };
});

import { EmailComposeButton } from './EmailComposeButton';

const FLAG = 'action:crm:leads:email_compose';
const LEAD = '11111111-1111-4111-8111-111111111111';

let successSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    h.flags = new Set([FLAG]);
    h.perms = new Set(['activities.create']);
    h.loaded = true;
    h.bridge = 'default';
    h.listTemplates.mockReset().mockResolvedValue([{ id: 't1', name: 'RE brochure', subject: '{{project}} brochure' }]);
    h.preview.mockReset();
    h.send.mockReset();
    successSpy = vi.spyOn(toast, 'success');
    errorSpy = vi.spyOn(toast, 'error');
});

afterEach(() => { successSpy.mockRestore(); errorSpy.mockRestore(); });

const openModal = async (props: Partial<React.ComponentProps<typeof EmailComposeButton>> = {}) => {
    render(<EmailComposeButton entityType="lead" entityId={LEAD} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compose Email' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'RE brochure' })).toBeInTheDocument());
};

describe('Given the Compose Email button (RE G9)', () => {
    describe('When the RE compose flag is off', () => {
        it('Then nothing renders', () => {
            h.flags = new Set();
            const { container } = render(<EmailComposeButton entityType="lead" entityId={LEAD} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When permissions are not loaded yet', () => {
        it('Then nothing renders (fail closed)', () => {
            h.loaded = false;
            const { container } = render(<EmailComposeButton entityType="lead" entityId={LEAD} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When activities.create is not granted', () => {
        it('Then nothing renders', () => {
            h.perms = new Set(['activities.read']);
            const { container } = render(<EmailComposeButton entityType="deal" entityId={LEAD} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the shell bridge is unavailable', () => {
        it('Then nothing renders (fail closed)', () => {
            h.bridge = 'none';
            const { container } = render(<EmailComposeButton entityType="lead" entityId={LEAD} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the shell bridge exposes no hasPermission function', () => {
        it('Then nothing renders (fail closed)', () => {
            h.bridge = 'noHasPermission';
            const { container } = render(<EmailComposeButton entityType="lead" entityId={LEAD} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the record id is empty', () => {
        it('Then nothing renders', () => {
            const { container } = render(<EmailComposeButton entityType="lead" entityId="" />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the flag and permission are on and the button is clicked', () => {
        it('Then the modal opens, loads Inbox templates and shows the merge-field hint', async () => {
            await openModal();
            expect(h.listTemplates).toHaveBeenCalledTimes(1);
            expect(screen.getByRole('dialog', { name: 'Compose email' })).toBeInTheDocument();
            expect(screen.getByTestId('merge-field-hint').textContent).toContain('{{brochure_link}}');
            expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
        });

        it('Then a template load failure still lets the user write their own email', async () => {
            h.listTemplates.mockRejectedValueOnce(new Error('down'));
            render(<EmailComposeButton entityType="lead" entityId={LEAD} />);
            fireEvent.click(screen.getByRole('button', { name: 'Compose Email' }));
            await waitFor(() => expect(screen.getByRole('option', { name: 'No template (write your own)' })).toBeInTheDocument());
            fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
            fireEvent.change(screen.getByLabelText('Body'), { target: { value: '<p>Hi</p>' } });
            expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
        });
    });

    describe('When a template is picked and a preview requested', () => {
        it('Then the template subject pre-fills and the rendered preview shows missing fields in a sandboxed frame', async () => {
            h.preview.mockResolvedValueOnce({
                to_email: 'sara@example.com', to_name: 'Sara', subject: 'Marina Heights brochure',
                body_html: '<p>Hi Sara</p>', missing_fields: ['brochure_link'],
            });
            await openModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            expect(screen.getByLabelText('Subject')).toHaveValue('{{project}} brochure');
            fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
            await waitFor(() => expect(screen.getByTestId('email-preview')).toBeInTheDocument());
            expect(h.preview).toHaveBeenCalledWith('lead', LEAD, {
                template_id: 't1', subject: '{{project}} brochure', body_html: '', to_email: '',
            });
            expect(screen.getByText('Marina Heights brochure')).toBeInTheDocument();
            expect(screen.getByRole('alert').textContent).toContain('brochure_link');
            const frame = screen.getByTitle('Email preview');
            expect(frame.getAttribute('sandbox')).toBe('');
        });

        it('Then a preview error is toasted', async () => {
            h.preview.mockRejectedValueOnce(new Error('Lead not found'));
            await openModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Lead not found'));
            expect(screen.queryByTestId('email-preview')).not.toBeInTheDocument();
        });
    });

    describe('When the email is sent successfully', () => {
        it('Then it posts to the deal target, toasts, calls onSent and closes', async () => {
            h.send.mockResolvedValueOnce({ success: true, conversation_id: 'c1', message_id: 'm1', tracking_id: 'tk', activity_id: 'a1' });
            const onSent = vi.fn();
            await openModal({ entityType: 'deal', onSent });
            fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Your offer' } });
            fireEvent.change(screen.getByLabelText('Body'), { target: { value: '<p>{{unit}}</p>' } });
            fireEvent.change(screen.getByLabelText('To'), { target: { value: 'buyer@example.com' } });
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(successSpy).toHaveBeenCalledWith('Email sent'));
            expect(h.send).toHaveBeenCalledWith('deal', LEAD, {
                template_id: '', subject: 'Your offer', body_html: '<p>{{unit}}</p>', to_email: 'buyer@example.com',
            });
            expect(onSent).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('When the email is sent successfully without an onSent callback', () => {
        it('Then it toasts and closes the modal', async () => {
            h.send.mockResolvedValueOnce({ success: true });
            await openModal({ entityType: 'contact' });
            fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hi' } });
            fireEvent.change(screen.getByLabelText('Body'), { target: { value: '<p>Hi</p>' } });
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(successSpy).toHaveBeenCalledWith('Email sent'));
            expect(h.send.mock.calls[0][0]).toBe('contact');
            await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
            expect(screen.getByRole('button', { name: 'Compose Email' })).toBeInTheDocument();
        });
    });

    describe('When the send fails', () => {
        it('Then the backend error is toasted and the modal stays open', async () => {
            h.send.mockRejectedValueOnce(new Error('Recipient has no email address'));
            await openModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Recipient has no email address'));
            expect(successSpy).not.toHaveBeenCalled();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('Then a success:false result is reported as not sent', async () => {
            h.send.mockResolvedValueOnce({ success: false, conversation_id: null, message_id: null, tracking_id: null, activity_id: null });
            await openModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Email was not sent'));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('When the modal close button is clicked', () => {
        it('Then the modal closes without sending', async () => {
            await openModal();
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(h.send).not.toHaveBeenCalled();
        });
    });
});
