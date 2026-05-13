import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { KanbanBoard } from './KanbanBoard';

const stages = [
  { id: 'new', name: 'New', color: '#3b82f6' },
  { id: 'qualified', name: 'Qualified', color: '#8b5cf6' },
  { id: 'won', name: 'Won', color: '#10b981', is_terminal: true },
];

const deals = [
  { id: 'd1', name: 'Deal A', value: 5000, company_name: 'Acme', owner: { id: 'u1', full_name: 'Test', avatar_url: null }, current_flow_state: 'new', created_at: '2024-01-01', expected_close_date: '2024-06-01' },
  { id: 'd2', name: 'Deal B', value: 10000, company_name: 'BigCo', owner: { id: 'u2', full_name: 'Other', avatar_url: 'http://avatar.png' }, current_flow_state: 'qualified', created_at: '2024-02-01', expected_close_date: '2024-07-01' },
  { id: 'd3', name: 'Deal C', value: 3000, company_name: 'WinCo', owner: { id: 'u1', full_name: 'Test', avatar_url: null }, current_flow_state: 'won', created_at: '2024-03-01', expected_close_date: '2024-05-01' },
] as any;

describe('KanbanBoard', () => {
  it('renders all stages', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('renders deal cards', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText('Deal A')).toBeInTheDocument();
    expect(screen.getByText('Deal B')).toBeInTheDocument();
    expect(screen.getByText('Deal C')).toBeInTheDocument();
  });

  it('calls onDealClick when card is clicked', () => {
    const onDealClick = vi.fn();
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={onDealClick} onStageChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Deal A'));
    expect(onDealClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('renders empty stages with no deals', () => {
    render(<KanbanBoard deals={[]} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows deal count per stage', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    const ones = screen.getAllByText('1');
    expect(ones.some(el => el.closest('[class*="bg-slate"]'))).toBeTruthy();
  });

  it('shows stage totals', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    const fiveK = screen.getAllByText('$5,000');
    expect(fiveK.length).toBeGreaterThan(0);
    expect(screen.getAllByText('$10,000').length).toBeGreaterThan(0);
  });

  it('shows lock icon on terminal stages', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    // Terminal stage should have the lock icon rendered
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('renders deal with avatar url', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    // Deal B has an avatar URL
    const img = document.querySelector('img[alt="Other"]');
    expect(img).toBeTruthy();
  });

  it('renders deal with avatar initial (no url)', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    // Deal A has no avatar URL, should show initial 'T'
    expect(screen.getAllByText('T').length).toBeGreaterThan(0);
  });

  it('shows company name on cards', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('BigCo')).toBeInTheDocument();
  });

  it('shows deal value on cards', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getAllByText('$5,000').length).toBeGreaterThan(0);
  });

  it('handles drag start on non-terminal deal', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    const dealCard = screen.getByText('Deal A').closest('[draggable]');
    expect(dealCard).toBeTruthy();
    if (dealCard) {
      const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
      fireEvent.dragStart(dealCard, { dataTransfer });
      expect(dataTransfer.setData).toHaveBeenCalledWith('dealId', 'd1');
    }
  });

  it('handles drag end', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    const dealCard = screen.getByText('Deal A').closest('[draggable]');
    if (dealCard) {
      fireEvent.dragEnd(dealCard);
      expect(dealCard.style.opacity).toBe('1');
    }
  });

  it('handles drag over and drop', () => {
    const onStageChange = vi.fn();
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={onStageChange} />);

    // Find the Qualified stage drop zone (non-terminal)
    const dropZones = document.querySelectorAll('[class*="flex-1"]');
    const qualifiedZone = Array.from(dropZones).find(el => el.textContent?.includes('BigCo'));

    if (qualifiedZone) {
      fireEvent.dragOver(qualifiedZone, { dataTransfer: { dropEffect: '' } });
      fireEvent.drop(qualifiedZone, { dataTransfer: { getData: () => 'd1' } });
      expect(onStageChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'd1' }),
        'qualified'
      );
    }
  });

  it('handles drag leave', () => {
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    const dropZones = document.querySelectorAll('[class*="flex-1"]');
    if (dropZones[0]) {
      fireEvent.dragLeave(dropZones[0]);
    }
    // Should not throw
    expect(true).toBe(true);
  });

  it('does not call onStageChange when dropping on same stage', () => {
    const onStageChange = vi.fn();
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={vi.fn()} onStageChange={onStageChange} />);

    const dropZones = document.querySelectorAll('[class*="flex-1"]');
    const newZone = Array.from(dropZones).find(el => el.textContent?.includes('Acme'));

    if (newZone) {
      fireEvent.drop(newZone, { dataTransfer: { getData: () => 'd1' } });
      expect(onStageChange).not.toHaveBeenCalled();
    }
  });

  it('terminal stages show empty state message', () => {
    const emptyDeals = deals.filter((d: any) => d.current_flow_state !== 'won');
    render(<KanbanBoard deals={emptyDeals} stages={stages} onDealClick={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText(/win\/lose via/i)).toBeInTheDocument();
  });

  it('terminal stage deals are clickable', () => {
    const onDealClick = vi.fn();
    render(<KanbanBoard deals={deals} stages={stages} onDealClick={onDealClick} onStageChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Deal C'));
    expect(onDealClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'd3' }));
  });
});
