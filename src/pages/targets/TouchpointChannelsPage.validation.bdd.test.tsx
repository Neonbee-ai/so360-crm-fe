import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TouchpointChannelsPage from './TouchpointChannelsPage';

const svc = vi.hoisted(() => ({
  setTenantId: vi.fn(),
  setOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
}));

vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')) }));
vi.mock('../../services/targetPlanService', () => ({ targetPlanService: svc }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ currentTenant: { id: 't1' }, currentOrg: { id: 'o1' }, accessToken: 'tok', hasPermission: () => true }),
}));

describe('Feature: add-channel form validates inline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.listChannels.mockResolvedValue([]);
  });

  const openForm = async () => {
    render(<TouchpointChannelsPage />);
    await waitFor(() => expect(svc.listChannels).toHaveBeenCalled());
    fireEvent.click((await screen.findAllByText('Add channel'))[0]);
    await screen.findByLabelText('Label');
  };

  it('Given the form is open / When rendered / Then label and key cap their length', async () => {
    await openForm();
    expect(screen.getByLabelText('Label')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Key')).toHaveAttribute('maxlength', '64');
  });

  it('Given whitespace-only label and key / When Add channel is pressed / Then required errors show and nothing is saved', async () => {
    await openForm();
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: '   ' } });
    const buttons = screen.getAllByText('Add channel');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText('Label is required.')).toBeTruthy();
    expect(screen.getByText('Key is required.')).toBeTruthy();
    expect(svc.createChannel).not.toHaveBeenCalled();
  });

  it('Given an error is showing / When the user types in the field / Then that error clears', async () => {
    await openForm();
    const buttons = screen.getAllByText('Add channel');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText('Label is required.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Site Visit' } });
    expect(screen.queryByText('Label is required.')).toBeNull();
  });
});
