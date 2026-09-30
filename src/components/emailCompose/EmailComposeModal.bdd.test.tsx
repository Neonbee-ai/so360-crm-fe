import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const h = vi.hoisted(() => ({
    listTemplates: vi.fn(),
    preview: vi.fn(),
    send: vi.fn(),
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

import { EmailComposeModal } from './EmailComposeModal';

const LEAD = 'lead-1';
const TEMPLATES = [
    { id: 't1', name: 'RE brochure', subject: '{{project}} brochure' },
    { id: 't2', name: 'Offer', subject: 'Offer for {{unit}}' },
];

const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

let successSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    h.listTemplates.mockReset().mockResolvedValue(TEMPLATES);
    h.preview.mockReset();
    h.send.mockReset();
    successSpy = vi.spyOn(toast, 'success');
    errorSpy = vi.spyOn(toast, 'error');
});

afterEach(() => { successSpy.mockRestore(); errorSpy.mockRestore(); });

const renderModal = async (props: Partial<React.ComponentProps<typeof EmailComposeModal>> = {}) => {
    const onClose = props.onClose ?? vi.fn();
    const utils = render(<EmailComposeModal entityType="lead" entityId={LEAD} onClose={onClose} {...props} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'RE brochure' })).toBeInTheDocument());
    return { ...utils, onClose };
};

const typeOwn = (subject = 'Hello', body = '<p>Hi</p>') => {
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: subject } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: body } });
};

describe('Given the Compose email modal (RE G9)', () => {
    describe('When templates are still loading', () => {
        it('Then the template picker is disabled with a loading label', async () => {
            const d = deferred<typeof TEMPLATES>();
            h.listTemplates.mockReturnValueOnce(d.promise);
            render(<EmailComposeModal entityType="lead" entityId={LEAD} onClose={vi.fn()} />);
            expect(screen.getByLabelText('Template')).toBeDisabled();
            expect(screen.getByRole('option', { name: 'Loading templates…' })).toBeInTheDocument();
            await act(async () => { d.resolve(TEMPLATES); });
            expect(screen.getByLabelText('Template')).toBeEnabled();
            expect(screen.getByRole('option', { name: 'No template (write your own)' })).toBeInTheDocument();
        });
    });

    describe('When the modal unmounts before templates resolve', () => {
        it('Then a late success is ignored without state updates', async () => {
            const d = deferred<typeof TEMPLATES>();
            h.listTemplates.mockReturnValueOnce(d.promise);
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { unmount } = render(<EmailComposeModal entityType="lead" entityId={LEAD} onClose={vi.fn()} />);
            unmount();
            await act(async () => { d.resolve(TEMPLATES); await d.promise; });
            expect(errSpy).not.toHaveBeenCalledWith(expect.stringContaining('unmounted'));
            errSpy.mockRestore();
        });

        it('Then a late failure is ignored too', async () => {
            const d = deferred<typeof TEMPLATES>();
            h.listTemplates.mockReturnValueOnce(d.promise);
            const { unmount } = render(<EmailComposeModal entityType="lead" entityId={LEAD} onClose={vi.fn()} />);
            unmount();
            await act(async () => { d.reject(new Error('down')); await d.promise.catch(() => undefined); });
            expect(h.listTemplates).toHaveBeenCalledTimes(1);
        });
    });

    describe('When nothing has been chosen or typed', () => {
        it('Then Preview and Send are disabled and the body label has no template hint', async () => {
            await renderModal();
            expect(screen.getByRole('button', { name: /Preview/ })).toBeDisabled();
            expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
            expect(screen.queryByText(/leave empty to use the template body/)).toBeNull();
        });

        it('Then a whitespace-only subject and body still keep submit disabled', async () => {
            await renderModal();
            typeOwn('   ', '  ');
            expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
        });
    });

    describe('When a template is picked after a subject was already typed', () => {
        it('Then the typed subject is kept and the body hint mentions the template body', async () => {
            await renderModal();
            fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'My own subject' } });
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't2' } });
            expect(screen.getByLabelText('Subject')).toHaveValue('My own subject');
            expect(screen.getByText(/leave empty to use the template body/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
        });
    });

    describe('When the template is cleared back to "write your own"', () => {
        it('Then no template subject is applied and submit needs subject + body again', async () => {
            await renderModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            expect(screen.getByLabelText('Subject')).toHaveValue('{{project}} brochure');
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: '' } });
            expect(screen.getByLabelText('Subject')).toHaveValue('{{project}} brochure');
            expect(screen.queryByText(/leave empty to use the template body/)).toBeNull();
            expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
        });
    });

    describe('When a preview is in flight', () => {
        it('Then both actions are disabled until it settles, and a record-email preview shows a dash and no warning', async () => {
            const d = deferred<any>();
            h.preview.mockReturnValueOnce(d.promise);
            await renderModal();
            typeOwn();
            fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
            await waitFor(() => expect(screen.getByRole('button', { name: /Preview/ })).toBeDisabled());
            expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
            await act(async () => {
                d.resolve({ to_email: null, to_name: null, subject: 'Hello', body_html: '<p>Hi</p>', missing_fields: [] });
            });
            expect(screen.getByTestId('email-preview')).toHaveTextContent('To: —');
            expect(screen.queryByRole('alert')).toBeNull();
            expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
        });
    });

    describe('When the draft is edited after a preview', () => {
        it.each([['To', 'x@example.com'], ['Subject', 'Changed'], ['Body', '<p>Changed</p>']])(
            'Then editing %s discards the stale preview',
            async (label, value) => {
                h.preview.mockResolvedValue({ to_email: 'a@b.com', to_name: null, subject: 'Hello', body_html: '<p>Hi</p>', missing_fields: [] });
                await renderModal();
                typeOwn();
                fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
                await waitFor(() => expect(screen.getByTestId('email-preview')).toBeInTheDocument());
                fireEvent.change(screen.getByLabelText(label), { target: { value } });
                expect(screen.queryByTestId('email-preview')).toBeNull();
            },
        );

        it('Then switching template discards the stale preview', async () => {
            h.preview.mockResolvedValueOnce({ to_email: 'a@b.com', to_name: null, subject: 'S', body_html: '', missing_fields: [] });
            await renderModal();
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't1' } });
            fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
            await waitFor(() => expect(screen.getByTestId('email-preview')).toBeInTheDocument());
            fireEvent.change(screen.getByLabelText('Template'), { target: { value: 't2' } });
            expect(screen.queryByTestId('email-preview')).toBeNull();
        });
    });

    describe('When the preview fails without a usable message', () => {
        it.each([['a non-Error rejection', 'boom'], ['an Error with an empty message', new Error('')]])(
            'Then %s toasts the generic preview error',
            async (_label, err) => {
                h.preview.mockRejectedValueOnce(err);
                await renderModal();
                typeOwn();
                fireEvent.click(screen.getByRole('button', { name: /Preview/ }));
                await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Could not render the preview'));
                expect(screen.getByRole('button', { name: /Preview/ })).toBeEnabled();
            },
        );
    });

    describe('When a send is in flight', () => {
        it('Then both actions are disabled until it settles', async () => {
            const d = deferred<any>();
            h.send.mockReturnValueOnce(d.promise);
            const { onClose } = await renderModal();
            typeOwn();
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled());
            expect(screen.getByRole('button', { name: /Preview/ })).toBeDisabled();
            await act(async () => { d.resolve({ success: true }); });
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('When the send succeeds and no onSent callback was given', () => {
        it('Then it toasts success and closes', async () => {
            h.send.mockResolvedValueOnce({ success: true, conversation_id: null, message_id: null, tracking_id: null, activity_id: null });
            const { onClose } = await renderModal({ entityType: 'contact' });
            typeOwn();
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(successSpy).toHaveBeenCalledWith('Email sent'));
            expect(h.send).toHaveBeenCalledWith('contact', LEAD, { template_id: '', subject: 'Hello', body_html: '<p>Hi</p>', to_email: '' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('When the send succeeds with an onSent callback', () => {
        it('Then onSent fires before the modal closes', async () => {
            h.send.mockResolvedValueOnce({ success: true });
            const order: string[] = [];
            await renderModal({ onSent: () => order.push('sent'), onClose: () => order.push('close') });
            typeOwn();
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(order).toEqual(['sent', 'close']));
        });
    });

    describe('When the send is reported as not sent', () => {
        it('Then it toasts the failure, keeps the modal open and never calls onSent', async () => {
            h.send.mockResolvedValueOnce({ success: false });
            const onSent = vi.fn();
            const { onClose } = await renderModal({ onSent });
            typeOwn();
            fireEvent.click(screen.getByRole('button', { name: /Send/ }));
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Email was not sent'));
            expect(onSent).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
        });
    });

    describe('When the send fails without a usable message', () => {
        it.each([['a non-Error rejection', { status: 500 }], ['an Error with an empty message', new Error('')]])(
            'Then %s toasts the generic send error',
            async (_label, err) => {
                h.send.mockRejectedValueOnce(err);
                const { onClose } = await renderModal();
                typeOwn();
                fireEvent.click(screen.getByRole('button', { name: /Send/ }));
                await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Email could not be sent'));
                expect(onClose).not.toHaveBeenCalled();
            },
        );
    });

    describe('When the close button is clicked', () => {
        it('Then onClose is called and nothing is sent', async () => {
            const { onClose } = await renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(h.send).not.toHaveBeenCalled();
        });
    });
});
