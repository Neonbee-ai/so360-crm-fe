import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// Phase 5 perf: the 60s pipeline auto-refresh must skip the heavy getPipeline
// refetch while the browser tab is hidden, and resume when it becomes visible.
const mockGetPipeline = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getPipeline: (...a: any[]) => mockGetPipeline(...a),
    updateDealStage: vi.fn(),
    logActivity: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn() }),
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

vi.mock('../components/kanban/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="kanban" />,
}));

vi.mock('../components/kanban/StageTransitionModal', () => ({
  StageTransitionModal: () => null,
}));

vi.mock('./components/DealFilters', () => ({
  DealFilters: () => <div data-testid="deal-filters" />,
}));

import PipelinePage from './PipelinePage';

const stages = { stages: [{ id: 'new', name: 'New', color: '#3B82F6', is_terminal: false, deals: [] }] };

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

// Advance fake timers with the *Async* variant so microtasks (the awaited
// getPipeline promise + the React state updates it triggers) flush between
// ticks. Using waitFor/findBy here would hang: those poll on real time, which
// never advances while fake timers are installed.
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// The debounced fetch effect uses a 300ms setTimeout; the poll uses a 60s
// setInterval. The poll callback reads document.visibilityState directly and
// only bumps pollTick (which re-triggers the debounced fetch) when visible.
describe('PipelinePage — poll visibility gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPipeline.mockResolvedValue(stages);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('Given the tab is visible / When 60s elapses / Then getPipeline refetches', async () => {
    setVisibility('visible');
    await act(async () => {
      render(<PipelinePage />);
    });
    // Flush the initial debounced fetch (300ms).
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(1);

    // One poll tick fires while visible → bumps pollTick → debounced refetch.
    await advance(60 * 1000);
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(2);
  });

  it('Given the tab is hidden / When 60s elapses / Then getPipeline does NOT refetch', async () => {
    setVisibility('visible');
    await act(async () => {
      render(<PipelinePage />);
    });
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(1);

    // Hide the tab, then let a full poll interval pass — no extra fetch.
    setVisibility('hidden');
    await advance(60 * 1000);
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(1);
  });

  it('Given the tab was hidden then becomes visible / When the next tick fires / Then getPipeline refetches', async () => {
    setVisibility('visible');
    await act(async () => {
      render(<PipelinePage />);
    });
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(1);

    // Hidden tick → skipped.
    setVisibility('hidden');
    await advance(60 * 1000);
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(1);

    // Visible again → next tick resumes the refetch.
    setVisibility('visible');
    await advance(60 * 1000);
    await advance(300);
    expect(mockGetPipeline).toHaveBeenCalledTimes(2);
  });
});
