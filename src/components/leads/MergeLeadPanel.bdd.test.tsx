import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from '@so360/design-system';
import type { Lead } from '../../types/crm';

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

describe('Given the merge panel search states', () => {
    const typeQuery = (value: string) =>
        fireEvent.change(screen.getByLabelText('Find the duplicate lead'), { target: { value } });

    describe('When a search is in flight', () => {
        it('Then "Searching…" shows until it settles', async () => {
            let resolveSearch: (v: unknown) => void = () => {};
            mocks.getLeads.mockReturnValueOnce(new Promise(r => { resolveSearch = r; }));
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            expect(await screen.findByText('Searching…')).toBeInTheDocument();
            expect(screen.queryByText('No other leads match.')).not.toBeInTheDocument();
            resolveSearch([other]);
            await screen.findByRole('option', { name: /Acme Inc/ });
            expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
        });
    });

    describe('When the search returns null or holes', () => {
        it('Then null means no matches', async () => {
            mocks.getLeads.mockResolvedValueOnce(null);
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            expect(await screen.findByText('No other leads match.')).toBeInTheDocument();
        });

        it('Then null entries are dropped from the results', async () => {
            mocks.getLeads.mockResolvedValueOnce([null, other]);
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            await screen.findByRole('option', { name: /Acme Inc/ });
            expect(screen.getAllByRole('option')).toHaveLength(1);
        });
    });

    describe('When results carry an email, only a phone, or neither', () => {
        it('Then the sub-line shows the email, else the phone, else nothing', async () => {
            const phoneOnly = { id: 'p', company_name: 'PhoneCo', first_name: 'P', last_name: 'Q', contact_email: '', phone: '555-0100' } as unknown as Lead;
            const bare = { id: 'b', company_name: 'BareCo', first_name: 'B', last_name: 'R', contact_email: null, phone: null } as unknown as Lead;
            mocks.getLeads.mockResolvedValueOnce([other, phoneOnly, bare]);
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('co');
            const options = await screen.findAllByRole('option');
            expect(options).toHaveLength(3);
            expect(options[0]).toHaveTextContent('al@acme.io');
            expect(options[1]).toHaveTextContent('555-0100');
            const bareSub = options[2].querySelectorAll('span')[1];
            expect(bareSub.textContent).toBe('');
        });
    });

    describe('When the query changes before the debounce fires', () => {
        it('Then only the latest query is searched', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('ac');
            typeQuery('acme');
            await screen.findByRole('option', { name: /Acme Inc/ });
            expect(mocks.getLeads).toHaveBeenCalledTimes(1);
            expect(mocks.getLeads).toHaveBeenCalledWith({ q: 'acme', take: 10 });
        });

        it('Then padding spaces are trimmed before searching', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('  acme  ');
            await screen.findByRole('option', { name: /Acme Inc/ });
            expect(mocks.getLeads).toHaveBeenCalledWith({ q: 'acme', take: 10 });
        });

        it('Then shrinking below 2 characters clears the results', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            await screen.findByRole('option', { name: /Acme Inc/ });
            typeQuery('a');
            await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
            expect(screen.queryByText('No other leads match.')).not.toBeInTheDocument();
        });
    });

    describe('When the panel unmounts with a search in flight', () => {
        it('Then a late result is ignored', async () => {
            let resolveSearch: (v: unknown) => void = () => {};
            mocks.getLeads.mockReturnValueOnce(new Promise(r => { resolveSearch = r; }));
            const { unmount } = render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            await waitFor(() => expect(mocks.getLeads).toHaveBeenCalled());
            unmount();
            resolveSearch([other]);
            await Promise.resolve();
            expect(screen.queryByRole('option')).not.toBeInTheDocument();
        });

        it('Then a late failure is ignored', async () => {
            let rejectSearch: (e: unknown) => void = () => {};
            mocks.getLeads.mockReturnValueOnce(new Promise((_, rej) => { rejectSearch = rej; }));
            const { unmount } = render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            await waitFor(() => expect(mocks.getLeads).toHaveBeenCalled());
            unmount();
            rejectSearch(new Error('late'));
            await Promise.resolve();
            expect(screen.queryByText('No other leads match.')).not.toBeInTheDocument();
        });

        it('Then unmounting before the debounce never searches', async () => {
            const { unmount } = render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            typeQuery('acme');
            unmount();
            await new Promise(r => setTimeout(r, 300));
            expect(mocks.getLeads).not.toHaveBeenCalled();
        });
    });
});

describe('Given a picked lead in the field chooser', () => {
    describe('When Change is tapped', () => {
        it('Then the search view returns and re-picking resets the field choices', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            await pickOther();
            fireEvent.click(screen.getByLabelText('Email from other lead'));
            expect(screen.getByLabelText('Email from other lead')).toBeChecked();
            fireEvent.click(screen.getByRole('button', { name: 'Change' }));
            expect(screen.queryByTestId('merge-field-chooser')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
            fireEvent.click(await screen.findByRole('option', { name: /Acme Inc/ }));
            expect(screen.getByLabelText('Email from this lead')).toBeChecked();
            expect(screen.getByLabelText('Email from other lead')).not.toBeChecked();
        });
    });

    describe('When a choice is flipped back to this lead', () => {
        it('Then the kept value is sent', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            await pickOther();
            fireEvent.click(screen.getByLabelText('Source from other lead'));
            fireEvent.click(screen.getByLabelText('Source from this lead'));
            fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
            await waitFor(() => expect(mocks.merge).toHaveBeenCalled());
            expect(mocks.merge.mock.calls[0][2].source).toBe('k');
        });
    });

    describe('When the header names the other lead', () => {
        it('Then the merging sentence uses its display name', async () => {
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            await pickOther();
            expect(screen.getByText(/into this lead\. It will be removed afterwards\./)).toBeInTheDocument();
        });
    });

    describe('When the merge is in flight', () => {
        it('Then Merge is disabled with a spinner, then re-enabled on failure', async () => {
            let rejectMerge: (e: unknown) => void = () => {};
            mocks.merge.mockReturnValueOnce(new Promise((_, rej) => { rejectMerge = rej; }));
            const error = vi.spyOn(toast, 'error');
            render(<MergeLeadPanel keepLead={keep} onClose={vi.fn()} onMerged={vi.fn()} />);
            await pickOther();
            const mergeBtn = screen.getByRole('button', { name: 'Merge' });
            fireEvent.click(mergeBtn);
            await waitFor(() => expect(mergeBtn).toBeDisabled());
            expect(mergeBtn.querySelector('[data-testid="icon-Loader2"]')).not.toBeNull();
            rejectMerge(new Error(''));
            await waitFor(() => expect(mergeBtn).not.toBeDisabled());
            expect(mergeBtn.querySelector('[data-testid="icon-Loader2"]')).toBeNull();
            expect(error).toHaveBeenCalledWith("We couldn't merge these leads. Please try again.");
        });
    });
});
