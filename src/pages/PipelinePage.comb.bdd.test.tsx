import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetPipeline = vi.fn();
const mockUpdateDealStage = vi.fn();
const mockEmitNotification = vi.fn();
const mockRecordActivity = vi.fn();

const mockExportDeals = vi.fn();
vi.mock('../services/exportService', async (importActual) => ({
  ...(await importActual<any>()),
  exportService: { deals: (...a: any[]) => mockExportDeals(...a) },
}));

vi.mock('../services/crmService', () => ({
  crmService: {
    getPipeline: (...a: any[]) => mockGetPipeline(...a),
    updateDealStage: (...a: any[]) => mockUpdateDealStage(...a),
    logActivity: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: mockEmitNotification }),
  useActivity: () => ({ recordActivity: mockRecordActivity }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

let kanbanProps: any = {};
vi.mock('../components/kanban/KanbanBoard', () => ({
  KanbanBoard: (props: any) => {
    kanbanProps = props;
    return (
      <div data-testid="kanban">
        {props.stages.map((s: any) => (
          <div key={s.id} data-testid={`stage-${s.id}`}>
            <span>{s.name}</span>
            {props.deals
              .filter((d: any) => d.current_flow_state === s.id)
              .map((d: any) => (
                <div key={d.id} data-testid={`deal-${d.id}`} onClick={() => props.onDealClick(d)}>
                  {d.name} - ${d.value}
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  },
}));

let transitionModalProps: any = {};
vi.mock('../components/kanban/StageTransitionModal', () => ({
  StageTransitionModal: (props: any) => {
    transitionModalProps = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="transition-modal">
        <span>Moving {props.deal?.name} to {props.newStage}</span>
        <button onClick={() => props.onConfirm('reason text')}>Confirm</button>
        <button onClick={props.onClose}>Cancel</button>
      </div>
    );
  },
}));

vi.mock('./components/DealFilters', () => ({
  useDealFilterConfig: (_filters: any, onChange: (f: any) => void) => ({
    fields: [{
      key: 'deal-filters', label: 'Deals', type: 'custom', quick: true,
      render: () => (
        <div data-testid="deal-filters">
          <button data-testid="apply-owner-filter" onClick={() => onChange({ owner_id: 'u1' })}>
            Filter by owner
          </button>
        </div>
      ),
    }],
    values: {}, onChange: () => undefined, onClear: () => undefined,
  }),
}));

import PipelinePage from './PipelinePage';

const threeStages = {
  stages: [
    { id: 'new', name: 'New Lead', color: '#3B82F6', is_terminal: false, deals: [
      { id: 'd1', name: 'Acme Corp', value: 5000, current_flow_state: 'new', owner_id: 'u1' },
      { id: 'd2', name: 'Beta Inc', value: 12000, current_flow_state: 'new', owner_id: 'u2' },
    ]},
    { id: 'qualified', name: 'Qualified', color: '#A855F7', is_terminal: false, deals: [
      { id: 'd3', name: 'Gamma LLC', value: 25000, current_flow_state: 'qualified', owner_id: 'u1' },
    ]},
    { id: 'won', name: 'Won', color: '#22C55E', is_terminal: true, deals: [] },
  ],
};

const fiveStages = {
  stages: [
    { id: 'new', name: 'New Lead', color: '#3B82F6', is_terminal: false, deals: [
      { id: 'd1', name: 'Acme Corp', value: 5000, current_flow_state: 'new', owner_id: 'u1' },
    ]},
    { id: 'qualified', name: 'Qualified', color: '#A855F7', is_terminal: false, deals: [] },
    { id: 'won',  name: 'Won',  color: '#22C55E', is_terminal: true, deals: [] },
    { id: 'lost', name: 'Lost', color: '#EF4444', is_terminal: true, deals: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  kanbanProps = {};
  transitionModalProps = {};
  mockGetPipeline.mockResolvedValue(threeStages);
  mockExportDeals.mockResolvedValue(undefined);
  mockUpdateDealStage.mockResolvedValue({});
  mockEmitNotification.mockResolvedValue(undefined);
  mockRecordActivity.mockResolvedValue(undefined);
});

const withStages = (stages: any[]) => mockGetPipeline.mockResolvedValue({ stages });
const stageColors = async () => {
  render(<PipelinePage />);
  await waitFor(() => expect(kanbanProps.stages?.length).toBeGreaterThan(0));
  return Object.fromEntries(kanbanProps.stages.map((s: any) => [s.id, s.color]));
};
const MUTED = 'rgb(var(--nb-fg-muted))';

describe('Feature: Pipeline stage colour token fallback', () => {
  describe('Scenario: own colour', () => {
    it('Given stages with colours When loaded Then each keeps its own colour', async () => {
      const c = await stageColors();
      expect(c).toEqual({ new: '#3B82F6', qualified: '#A855F7', won: '#22C55E' });
    });
    it('Given a CSS-named colour When loaded Then it is passed through unchanged', async () => {
      withStages([{ id: 'a', name: 'A', color: 'red', deals: [] }]);
      expect((await stageColors()).a).toBe('red');
    });
  });

  describe('Scenario: fallback token', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
    ])('Given a stage colour that is %s When loaded Then the muted token is used', async (_n, color) => {
      withStages([{ id: 'a', name: 'A', color, deals: [] }]);
      expect((await stageColors()).a).toBe(MUTED);
    });
    it('Given the colour key is absent When loaded Then the muted token is used', async () => {
      withStages([{ id: 'a', name: 'A', deals: [] }]);
      expect((await stageColors()).a).toBe(MUTED);
    });
    it('Given a mix When loaded Then only colourless stages fall back', async () => {
      withStages([
        { id: 'a', name: 'A', color: '#111111', deals: [] },
        { id: 'b', name: 'B', deals: [] },
        { id: 'c', name: 'C', color: '', deals: [] },
      ]);
      expect(await stageColors()).toEqual({ a: '#111111', b: MUTED, c: MUTED });
    });
    it('Given a fallback stage When loaded Then no hard-coded slate hex is used', async () => {
      withStages([{ id: 'a', name: 'A', deals: [] }]);
      const c = await stageColors();
      expect(c.a).not.toMatch(/#94A3B8|#64748B/i);
    });
  });

  describe('Scenario: other stage fields preserved', () => {
    it('Given a colourless terminal stage When loaded Then is_terminal and name are kept', async () => {
      withStages([{ id: 'w', name: 'Won', is_terminal: true, deals: [] }]);
      render(<PipelinePage />);
      await waitFor(() => expect(kanbanProps.stages?.length).toBe(1));
      expect(kanbanProps.stages[0]).toEqual({ id: 'w', name: 'Won', color: MUTED, is_terminal: true });
    });
    it('Given is_terminal is missing When loaded Then it defaults to false', async () => {
      withStages([{ id: 'w', name: 'W', deals: [] }]);
      render(<PipelinePage />);
      await waitFor(() => expect(kanbanProps.stages?.length).toBe(1));
      expect(kanbanProps.stages[0].is_terminal).toBe(false);
    });
  });

  describe('Scenario: empty / error', () => {
    it('Given no stages When loaded Then the board receives an empty stage list', async () => {
      withStages([]);
      render(<PipelinePage />);
      await waitFor(() => expect(mockGetPipeline).toHaveBeenCalled());
      expect(kanbanProps.stages ?? []).toEqual([]);
    });
    it('Given the API fails When loaded Then no stages are rendered and the page does not crash', async () => {
      mockGetPipeline.mockRejectedValue(new Error('down'));
      render(<PipelinePage />);
      await waitFor(() => expect(mockGetPipeline).toHaveBeenCalled());
      expect(kanbanProps.stages ?? []).toEqual([]);
    });
  });

  describe('Scenario: refetch on filter', () => {
    it('Given a colourless stage When a filter refetches Then the fallback persists', async () => {
      withStages([{ id: 'a', name: 'A', deals: [] }]);
      const user = userEvent.setup();
      render(<PipelinePage />);
      // Initial load is debounced (300ms); a filter applied before it fires coalesces into one fetch.
      await waitFor(() => expect(mockGetPipeline).toHaveBeenCalledTimes(1));
      await user.click(await screen.findByTestId('apply-owner-filter'));
      await waitFor(() => expect(mockGetPipeline).toHaveBeenCalledTimes(2));
      expect(kanbanProps.stages[0].color).toBe(MUTED);
    });
  });
});
