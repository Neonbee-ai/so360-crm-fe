import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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

const mockShellBridge = vi.fn();

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => mockShellBridge(),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

vi.mock('../components/kanban/KanbanBoard', () => ({
  KanbanBoard: ({ deals, stages }: any) => <div data-testid="kanban">{stages.length} stages, {deals.length} deals</div>,
}));

vi.mock('../components/kanban/StageTransitionModal', () => ({
  StageTransitionModal: () => null,
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: vi.fn(), showSuccess: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/DealFilters', () => ({
  DealFilters: () => <div data-testid="deal-filters" />,
}));

vi.mock('./components/CreateDealModal', () => ({
  default: ({ onClose }: any) => (
    <div data-testid="create-deal-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import PipelinePage from './PipelinePage';

const ENABLED_SHELL = {
  effectiveFlagsLoaded: true,
  isFeatureEnabled: (flag: string) => flag === 'action:crm:deals:create',
};

const DISABLED_SHELL = {
  effectiveFlagsLoaded: true,
  isFeatureEnabled: () => false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockShellBridge.mockReturnValue(ENABLED_SHELL);
  mockGetPipeline.mockResolvedValue({
    stages: [
      { id: 's1', name: 'Lead', color: '#aaa', is_terminal: false, deals: [{ id: 'd1', name: 'Deal 1', value: 1000 }] },
      { id: 's2', name: 'Won', color: '#0f0', is_terminal: true, deals: [] },
    ],
  });
});

describe('Given PipelinePage', () => {
  it('When action / Then shows loading state initially', () => {
    mockGetPipeline.mockReturnValue(new Promise(() => {}));
    render(<PipelinePage />);
    expect(screen.getByText('Loading pipeline...')).toBeInTheDocument();
  });

  it('When action / Then renders pipeline header and kanban', async () => {
    render(<PipelinePage />);
    await waitFor(() => {
      expect(screen.getByText('Deals Pipeline')).toBeInTheDocument();
      expect(screen.getByTestId('kanban')).toHaveTextContent('2 stages, 1 deals');
    });
  });

  it('When action:crm:deals:create is enabled / Then New Deal button is visible', async () => {
    render(<PipelinePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new deal/i })).toBeInTheDocument();
    });
  });

  it('When New Deal button clicked / Then CreateDealModal opens', async () => {
    render(<PipelinePage />);
    await waitFor(() => screen.getByRole('button', { name: /new deal/i }));
    fireEvent.click(screen.getByRole('button', { name: /new deal/i }));
    expect(screen.getByTestId('create-deal-modal')).toBeInTheDocument();
  });

  it('When modal is closed / Then CreateDealModal is removed', async () => {
    render(<PipelinePage />);
    await waitFor(() => screen.getByRole('button', { name: /new deal/i }));
    fireEvent.click(screen.getByRole('button', { name: /new deal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('create-deal-modal')).not.toBeInTheDocument();
  });

  it('When action:crm:deals:create is disabled / Then New Deal button is hidden', async () => {
    mockShellBridge.mockReturnValue(DISABLED_SHELL);
    render(<PipelinePage />);
    await waitFor(() => screen.getByTestId('kanban'));
    expect(screen.queryByRole('button', { name: /new deal/i })).not.toBeInTheDocument();
  });

  it('When flags not loaded yet / Then New Deal button is visible (default allow)', async () => {
    mockShellBridge.mockReturnValue({ effectiveFlagsLoaded: false, isFeatureEnabled: () => false });
    render(<PipelinePage />);
    await waitFor(() => screen.getByTestId('kanban'));
    expect(screen.getByRole('button', { name: /new deal/i })).toBeInTheDocument();
  });

  it('When getPipeline fails / Then shows error and empty board', async () => {
    mockGetPipeline.mockRejectedValue(new Error('Network error'));
    render(<PipelinePage />);
    await waitFor(() => screen.getByTestId('kanban'));
    expect(screen.getByTestId('kanban')).toHaveTextContent('0 stages');
  });
});
