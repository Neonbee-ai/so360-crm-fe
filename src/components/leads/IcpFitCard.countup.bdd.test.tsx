import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => k === 'submodule:crm:icp_manager' }),
}));
vi.mock('@so360/design-system', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CountUp: ({ value }: { value: React.ReactNode }) => <span data-testid="countup">{value}</span>,
}));

import IcpFitCard from './IcpFitCard';

describe('Feature: ICP fit score counts up', () => {
  it('Given a scored lead When the card renders Then the score figure is passed to CountUp', () => {
    render(<IcpFitCard meta={{ icp_score: 72, icp_criteria: { industry: 30 } }} />);
    const score = screen.getByTestId('icp-fit-score');
    expect(within(score).getByTestId('countup').textContent).toBe('72 / 100');
  });
});
