import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// Perf: a superseded pipeline request is aborted, and the signal reaches getPipeline.
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
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

vi.mock('../components/kanban/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="kanban" />,
}));

vi.mock('../components/kanban/StageTransitionModal', () => ({
  StageTransitionModal: () => null,
}));

vi.mock('./components/DealFilters', () => ({
  useDealFilterConfig: () => ({
    fields: [{ key: 'deal-filters', label: 'Deals', type: 'custom', quick: true, render: () => <div data-testid="deal-filters" /> }],
    values: {}, onChange: () => undefined, onClear: () => undefined,
  }),
}));

import PipelinePage from './PipelinePage';

const stages = { stages: [{ id: 'new', name: 'New', color: '#3B82F6', is_terminal: false, deals: [] }] };

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('PipelinePage — in-flight abort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Given a fetch is in flight / When the next poll tick refetches / Then the first request signal is aborted', async () => {
    const signals: AbortSignal[] = [];
    mockGetPipeline.mockImplementation((_f: any, signal: AbortSignal) => {
      signals.push(signal);
      // Never resolves on its own: stays in flight.
      return new Promise(() => undefined);
    });
    await act(async () => { render(<PipelinePage />); });
    await advance(300);
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    await advance(60 * 1000);
    await advance(300);
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('Given a fetch is in flight / When the page unmounts / Then the request signal is aborted', async () => {
    let signal: AbortSignal | undefined;
    mockGetPipeline.mockImplementation((_f: any, s: AbortSignal) => { signal = s; return new Promise(() => undefined); });
    let utils: ReturnType<typeof render>;
    await act(async () => { utils = render(<PipelinePage />); });
    await advance(300);
    utils!.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('Given a request was aborted and rejects / When it settles / Then no error toast path runs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let reject: (e: any) => void = () => undefined;
    mockGetPipeline.mockImplementationOnce((_f: any, s: AbortSignal) => new Promise((_r, rej) => { reject = rej; s.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); }));
    mockGetPipeline.mockResolvedValue({ stages: [] });
    await act(async () => { render(<PipelinePage />); });
    await advance(300);
    await advance(60 * 1000);
    await advance(300);
    expect(err.mock.calls.some((c) => String(c[0]).includes('Failed to fetch pipeline data'))).toBe(false);
    void reject;
    err.mockRestore();
  });
});
