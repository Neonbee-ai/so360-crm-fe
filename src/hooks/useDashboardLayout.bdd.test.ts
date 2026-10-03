import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const grid = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
vi.mock('../services/crmService', () => ({ crmService: { gridColumns: grid } }));

import { useDashboardLayout, DASHBOARD_LAYOUT_ENTITY, DASHBOARD_LAYOUT_SAVE_DELAY_MS } from './useDashboardLayout';
import { DEFAULT_LAYOUT } from '../utils/dashboardLayout';

/**
 * Feature: per-user dashboard layout persistence (RE §31). The layout lives
 * in the existing per-user grid-prefs store, which the server scopes to the
 * signed-in user's tenant / org / user — the hook never sends those ids.
 */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
    vi.useFakeTimers();
    grid.get.mockReset();
    grid.save.mockReset();
    grid.reset.mockReset();
    grid.get.mockResolvedValue(null);
    grid.save.mockResolvedValue(undefined);
    grid.reset.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Feature: useDashboardLayout', () => {
    describe('Given customization is disabled (flag off)', () => {
        it('then nothing is fetched and the default layout is returned', async () => {
            const { result } = renderHook(() => useDashboardLayout(false));
            await flush();
            expect(grid.get).not.toHaveBeenCalled();
            expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
        });

        it('then changes are not applied to the rendered layout', async () => {
            const { result } = renderHook(() => useDashboardLayout(false));
            act(() => { result.current.toggle('kpis'); });
            expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
        });
    });

    describe('Given a saved layout exists', () => {
        it('then it is loaded from the dashboard layout entity and normalised', async () => {
            grid.get.mockResolvedValue({ prefs: { order: ['revenue', 'bogus'], hidden: ['kpis'] } });
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            expect(grid.get).toHaveBeenCalledWith(DASHBOARD_LAYOUT_ENTITY);
            expect(grid.get.mock.calls[0]).toHaveLength(1);
            expect(result.current.layout.order[0]).toBe('revenue');
            expect(result.current.layout.hidden).toEqual(['kpis']);
            expect(grid.save).not.toHaveBeenCalled();
        });
    });

    describe('Given the store cannot be reached', () => {
        it('then the default layout is kept and nothing throws', async () => {
            grid.get.mockRejectedValue(new Error('offline'));
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
        });

        it('then a failing save still keeps the change for this session', async () => {
            grid.save.mockRejectedValue(new Error('offline'));
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.toggle('revenue'); });
            await act(async () => { vi.advanceTimersByTime(DASHBOARD_LAYOUT_SAVE_DELAY_MS); });
            await flush();
            expect(grid.save).toHaveBeenCalledTimes(1);
            expect(result.current.layout.hidden).toEqual(['revenue']);
        });
    });

    describe('When the user hides and reorders widgets', () => {
        it('then one debounced save carries the final order and hidden list', async () => {
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.toggle('revenue'); });
            act(() => { result.current.move('kpis', 'down'); });
            expect(grid.save).not.toHaveBeenCalled();
            await act(async () => { vi.advanceTimersByTime(DASHBOARD_LAYOUT_SAVE_DELAY_MS); });
            expect(grid.save).toHaveBeenCalledTimes(1);
            expect(grid.save).toHaveBeenCalledWith(
                { order: ['commerce', 'kpis', 're_widgets', 'reminders', 'revenue', 'performance'], hidden: ['revenue'] },
                DASHBOARD_LAYOUT_ENTITY,
            );
        });

        it('then a no-op move does not schedule a save', async () => {
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.move('kpis', 'up'); });
            await act(async () => { vi.advanceTimersByTime(DASHBOARD_LAYOUT_SAVE_DELAY_MS * 2); });
            expect(grid.save).not.toHaveBeenCalled();
        });

        it('then a late hydration does not override the user change', async () => {
            let resolve: (v: unknown) => void = () => {};
            grid.get.mockReturnValue(new Promise((r) => { resolve = r; }));
            const { result } = renderHook(() => useDashboardLayout(true));
            act(() => { result.current.toggle('kpis'); });
            await act(async () => { resolve({ prefs: { order: [], hidden: ['revenue'] } }); });
            await flush();
            expect(result.current.layout.hidden).toEqual(['kpis']);
        });

        it('then a pending save is flushed when the dashboard unmounts', async () => {
            const { result, unmount } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.toggle('commerce'); });
            unmount();
            await flush();
            expect(grid.save).toHaveBeenCalledWith(expect.objectContaining({ hidden: ['commerce'] }), DASHBOARD_LAYOUT_ENTITY);
        });
    });

    describe('When the user resets the layout', () => {
        it('then the default is restored, the stored preference is cleared and no pending save fires', async () => {
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.toggle('kpis'); });
            await act(async () => { await result.current.reset(); });
            await act(async () => { vi.advanceTimersByTime(DASHBOARD_LAYOUT_SAVE_DELAY_MS); });
            expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
            expect(grid.reset).toHaveBeenCalledWith(DASHBOARD_LAYOUT_ENTITY);
            expect(grid.save).not.toHaveBeenCalled();
        });

        it('then a failing reset still restores the default locally', async () => {
            grid.reset.mockRejectedValue(new Error('offline'));
            const { result } = renderHook(() => useDashboardLayout(true));
            await flush();
            act(() => { result.current.toggle('kpis'); });
            await act(async () => { await result.current.reset(); });
            expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
        });
    });
});
