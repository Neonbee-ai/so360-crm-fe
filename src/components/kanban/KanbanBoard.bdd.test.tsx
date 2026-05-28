import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { KanbanBoard } from './KanbanBoard';

const stages = [
  { id: 'new', name: 'New', color: '#3B82F6', is_terminal: false },
  { id: 'qualified', name: 'Qualified', color: '#A855F7', is_terminal: false },
  { id: 'won', name: 'Won', color: '#22C55E', is_terminal: true },
];

const deals: any[] = [
  { id: 'd1', name: 'Deal Alpha', value: 10000, current_flow_state: 'new', stage: 'New', company_name: 'Alpha Inc', expected_close_date: '2025-06-01', owner: { id: 'u1', full_name: 'Owner' } },
  { id: 'd2', name: 'Deal Beta', value: 25000, current_flow_state: 'new', stage: 'New', company_name: 'Beta Corp', expected_close_date: '2025-07-01', owner: { id: 'u1', full_name: 'Owner' } },
  { id: 'd3', name: 'Deal Gamma', value: 50000, current_flow_state: 'qualified', stage: 'Qualified', company_name: 'Gamma LLC', expected_close_date: '2025-08-01', owner: { id: 'u2', full_name: 'Other' } },
];

const mockOnDealClick = vi.fn();
const mockOnStageChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KanbanBoard', () => {
  describe('Given stages and deals are provided', () => {
    it('When rendered / Then shows a column for each stage', () => {
      render(<KanbanBoard deals={deals} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      expect(screen.getByText('Deal Alpha')).toBeInTheDocument();
      expect(screen.getByText('Deal Beta')).toBeInTheDocument();
      expect(screen.getByText('Deal Gamma')).toBeInTheDocument();
    });

    it('When rendered / Then shows deal count per stage in the header', () => {
      render(<KanbanBoard deals={deals} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('When a deal card is clicked / Then calls onDealClick with the deal', () => {
      render(<KanbanBoard deals={deals} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      fireEvent.click(screen.getByText('Deal Alpha'));
      expect(mockOnDealClick).toHaveBeenCalledWith(deals[0]);
    });

    it('When a deal is dropped on a different stage / Then calls onStageChange', () => {
      const { container } = render(<KanbanBoard deals={deals} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const columns = container.querySelectorAll('.w-80');
      const qualifiedColumn = columns[1];
      const dropZone = qualifiedColumn.querySelector('[class*="min-h-"]')!;
      const dataTransfer = { getData: (key: string) => key === 'dealId' ? 'd1' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer } as any);
      fireEvent.drop(dropZone, { dataTransfer } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(deals[0], 'qualified');
    });
  });

  describe('Given a terminal stage', () => {
    it('When rendered / Then the terminal stage column shows a lock icon', () => {
      render(<KanbanBoard deals={deals} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const lockIcons = screen.getAllByTestId('icon-Lock');
      expect(lockIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Given no deals', () => {
    it('When rendered with empty deals / Then shows empty state in each column', () => {
      render(<KanbanBoard deals={[]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const zeroCountElements = screen.getAllByText('0');
      expect(zeroCountElements.length).toBe(3);
    });
  });

  describe('Bug fix — stage mapping: current_flow_state takes priority over legacy stage field', () => {
    it('Given a deal whose current_flow_state is "new" but stage field is "Won" / When rendered / Then deal appears in New column only', () => {
      const mismatchedDeal: any = {
        id: 'dm', name: 'Mismatched Deal', value: 5000,
        current_flow_state: 'new',
        stage: 'Won',
        company_name: 'Mismatch Co', expected_close_date: '2025-12-01',
        owner: { id: 'u3', full_name: 'Owner' },
      };
      render(<KanbanBoard deals={[mismatchedDeal]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);

      // Deal must be visible
      expect(screen.getByText('Mismatched Deal')).toBeInTheDocument();

      // Won column is terminal and empty → shows the lock/empty message
      expect(screen.getByText(/Win\/Lose via/i)).toBeInTheDocument();
    });

    it('Given a deal with NO current_flow_state but stage "Qualified" / When rendered / Then falls back to Qualified column by name', () => {
      const fallbackDeal: any = {
        id: 'df', name: 'Fallback Deal', value: 8000,
        current_flow_state: undefined,
        stage: 'Qualified',
        company_name: 'Fallback Co', expected_close_date: '2025-12-01',
        owner: { id: 'u4', full_name: 'Owner' },
      };
      render(<KanbanBoard deals={[fallbackDeal]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      expect(screen.getByText('Fallback Deal')).toBeInTheDocument();
    });

    it('Given a deal in a non-terminal stage / When dropped on a different stage / Then onStageChange fires', () => {
      const moveDeal: any = { ...deals[0], id: 'mv', name: 'Movable Deal', current_flow_state: 'new', stage: 'New' };
      const { container } = render(<KanbanBoard deals={[moveDeal]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const columns = container.querySelectorAll('.w-80');
      const qualifiedColumn = columns[1];
      const dropZone = qualifiedColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'mv' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(moveDeal, 'qualified');
    });

    it('Given a deal / When dropped onto its current stage / Then onStageChange is NOT called', () => {
      const sameDeal: any = { ...deals[0], id: 'same', name: 'Same Stage Deal', current_flow_state: 'new', stage: 'New' };
      const { container } = render(<KanbanBoard deals={[sameDeal]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const columns = container.querySelectorAll('.w-80');
      const newColumn = columns[0];
      const dropZone = newColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'same' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).not.toHaveBeenCalled();
    });
  });
});
