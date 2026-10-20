import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ getSettings: vi.fn(), putSettings: vi.fn() }));
vi.mock('../../../services/salesConfigService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/salesConfigService')>();
    return { ...actual, ratingService: svc };
});

import { toast } from '@so360/design-system';
import RatingMilestonesCard from './RatingMilestonesCard';

const cats: any[] = [{ id: 'hot', label: 'Hot', min_score: 50, max_score: null, color_token: 'danger', is_active: true }];

beforeEach(() => {
    vi.restoreAllMocks();
    svc.getSettings.mockReset(); svc.putSettings.mockReset();
});

describe('Given the rating mode card', () => {
    describe('When the org rates by score', () => {
        it('Then no milestone rules are shown', async () => {
            svc.getSettings.mockResolvedValue({ mode: 'score', rules: [] });
            render(<RatingMilestonesCard canWrite categories={cats} />);
            await waitFor(() => expect(svc.getSettings).toHaveBeenCalled());
            expect(screen.queryByTestId('milestone-rules-empty')).toBeNull();
        });
    });
    describe('When the org rates by milestone and has a rule', () => {
        it('Then the rule reads milestone then rating, and removing saves the rest', async () => {
            svc.getSettings.mockResolvedValue({ mode: 'milestone', rules: [{ milestone: 'quote_sent', stage_key: '', rating_category_id: 'hot', is_active: true }] });
            svc.putSettings.mockResolvedValue({ mode: 'milestone', rules: [] });
            render(<RatingMilestonesCard canWrite categories={cats} />);
            expect(await screen.findByText(/Quote sent then Hot/)).toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('Remove Quote sent rule'));
            await waitFor(() => expect(svc.putSettings).toHaveBeenCalledWith({ mode: 'milestone', rules: [] }));
        });
    });
    describe('When a rule is added without choosing a rating', () => {
        it('Then it is refused and nothing is saved', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.getSettings.mockResolvedValue({ mode: 'milestone', rules: [] });
            render(<RatingMilestonesCard canWrite categories={cats} />);
            await screen.findByTestId('milestone-rules-empty');
            fireEvent.click(screen.getByText(/Add rule/));
            expect(err).toHaveBeenCalledWith('Choose the rating to give.');
            expect(svc.putSettings).not.toHaveBeenCalled();
        });
    });
    describe('When the load fails', () => {
        it('Then an error toast shows', async () => {
            const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
            svc.getSettings.mockRejectedValue(new Error('x'));
            render(<RatingMilestonesCard canWrite categories={cats} />);
            await waitFor(() => expect(err).toHaveBeenCalled());
        });
    });
});
