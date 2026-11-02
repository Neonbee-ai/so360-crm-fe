import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SummaryMetricChips } from './SummaryMetricChips';

describe('Feature SummaryMetricChips renders Comb Buttons', () => {
  describe('Scenario render', () => {
    it('Given chips When rendered Then each is a Comb button, size sm, text "<count> <label>"', () => {
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 3, onClick: vi.fn() }, { key: 'b', label: 'Won', count: 0, onClick: vi.fn() }]} />);
      const a = screen.getByTestId('summary-metric-chip-a');
      expect(a).toHaveAttribute('data-comb', 'button');
      expect(a).toHaveAttribute('data-size', 'sm');
      expect(a).toHaveAttribute('type', 'button');
      expect(a).toHaveTextContent('3 Open');
      expect(screen.getByRole('button', { name: '0 Won' })).toBeInTheDocument();
    });

    it('Given a className When rendered Then the container carries it', () => {
      render(<SummaryMetricChips className="mine" chips={[]} />);
      expect(screen.getByTestId('summary-metric-chips').className).toContain('mine');
    });
  });

  describe('Scenario empty', () => {
    it('Given no chips When rendered Then the container has no buttons', () => {
      render(<SummaryMetricChips chips={[]} />);
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.getByTestId('summary-metric-chips')).toBeInTheDocument();
    });
  });

  describe('Scenario active state', () => {
    it('Given an active chip When rendered Then variant is tonal and aria-pressed is true', () => {
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, active: true, onClick: vi.fn() }]} />);
      const a = screen.getByTestId('summary-metric-chip-a');
      expect(a).toHaveAttribute('data-variant', 'tonal');
      expect(a).toHaveAttribute('aria-pressed', 'true');
    });

    it('Given an inactive chip When rendered Then variant is secondary and aria-pressed is absent', () => {
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, onClick: vi.fn() }]} />);
      const a = screen.getByTestId('summary-metric-chip-a');
      expect(a).toHaveAttribute('data-variant', 'secondary');
      expect(a).not.toHaveAttribute('aria-pressed');
    });

    it('Given active=false explicitly When rendered Then it is secondary without aria-pressed', () => {
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, active: false, onClick: vi.fn() }]} />);
      expect(screen.getByTestId('summary-metric-chip-a')).not.toHaveAttribute('aria-pressed');
    });

    it('Given mixed chips When rendered Then only the active one is pressed', () => {
      render(<SummaryMetricChips chips={[
        { key: 'a', label: 'A', count: 1, active: true, onClick: vi.fn() },
        { key: 'b', label: 'B', count: 2, onClick: vi.fn() },
      ]} />);
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    });
  });

  describe('Scenario interaction', () => {
    it('Given a chip When clicked Then onClick fires once', () => {
      const onClick = vi.fn();
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, onClick }]} />);
      fireEvent.click(screen.getByTestId('summary-metric-chip-a'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Given a focused chip When Enter is pressed Then onClick fires', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, onClick }]} />);
      screen.getByTestId('summary-metric-chip-a').focus();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Given a focused chip When Space is pressed Then onClick fires', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'Open', count: 1, onClick }]} />);
      screen.getByTestId('summary-metric-chip-a').focus();
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Given two chips When Tab is pressed Then focus moves in order', async () => {
      const user = userEvent.setup();
      render(<SummaryMetricChips chips={[
        { key: 'a', label: 'A', count: 1, onClick: vi.fn() },
        { key: 'b', label: 'B', count: 2, onClick: vi.fn() },
      ]} />);
      await user.tab();
      expect(screen.getByTestId('summary-metric-chip-a')).toHaveFocus();
      await user.tab();
      expect(screen.getByTestId('summary-metric-chip-b')).toHaveFocus();
    });

    it('Given each chip has its own handler When one is clicked Then only that handler fires', () => {
      const a = vi.fn(); const b = vi.fn();
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'A', count: 1, onClick: a }, { key: 'b', label: 'B', count: 2, onClick: b }]} />);
      fireEvent.click(screen.getByTestId('summary-metric-chip-b'));
      expect(b).toHaveBeenCalledTimes(1);
      expect(a).not.toHaveBeenCalled();
    });
  });

  describe('Scenario disabled', () => {
    it('Given a chip without onClick When rendered Then it is disabled and skipped by Tab', async () => {
      const user = userEvent.setup();
      render(<SummaryMetricChips chips={[
        { key: 'a', label: 'A', count: 1 },
        { key: 'b', label: 'B', count: 2, onClick: vi.fn() },
      ]} />);
      expect(screen.getByTestId('summary-metric-chip-a')).toBeDisabled();
      await user.tab();
      expect(screen.getByTestId('summary-metric-chip-b')).toHaveFocus();
    });

    it('Given a disabled active chip When rendered Then it is still tonal and pressed', () => {
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'A', count: 1, active: true }]} />);
      const a = screen.getByTestId('summary-metric-chip-a');
      expect(a).toBeDisabled();
      expect(a).toHaveAttribute('aria-pressed', 'true');
    });

    it('Given a disabled chip When clicked Then no handler fires', () => {
      const other = vi.fn();
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'A', count: 1 }, { key: 'b', label: 'B', count: 1, onClick: other }]} />);
      fireEvent.click(screen.getByTestId('summary-metric-chip-a'));
      expect(other).not.toHaveBeenCalled();
    });
  });

  describe('Scenario error path', () => {
    it('Given onClick throws When clicked Then the chip stays rendered', () => {
      const onErr = (e: ErrorEvent) => e.preventDefault();
      window.addEventListener('error', onErr);
      render(<SummaryMetricChips chips={[{ key: 'a', label: 'A', count: 1, onClick: () => { throw new Error('x'); } }]} />);
      fireEvent.click(screen.getByTestId('summary-metric-chip-a'));
      window.removeEventListener('error', onErr);
      expect(screen.getByTestId('summary-metric-chip-a')).toBeInTheDocument();
    });
  });
});
