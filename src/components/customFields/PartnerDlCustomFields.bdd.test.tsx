/**
 * BDD specs for PartnerDlCustomFields (core.partner custom fields via Core partner master).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const getCore = vi.hoisted(() => vi.fn());
const updateCore = vi.hoisted(() => vi.fn());
const panelProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('../../services/crmService', () => ({
  partnersApi: { getCore: (...a: any[]) => getCore(...a), updateCoreCustomFields: (...a: any[]) => updateCore(...a) },
}));
vi.mock('@so360/design-system', () => ({
  Banner: ({ children, ...p }: any) => <div role="alert" data-testid={p['data-testid']}>{children}</div>,
}));
vi.mock('./DlCustomFieldsPanel', () => ({
  DlCustomFieldsPanel: (p: any) => {
    panelProps.current = p;
    return <div data-testid="dl-panel">{p.entity}</div>;
  },
}));

import { PartnerDlCustomFields } from './PartnerDlCustomFields';

beforeEach(() => {
  vi.clearAllMocks();
  panelProps.current = null;
});

describe('PartnerDlCustomFields', () => {
  it('Given no core_partner_id / Then an unlinked notice shows and Core is not called', () => {
    render(<PartnerDlCustomFields corePartnerId={null} />);
    expect(screen.getByTestId('partner-dl-cf-unlinked')).toBeInTheDocument();
    expect(getCore).not.toHaveBeenCalled();
  });

  it('Given the Core row is loading / Then a loading line shows', () => {
    getCore.mockReturnValue(new Promise(() => {}));
    render(<PartnerDlCustomFields corePartnerId="cp1" />);
    expect(screen.getByTestId('partner-dl-cf-loading')).toBeInTheDocument();
  });

  it('Given Core fails / Then a load-error banner shows', async () => {
    getCore.mockRejectedValue(new Error('boom'));
    render(<PartnerDlCustomFields corePartnerId="cp1" />);
    await waitFor(() => expect(screen.getByTestId('partner-dl-cf-load-error')).toBeInTheDocument());
  });

  it('Given the Core row loads / Then the partner panel gets its values and version', async () => {
    getCore.mockResolvedValue({ custom_fields: { tier: 'gold' }, custom_fields_version: 7 });
    render(<PartnerDlCustomFields corePartnerId="cp1" />);
    await waitFor(() => expect(screen.getByTestId('dl-panel').textContent).toBe('partner'));
    expect(getCore).toHaveBeenCalledWith('cp1');
    expect(panelProps.current.recordId).toBe('cp1');
    expect(panelProps.current.values).toEqual({ tier: 'gold' });
    expect(panelProps.current.version).toBe(7);
  });

  it('Given the panel saves / Then it PATCHes Core with the values and version, and reload refetches', async () => {
    getCore.mockResolvedValue({ custom_fields: {}, custom_fields_version: 1 });
    updateCore.mockResolvedValue({});
    render(<PartnerDlCustomFields corePartnerId="cp1" />);
    await waitFor(() => screen.getByTestId('dl-panel'));
    await panelProps.current.save({ tier: 'a' }, 1);
    expect(updateCore).toHaveBeenCalledWith('cp1', { tier: 'a' }, 1);
    await panelProps.current.reload();
    expect(getCore).toHaveBeenCalledTimes(2);
  });
});
