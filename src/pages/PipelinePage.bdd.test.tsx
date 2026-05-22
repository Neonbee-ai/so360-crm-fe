import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetPipeline = vi.fn();
const mockUpdateDealStage = vi.fn();

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
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

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

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: vi.fn(), showSuccess: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/DealFilters', () => ({
  DealFilters: ({ filters, onChange }: any) => (
    <div data-testid="deal-filters">
      <button data-testid="apply-owner-filter" onClick={() => onChange({ owner_id: 'u1' })}>
        Filter by owner
      </button>
    </div>
  ),
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

beforeEach(() => {
  vi.clearAllMocks();
  kanbanProps = {};
  transitionModalProps = {};
  mockGetPipeline.mockResolvedValue(threeStages);
  mockUpdateDealStage.mockResolvedValue({});
});

describe('PipelinePage', () => {
  describe('Given pipeline data with three stages', () => {
    it('When the page loads / Then renders a column for each stage', async () => {
      render(<PipelinePage />);
      await waitFor(() => {
        expect(screen.getByTestId('stage-new')).toBeInTheDocument();
        expect(screen.getByTestId('stage-qualified')).toBeInTheDocument();
        expect(screen.getByTestId('stage-won')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then deal cards show their name and value', async () => {
      render(<PipelinePage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp - $5000')).toBeInTheDocument();
        expect(screen.getByText('Beta Inc - $12000')).toBeInTheDocument();
        expect(screen.getByText('Gamma LLC - $25000')).toBeInTheDocument();
      });
    });

    it('When a deal card is clicked / Then navigates to the deal detail page', async () => {
      const user = userEvent.setup();
      render(<PipelinePage />);
      await waitFor(() => expect(screen.getByTestId('deal-d1')).toBeInTheDocument());
      await user.click(screen.getByTestId('deal-d1'));
      expect(mockNavigate).toHaveBeenCalledWith('../deal/d1');
    });

    it('When a deal is dragged to a new stage / Then a confirmation modal appears', async () => {
      render(<PipelinePage />);
      await waitFor(() => expect(screen.getByTestId('kanban')).toBeInTheDocument());
      const deal = { id: 'd1', name: 'Acme Corp', value: 5000, current_flow_state: 'new', owner_id: 'u1' };
      kanbanProps.onStageChange(deal, 'qualified');
      await waitFor(() => {
        expect(screen.getByTestId('transition-modal')).toBeInTheDocument();
        expect(screen.getByText('Moving Acme Corp to Qualified')).toBeInTheDocument();
      });
    });

    it('When stage transition is confirmed / Then calls updateDealStage API', async () => {
      const user = userEvent.setup();
      render(<PipelinePage />);
      await waitFor(() => expect(screen.getByTestId('kanban')).toBeInTheDocument());
      const deal = { id: 'd1', name: 'Acme Corp', value: 5000, current_flow_state: 'new', owner_id: 'u1' };
      kanbanProps.onStageChange(deal, 'qualified');
      await waitFor(() => expect(screen.getByText('Confirm')).toBeInTheDocument());
      await user.click(screen.getByText('Confirm'));
      await waitFor(() => {
        expect(mockUpdateDealStage).toHaveBeenCalledWith('d1', 'qualified', 'reason text');
      });
    });
  });

  describe('Given the pipeline is loading', () => {
    it('When data has not yet resolved / Then shows a loading spinner', () => {
      mockGetPipeline.mockReturnValue(new Promise(() => {}));
      render(<PipelinePage />);
      expect(screen.getByText('Loading pipeline...')).toBeInTheDocument();
    });
  });

  describe('Given filter controls are visible', () => {
    it('When a filter is applied / Then re-fetches pipeline data with the filter', async () => {
      const user = userEvent.setup();
      render(<PipelinePage />);
      await waitFor(() => expect(screen.getByTestId('deal-filters')).toBeInTheDocument());
      await user.click(screen.getByTestId('apply-owner-filter'));
      await waitFor(() => {
        const lastCall = mockGetPipeline.mock.calls[mockGetPipeline.mock.calls.length - 1];
        expect(lastCall[0]).toEqual({ owner_id: 'u1' });
      });
    });
  });

  describe('Given an empty pipeline', () => {
    it('When no stages are returned / Then renders the kanban with zero stages', async () => {
      mockGetPipeline.mockResolvedValue({ stages: [] });
      render(<PipelinePage />);
      await waitFor(() => {
        expect(screen.getByTestId('kanban')).toBeInTheDocument();
      });
    });
  });
});
