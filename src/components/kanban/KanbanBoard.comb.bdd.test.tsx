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

const mockOnDealClick = vi.fn();
const mockOnStageChange = vi.fn();
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


const noColor = [
  { id: 'new', name: 'New', is_terminal: false },
  { id: 'won', name: 'Won', color: '#22C55E', is_terminal: true },
];
const FALLBACK = 'rgb(var(--nb-fg-muted))';
const renderBoard = (st: any[] = noColor, d: any[] = deals) =>
  render(<KanbanBoard deals={d} stages={st} onDealClick={mockOnDealClick} onStageChange={mockOnStageChange} />);
const dropZones = (c: HTMLElement) => Array.from(c.querySelectorAll('[class*="min-h-"]')) as HTMLElement[];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } });
});

describe('Feature KanbanBoard stage accent uses design tokens', () => {
  describe('Scenario stage without a colour', () => {
    it('Given a stage with no colour When rendered Then the zone top border uses the fg-muted token, not a hex', () => {
      const { container } = renderBoard();
      const zone = dropZones(container)[0];
      expect(zone.style.borderTopColor).toBe(FALLBACK);
      expect(zone.style.borderTopWidth).toBe('3px');
    });

    it('Given a stage with no colour When rendered Then no hard-coded slate hex remains in styles', () => {
      const { container } = renderBoard();
      expect(container.innerHTML.toLowerCase()).not.toContain('#94a3b8');
    });

    it('Given a stage with no colour When rendered Then the header text uses the token', () => {
      const { container } = renderBoard();
      const styled = Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter((e) => e.style.color === FALLBACK);
      expect(styled.length).toBeGreaterThan(0);
    });

    it('Given an empty-string colour When rendered Then the fallback token is used', () => {
      const { container } = renderBoard([{ id: 'new', name: 'New', color: '', is_terminal: false }]);
      expect(dropZones(container)[0].style.borderTopColor).toBe(FALLBACK);
    });
  });

  describe('Scenario stage with a colour', () => {
    it('Given a stage colour When rendered Then it overrides the token', () => {
      const { container } = renderBoard();
      const zone = dropZones(container)[1];
      expect(zone.style.borderTopColor).not.toBe(FALLBACK);
      expect(zone.getAttribute('style')).toMatch(/34, 197, 94|#22c55e/i);
    });

    it('Given mixed stages When rendered Then each keeps its own accent', () => {
      const { container } = renderBoard();
      const zs = dropZones(container);
      expect(zs[0].style.borderTopColor).toBe(FALLBACK);
      expect(zs[1].style.borderTopColor).not.toBe(FALLBACK);
    });
  });

  describe('Scenario drag over', () => {
    it('Given a zone being dragged over When hovered Then the accent border is dropped for the hover style', () => {
      const { container } = renderBoard();
      const zone = dropZones(container)[0];
      const dataTransfer = { getData: () => 'd1', setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(zone, { dataTransfer } as any);
      expect(dropZones(container)[0].style.borderTopColor).toBe('');
    });
  });

  describe('Scenario cards and empty', () => {
    it('Given deals in a no-colour stage When a card is clicked Then onDealClick receives the deal', () => {
      renderBoard();
      fireEvent.click(screen.getByText('Deal Alpha'));
      expect(mockOnDealClick).toHaveBeenCalledWith(deals[0]);
    });

    it('Given no deals When rendered Then columns still render with fallback accent and no cards', () => {
      const { container } = renderBoard(noColor, []);
      expect(screen.queryByText('Deal Alpha')).toBeNull();
      expect(dropZones(container)[0].style.borderTopColor).toBe(FALLBACK);
    });

    it('Given a drop onto the no-colour stage When dropped Then onStageChange fires', () => {
      const { container } = renderBoard([{ id: 'a', name: 'A', is_terminal: false }, { id: 'new', name: 'New', is_terminal: false }]);
      const zone = dropZones(container)[0];
      const dataTransfer = { getData: (k: string) => (k === 'dealId' ? 'd1' : ''), setData: vi.fn(), dropEffect: '', effectAllowed: '' };
      fireEvent.dragOver(zone, { dataTransfer } as any);
      fireEvent.drop(zone, { dataTransfer } as any);
      expect(mockOnStageChange).toHaveBeenCalledWith(deals[0], 'a');
    });
  });
});
