import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({
    loss: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    rating: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), getSettings: vi.fn(), putSettings: vi.fn() },
    dup: { get: vi.fn(), put: vi.fn() },
}));
vi.mock('../../../services/salesConfigService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/salesConfigService')>();
    return { ...actual, lossReasonsService: svc.loss, ratingService: svc.rating, duplicateRulesService: svc.dup };
});

import { toast } from '@so360/design-system';
import LossReasonsSettingsTab from './LossReasonsSettingsTab';
import LeadRatingSettingsTab from './LeadRatingSettingsTab';
import DuplicateRulesSettingsTab, { withAllFields } from './DuplicateRulesSettingsTab';

beforeEach(() => {
    vi.restoreAllMocks();
    [svc.loss, svc.rating, svc.dup].forEach((s) => Object.values(s).forEach((f) => f.mockReset()));
    svc.loss.list.mockResolvedValue([]);
    svc.rating.list.mockResolvedValue([]);
    svc.rating.getSettings.mockResolvedValue({ mode: 'score', rules: [] });
    svc.dup.get.mockResolvedValue([]);
});

describe('Given the loss reasons tab', () => {
    describe('When there are none', () => {
        it('Then it explains the free-text fallback', async () => {
            render(<LossReasonsSettingsTab canWrite />);
            expect(await screen.findByTestId('loss-reasons-empty')).toBeInTheDocument();
        });
    });
    describe('When a reason is added', () => {
        it('Then it posts the label and competitor flag, and rejects a blank label', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.loss.create.mockResolvedValue({});
            render(<LossReasonsSettingsTab canWrite />);
            await screen.findByTestId('loss-reasons-empty');
            fireEvent.click(screen.getByRole('button', { name: /add/i }));
            expect(err).toHaveBeenCalledWith('Give the reason a name.');
            fireEvent.change(screen.getByLabelText('New reason'), { target: { value: ' Price ' } });
            fireEvent.click(screen.getByLabelText(/ask for the competitor/i));
            fireEvent.click(screen.getByRole('button', { name: /add/i }));
            await waitFor(() => expect(svc.loss.create).toHaveBeenCalledWith({ label: 'Price', requires_competitor: true }));
        });
    });
    describe('When a row is toggled', () => {
        it('Then it patches the row; read-only hides write controls', async () => {
            svc.loss.list.mockResolvedValue([{ id: 'a', label: 'Price', is_active: true, requires_competitor: false }]);
            svc.loss.update.mockResolvedValue({});
            const { unmount } = render(<LossReasonsSettingsTab canWrite />);
            await screen.findByTestId('loss-reason-a');
            fireEvent.click(screen.getByLabelText('Active'));
            await waitFor(() => expect(svc.loss.update).toHaveBeenCalledWith('a', { is_active: false }));
            unmount();
            render(<LossReasonsSettingsTab canWrite={false} />);
            await screen.findByTestId('loss-reason-a');
            expect(screen.queryByLabelText('Delete Price')).toBeNull();
            expect(screen.queryByLabelText('New reason')).toBeNull();
        });
    });
    describe('When the list fails to load', () => {
        it('Then an error toast shows', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.loss.list.mockRejectedValue(new Error('boom'));
            render(<LossReasonsSettingsTab canWrite />);
            await waitFor(() => expect(err).toHaveBeenCalled());
        });
    });
});

describe('Given the lead rating tab', () => {
    describe('When a rating is added', () => {
        it('Then it validates then posts label, band and colour', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.rating.create.mockResolvedValue({});
            render(<LeadRatingSettingsTab canWrite />);
            await screen.findByTestId('lead-rating-empty');
            fireEvent.click(screen.getByRole('button', { name: /add/i }));
            expect(err).toHaveBeenCalledWith('Give the rating a name.');
            fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Hot' } });
            fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'danger' } });
            fireEvent.click(screen.getByRole('button', { name: /add/i }));
            await waitFor(() => expect(svc.rating.create).toHaveBeenCalledWith({ label: 'Hot', min_score: 0, max_score: null, color_token: 'danger' }));
        });
    });
    describe('When ratings exist', () => {
        it('Then they list with their band and can be deactivated', async () => {
            svc.rating.list.mockResolvedValue([{ id: 'r', label: 'Warm', min_score: 31, max_score: 60, color_token: 'warning', is_active: true }]);
            svc.rating.update.mockResolvedValue({});
            render(<LeadRatingSettingsTab canWrite />);
            expect(await screen.findByText('31 to 60')).toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('Active'));
            await waitFor(() => expect(svc.rating.update).toHaveBeenCalledWith('r', { is_active: false }));
        });
    });
});

describe('Given the duplicate rules tab', () => {
    describe('When the server has no rows', () => {
        it('Then all three fields show and withAllFields fills defaults', async () => {
            render(<DuplicateRulesSettingsTab canWrite />);
            await waitFor(() => expect(svc.dup.get).toHaveBeenCalled());
            ['email', 'phone', 'company_name'].forEach((f) => expect(screen.getByTestId(`dup-rule-${f}`)).toBeInTheDocument());
            expect(withAllFields([{ field: 'phone', action: 'block', is_active: true }]).map((r) => r.field)).toEqual(['email', 'phone', 'company_name']);
        });
    });
    describe('When a rule is switched on and saved', () => {
        it('Then put receives all three rules', async () => {
            svc.dup.put.mockResolvedValue([]);
            render(<DuplicateRulesSettingsTab canWrite />);
            await waitFor(() => expect(svc.dup.get).toHaveBeenCalled());
            fireEvent.click(screen.getAllByLabelText('Check')[1]);
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            await waitFor(() => expect(svc.dup.put).toHaveBeenCalled());
            const sent = svc.dup.put.mock.calls[0][0];
            expect(sent).toHaveLength(3);
            expect(sent.find((r: any) => r.field === 'phone').is_active).toBe(true);
        });
    });
    describe('When save fails or the user is read-only', () => {
        it('Then an error toast shows, and no Save button for read-only', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.dup.put.mockRejectedValue(new Error('no'));
            const { unmount } = render(<DuplicateRulesSettingsTab canWrite />);
            await waitFor(() => expect(svc.dup.get).toHaveBeenCalled());
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            await waitFor(() => expect(err).toHaveBeenCalled());
            unmount();
            render(<DuplicateRulesSettingsTab canWrite={false} />);
            expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        });
    });
});
