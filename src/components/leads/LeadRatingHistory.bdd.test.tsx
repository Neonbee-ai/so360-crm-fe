import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('../../services/salesConfigService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/salesConfigService')>();
    return { ...actual, ratingService: svc };
});
vi.mock('../../utils/formatters', () => ({ useCRMFormatters: () => ({ formatDateTime: (d: string) => d }) }));

import LeadRatingHistory, { describeRatingChange } from './LeadRatingHistory';

const cats = [{ id: 'hot', label: 'Hot' }, { id: 'warm', label: 'Warm' }];
const base = { lead_id: 'l1', from_category_id: null, actor_user_id: null, note: null, created_at: '2026-10-01', milestone: null };
beforeEach(() => { svc.history.mockReset(); });

describe('Given the rating history card', () => {
    it('When there is no history Then nothing renders', async () => {
        svc.history.mockResolvedValue([]);
        const { container } = render(<LeadRatingHistory leadId="l1" categories={cats} />);
        await waitFor(() => expect(svc.history).toHaveBeenCalledWith('l1'));
        expect(container.firstChild).toBeNull();
    });
    it('When entries exist Then each reads who/what and the milestone note shows', async () => {
        svc.history.mockResolvedValue([{ ...base, id: '1', source: 'milestone', milestone: 'quote_sent', to_category_id: 'hot', note: 'Quote Q1' }]);
        render(<LeadRatingHistory leadId="l1" categories={cats} />);
        expect(await screen.findByText(/Quote sent: rating moved to Hot \(Quote Q1\)/)).toBeInTheDocument();
    });
    it('When the load fails Then nothing renders', async () => {
        svc.history.mockRejectedValue(new Error('x'));
        const { container } = render(<LeadRatingHistory leadId="l1" categories={cats} />);
        await waitFor(() => expect(svc.history).toHaveBeenCalled());
        expect(container.firstChild).toBeNull();
    });
});

describe('describeRatingChange', () => {
    const l = (id: string | null) => (id === 'hot' ? 'Hot' : 'no rating');
    it.each([
        ['manual', 'Rating set by hand to Hot'],
        ['cleared', 'Manual rating cleared, now Hot'],
        ['score', 'Score changed the rating to Hot'],
        ['milestone', 'Milestone: rating moved to Hot'],
    ])('Given source %s Then "%s"', (source, text) => {
        expect(describeRatingChange({ ...base, id: 'x', source: source as any, to_category_id: 'hot' }, l)).toBe(text);
    });
});
