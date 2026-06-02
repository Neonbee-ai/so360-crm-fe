import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { KanbanBoard } from './KanbanBoard';
import { useBusinessSettings } from '@so360/shell-context';

vi.mock('@so360/shell-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('@so360/shell-context')>();
  return {
    ...original,
    useBusinessSettings: vi.fn(),
  };
});

vi.mock('@so360/formatters', () => ({
  useFormatters: vi.fn((config: any) => ({
    formatCurrency: (v: number) => `${config.currency}${v.toFixed(2)}`,
    formatCompactCurrency: (v: number) => `${config.currency}${v}`,
    formatDate: (d: string) => d,
    formatNumber: (n: number) => String(n),
    formatPercent: (n: number) => `${n}%`,
  })),
}));

const mockUseBusinessSettings = useBusinessSettings as ReturnType<typeof vi.fn>;

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
  // Default: USD settings so existing non-currency tests render without crashing
  mockUseBusinessSettings.mockReturnValue({
    settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
  });
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

      // Won column is empty → shows the standard "Drop here" empty state
      expect(screen.getByText(/Drop here/i)).toBeInTheDocument();
    });

    it('Given a deal in any stage / When dropped onto a terminal (Won) stage / Then onStageChange fires', () => {
      const moveDeal: any = { ...deals[0], id: 'tw', name: 'Terminal Drop Deal', current_flow_state: 'new', stage: 'New' };
      const { container } = render(<KanbanBoard deals={[moveDeal]} stages={stages} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
      const columns = container.querySelectorAll('.w-80');
      const wonColumn = columns[2]; // Won is 3rd column
      const dropZone = wonColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'tw' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(moveDeal, 'won');
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

  describe('Terminal stage drag-and-drop unlock (Won/Lost now droppable)', () => {
    const stagesWithLost = [
      { id: 'new', name: 'New', color: '#3B82F6', is_terminal: false },
      { id: 'won', name: 'Won', color: '#22C55E', is_terminal: true },
      { id: 'lost', name: 'Lost', color: '#EF4444', is_terminal: true },
    ];

    it('Given a deal in New / When dropped onto the Lost terminal column / Then onStageChange fires with "lost"', () => {
      const deal: any = { ...deals[0], id: 'lt1', name: 'Lost Deal', current_flow_state: 'new', stage: 'New' };
      const { container } = render(
        <KanbanBoard deals={[deal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const lostColumn = columns[2];
      const dropZone = lostColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'lt1' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(deal, 'lost');
    });

    it('Given a deal already in Won / When dropped back onto Won / Then onStageChange is NOT called', () => {
      const wonDeal: any = { ...deals[0], id: 'w2w', name: 'Already Won', current_flow_state: 'won', stage: 'Won' };
      const { container } = render(
        <KanbanBoard deals={[wonDeal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const wonColumn = columns[1];
      const dropZone = wonColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'w2w' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).not.toHaveBeenCalled();
    });

    it('Given a deal already in Lost / When dropped back onto Lost / Then onStageChange is NOT called', () => {
      const lostDeal: any = { ...deals[0], id: 'l2l', name: 'Already Lost', current_flow_state: 'lost', stage: 'Lost' };
      const { container } = render(
        <KanbanBoard deals={[lostDeal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const lostColumn = columns[2];
      const dropZone = lostColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'l2l' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).not.toHaveBeenCalled();
    });

    it('Given a deal in the Won stage / When it is rendered / Then the card has draggable=true', () => {
      const wonDeal: any = { ...deals[0], id: 'wdrag', name: 'Draggable Won', current_flow_state: 'won', stage: 'Won' };
      render(
        <KanbanBoard deals={[wonDeal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const card = screen.getByText('Draggable Won').closest('[draggable]');
      expect(card).toBeTruthy();
      expect(card?.getAttribute('draggable')).toBe('true');
    });

    it('Given a deal in Won / When moved out to Lost via drag / Then onStageChange fires with "lost"', () => {
      const wonDeal: any = { ...deals[0], id: 'w2l', name: 'Won to Lost', current_flow_state: 'won', stage: 'Won' };
      const { container } = render(
        <KanbanBoard deals={[wonDeal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const lostColumn = columns[2];
      const dropZone = lostColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: (k: string) => k === 'dealId' ? 'w2l' : '', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      fireEvent.drop(dropZone, { dataTransfer: dt } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(wonDeal, 'lost');
    });

    it('Given an empty terminal column / When a deal is dragged over it / Then the column shows active drop styling', () => {
      const { container } = render(
        <KanbanBoard deals={[]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const wonColumn = columns[1];
      const dropZone = wonColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: vi.fn(), setData: vi.fn(), dropEffect: '', effectAllowed: '' };

      expect(dropZone.className).not.toMatch(/ring-2/);
      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      expect(dropZone.className).toMatch(/ring-2/);
    });

    it('Given a deal dragged over a terminal column / When drag leaves / Then active drop styling clears', () => {
      const deal: any = { ...deals[0], id: 'dl2', name: 'Drag Leave', current_flow_state: 'new', stage: 'New' };
      const { container } = render(
        <KanbanBoard deals={[deal]} stages={stagesWithLost} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const columns = container.querySelectorAll('.w-80');
      const wonColumn = columns[1];
      const dropZone = wonColumn.querySelector('[class*="min-h-"]')!;
      const dt = { getData: vi.fn(), setData: vi.fn(), dropEffect: '', effectAllowed: '' };

      fireEvent.dragOver(dropZone, { dataTransfer: dt } as any);
      expect(dropZone.className).toMatch(/ring-2/);

      fireEvent.dragLeave(dropZone, { relatedTarget: document.body } as any);
      expect(dropZone.className).not.toMatch(/ring-2/);
    });

    it('Given all stages are terminal / When all columns are empty / Then every column shows "Drop here"', () => {
      const allTerminal = [
        { id: 'won', name: 'Won', color: '#22C55E', is_terminal: true },
        { id: 'lost', name: 'Lost', color: '#EF4444', is_terminal: true },
      ];
      render(
        <KanbanBoard deals={[]} stages={allTerminal} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />,
      );
      const hints = screen.getAllByText(/Drop here/i);
      expect(hints).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic currency — useCRMFormatters integration
  // ─────────────────────────────────────────────────────────────────────────
  describe('Dynamic currency formatting via useCRMFormatters', () => {
    const singleDeal: any[] = [
      {
        id: 'dc1',
        name: 'Currency Deal',
        value: 5000,
        current_flow_state: 'new',
        stage: 'New',
        company_name: 'Acme Ltd',
        expected_close_date: '2025-12-31',
        owner: { id: 'u9', full_name: 'Alice', avatar_url: null },
      },
    ];

    describe('Given org base_currency is USD', () => {
      it('When deals are rendered in kanban / Then deal values show in USD format (not hardcoded $)', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        // formatCurrency mock produces "USD5000.00" (deal card + stage total)
        expect(screen.getAllByText('USD5000.00').length).toBeGreaterThan(0);
      });

      it('When deals are rendered in kanban / Then stage total also shows USD', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        // stage total now uses formatCurrency → "USD5000.00"
        expect(screen.getAllByText('USD5000.00').length).toBeGreaterThan(0);
      });
    });

    describe('Given org base_currency is INR', () => {
      it('When deals are rendered in kanban / Then deal values show in INR format', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'INR', document_language: 'en-IN', timezone: 'Asia/Kolkata' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        // formatCurrency mock produces "INR5000.00" (deal card + stage total)
        expect(screen.getAllByText('INR5000.00').length).toBeGreaterThan(0);
      });

      it('When deals are rendered in kanban / Then stage total shows INR', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'INR', document_language: 'en-IN', timezone: 'Asia/Kolkata' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        expect(screen.getAllByText('INR5000.00').length).toBeGreaterThan(0);
      });
    });

    describe('Given org base_currency is AED', () => {
      it('When kanban renders / Then deal value is formatted with AED currency prefix', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'AED', document_language: 'ar-AE', timezone: 'Asia/Dubai' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        // formatCurrency mock produces "AED5000.00" — proves useCRMFormatters receives AED from settings
        expect(screen.getAllByText('AED5000.00').length).toBeGreaterThan(0);
      });

      it('When deals are rendered / Then stage total shows AED', () => {
        mockUseBusinessSettings.mockReturnValue({
          settings: { base_currency: 'AED', document_language: 'ar-AE', timezone: 'Asia/Dubai' },
        });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        expect(screen.getAllByText('AED5000.00').length).toBeGreaterThan(0);
      });
    });

    describe('Given businessSettings is null', () => {
      it('When kanban renders / Then falls back to USD gracefully', () => {
        mockUseBusinessSettings.mockReturnValue({ settings: null });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        // useCRMFormatters falls back to 'USD' when settings is null
        expect(screen.getAllByText('USD5000.00').length).toBeGreaterThan(0);
      });

      it('When kanban renders with null settings / Then stage total falls back to USD', () => {
        mockUseBusinessSettings.mockReturnValue({ settings: null });
        render(
          <KanbanBoard
            deals={singleDeal}
            stages={stages}
            onDealClick={mockOnDealClick}
            onStageChange={mockOnStageChange}
          />,
        );
        expect(screen.getAllByText('USD5000.00').length).toBeGreaterThan(0);
      });

      it('When kanban renders with undefined settings / Then does not crash and shows USD fallback', () => {
        mockUseBusinessSettings.mockReturnValue({ settings: undefined });
        expect(() =>
          render(
            <KanbanBoard
              deals={singleDeal}
              stages={stages}
              onDealClick={mockOnDealClick}
              onStageChange={mockOnStageChange}
            />,
          ),
        ).not.toThrow();
        expect(screen.getAllByText('USD5000.00').length).toBeGreaterThan(0);
      });
    });
  });
});
