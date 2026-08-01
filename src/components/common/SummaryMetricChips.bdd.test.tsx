import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SummaryMetricChips } from './SummaryMetricChips';

describe('SummaryMetricChips', () => {
  describe('Given a list of chips', () => {
    it('When rendered / Then shows the count and label for each chip', () => {
      render(
        <SummaryMetricChips
          chips={[
            { key: 'total', label: 'Total', count: 5 },
            { key: 'new', label: 'New', count: 2 },
          ]}
        />,
      );
      expect(screen.getByTestId('summary-metric-chip-total')).toHaveTextContent('5 Total');
      expect(screen.getByTestId('summary-metric-chip-new')).toHaveTextContent('2 New');
    });

    it('When a chip is active / Then it uses the shared selection highlight', () => {
      render(
        <SummaryMetricChips
          chips={[{ key: 'new', label: 'New', count: 2, active: true }]}
        />,
      );
      expect(screen.getByTestId('summary-metric-chip-new').className).toContain('bg-blue-500/10');
    });

    it('When a chip has an onClick / Then clicking it invokes the handler', () => {
      const onClick = vi.fn();
      render(
        <SummaryMetricChips chips={[{ key: 'new', label: 'New', count: 2, onClick }]} />,
      );
      fireEvent.click(screen.getByTestId('summary-metric-chip-new'));
      expect(onClick).toHaveBeenCalled();
    });

    it('When a chip has no onClick / Then it renders as a non-interactive disabled chip', () => {
      render(<SummaryMetricChips chips={[{ key: 'total', label: 'Total', count: 5 }]} />);
      expect(screen.getByTestId('summary-metric-chip-total')).toBeDisabled();
    });
  });
});
