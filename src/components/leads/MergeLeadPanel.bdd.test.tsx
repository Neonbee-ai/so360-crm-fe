import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from '@so360/design-system';

const mocks = vi.hoisted(() => ({ getLeads: vi.fn(), merge: vi.fn() }));

vi.mock('../../services/crmService', () => ({
    crmService: { getLeads: (...a: any[]) => mocks.getLeads(...a) },
}));
vi.mock('../../services/leadDedupService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/leadDedupService')>();
    return { ...actual, leadDedupService: { mergeLeads: (...a: any[]) => mocks.merge(...a) } };
});

import { MergeLeadPanel } from './MergeLeadPanel';

const keep = { id: 'k', company_name: 'Acme', first_name: 'Al', last_name: 'K', contact_email: 'al@acme.com', phone: '1', source: 'web' } as any;
const other = { id: 'o', company_name: 'Acme Inc', first_name: 'Al', last_name: 'K', contact_email: 'al@acme.io', phone: '1', source: 'referral' } as any;

const pickOther = async () => {
    fireEvent.change(screen.getByLabelText('Find the duplicate lead'), { target: { value: 'acme' } });
    fireEvent.click(await screen.findByRole('option', { name: /Acme Inc/ }));
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLeads.mockResolvedValue([keep, other]);
    mocks.merge.mockResolvedValue({ id: 'k' });
});

describe('Given the merge panel for a kept lead', () => {
    describe('When nothing is picked yet', () => {
        it('Then Merge is disabled and fewer than 2 characters do not search', () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
            fireEvent.change(screen.getByLabelText('Find the duplicate lead'), { target: { value: 'a' } });
            expect(mocks.getLeads).not.toHaveBeenCalled();
        });
    });

    describe('When searching', () => {
        it('Then the kept lead is excluded from results', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            fireEvent.change(screen.getByLabelText('Find the duplicate lead'), { target: { value: 'acme' } });
            await screen.findByRole('option', { name: /Acme Inc/ });
            expect(mocks.getLeads).toHaveBeenCalledWith({ q: 'acme', take: 10 });
            expect(screen.getAllByRole('option')).toHaveLength(1);
        });
        it('Then a failed search shows no results instead of crashing', async () => {
            mocks.getLeads.mockRejectedValue(new Error('boom'));
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            fireEvent.change(screen.getByLabelText('Find the duplicate lead'), { target: { value: 'acme' } });
            expect(await screen.findByText('No other leads match.')).toBeInTheDocument();
        });
    });

    describe('When the other lead is picked', () => {
        it('Then fields are shown side by side, differing ones choosable, same ones locked', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            await pickOther();
            expect(screen.getByTestId('merge-field-chooser')).toBeInTheDocument();
            expect(screen.getByLabelText('Email from this lead')).toBeChecked();
            expect(screen.getByLabelText('Email from other lead')).not.toBeDisabled();
            expect(screen.getByLabelText('Phone from other lead')).toBeDisabled();
        });

        it('Then Merge sends the chosen field values and reports the absorbed id', async () => {
            const onMerged = vi.fn();
            const success = vi.spyOn(toast, 'success');
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={onMerged} />);
            await pickOther();
            fireEvent.click(screen.getByLabelText('Email from other lead'));
            fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
            await waitFor(() => expect(onMerged).toHaveBeenCalledWith('o'));
            const [keepId, mergeId, choices] = mocks.merge.mock.calls[0];
            expect([keepId, mergeId]).toEqual(['k', 'o']);
            expect(choices.contact_email).toBe('o');
            expect(choices.company_name).toBe('k');
            expect(success).toHaveBeenCalled();
        });

        it('Then a rejected merge shows the backend reason and keeps the panel open', async () => {
            const onMerged = vi.fn();
            const error = vi.spyOn(toast, 'error');
            mocks.merge.mockRejectedValue(Object.assign(new Error('Lead is already merged'), { status: 409 }));
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={onMerged} />);
            await pickOther();
            fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
            await waitFor(() => expect(error).toHaveBeenCalledWith('Lead is already merged'));
            expect(onMerged).not.toHaveBeenCalled();
            expect(screen.getByTestId('merge-lead-panel')).toBeInTheDocument();
        });
    });

    describe('When Cancel or close is tapped', () => {
        it('Then onClose is called', () => {
            const onClose = vi.fn();
            render(<MergeLeadPanel keepLead={keep} onClose={onClose} onMerged={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close merge panel' }));
            expect(onClose).toHaveBeenCalledTimes(2);
        });
    });
});
