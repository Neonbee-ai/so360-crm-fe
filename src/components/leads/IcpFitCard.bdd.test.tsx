import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const shell = vi.hoisted(() => ({ value: {} as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => shell.value }));

import IcpFitCard from './IcpFitCard';
import { fitBand } from '../../utils/icpFit';

const on = () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => k === 'submodule:crm:icp_manager' });
beforeEach(() => { shell.value = on(); });

describe('Feature: ICP fit card on lead detail', () => {
  it('Given a scored lead When rendered Then shows score, band, ICP name', () => {
    render(<IcpFitCard meta={{ icp_score: 72, icp_name: 'Enterprise CTOs', icp_criteria: { industry: 30 } }} />);
    expect(screen.getByText('ICP fit')).toBeTruthy();
    expect(screen.getByTestId('icp-fit-score').textContent).toBe('72 / 100');
    expect(screen.getByTestId('icp-fit-band').textContent).toBe('Good fit');
    expect(screen.getByTestId('icp-fit-name').textContent).toBe('Enterprise CTOs');
    expect(screen.getByText('Industry')).toBeTruthy();
  });

  it('Given points map When rendered Then positive is met and zero is missed', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: { industry: 30, location: 0 } }} />);
    expect(screen.getAllByTestId('icp-criterion-met')[0].textContent).toContain('✓');
    expect(screen.getAllByTestId('icp-criterion-missed')[0].textContent).toContain('✗');
  });

  it('Given an array criterion with no verdict When rendered Then shows ? unknown', () => {
    render(<IcpFitCard meta={{ icp_score: 50, icp_criteria: [{ label: 'Title' }] }} />);
    expect(screen.getByTestId('icp-criterion-unknown').textContent).toContain('?');
  });

  it('Given a missed criterion with found value When rendered Then shows the found value', () => {
    render(<IcpFitCard meta={{ icp_score: 30, icp_criteria: [{ label: 'Location', matched: false, found: 'Berlin' }] }} />);
    expect(screen.getByTestId('icp-criterion-missed').textContent).toContain('Berlin');
  });

  it('Given no icp_score When rendered Then card is hidden', () => {
    render(<IcpFitCard meta={{ icp_criteria: { a: 1 } }} />);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given the ICP flag is off When rendered Then card is hidden', () => {
    shell.value = { effectiveFlagsLoaded: true, isFeatureEnabled: () => false };
    render(<IcpFitCard meta={{ icp_score: 90 }} />);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given synced_at When rendered Then footer shows Source: LinkedIn and date', () => {
    render(<IcpFitCard meta={{ icp_score: 90, synced_at: '2026-10-01T10:00:00.000Z' }} />);
    expect(screen.getByTestId('icp-fit-source').textContent).toBe('Source: LinkedIn · 1 Oct 2026');
  });

  it('Given no sync date When rendered Then footer is absent', () => {
    render(<IcpFitCard meta={{ icp_score: 90 }} />);
    expect(screen.queryByTestId('icp-fit-source')).toBeNull();
  });

  it.each([[100, 'excellent'], [80, 'excellent'], [79, 'good'], [60, 'good'], [59, 'fair'], [40, 'fair'], [39, 'not_a_fit'], [0, 'not_a_fit']])(
    'Given score %i When banded Then %s', (s, b) => { expect(fitBand(s as number)).toBe(b); });
});
