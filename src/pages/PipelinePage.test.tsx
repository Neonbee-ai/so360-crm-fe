import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@so360/shell-context', () => ({
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
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

import PipelinePage from './PipelinePage';

beforeEach(() => {
  vi.clearAllMocks();
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
});
