import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
  list: vi.fn(), segments: vi.fn(), archive: vi.fn(), setDefault: vi.fn(),
}));
const nav = vi.hoisted(() => vi.fn());

vi.mock('../services/icpService', () => ({ icpService: svc }));
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }));
vi.mock('lucide-react', () => ({ MoreVertical: () => null, Target: () => null }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: () => true }) }));
vi.mock('@so360/design-system', async () => await import('../test/icpDsMock'));

import IcpListPage from './IcpListPage';
import { confirmResult, toast } from '../test/icpDsMock';

const icps = [
  { id: 'i1', name: 'Enterprise CTOs', is_default: true, auto_segment_id: 's1', auto_segment_min_score: 80,
    icp_criteria: [{ id: 'c1' }, { id: 'c2' }] },
  { id: 'i2', name: 'Founders', is_default: false, auto_segment_id: null, auto_segment_min_score: null, icp_criteria: [{ id: 'c3' }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  confirmResult.value = true;
  svc.list.mockResolvedValue(icps);
  svc.segments.mockResolvedValue([{ id: 's1', name: 'Hot LinkedIn leads' }]);
  svc.archive.mockResolvedValue({});
  svc.setDefault.mockResolvedValue({});
});

describe('Given the ideal customer profiles list', () => {
  describe('When profiles exist', () => {
    it('Then each row shows name, Default badge, criteria count and auto-list with min score', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      expect(screen.getByText('Enterprise CTOs')).toBeTruthy();
      expect(screen.getAllByTestId('badge')).toHaveLength(1);
      expect(screen.getByTestId('icp-count-i1').textContent).toBe('2');
      expect(screen.getByText('Hot LinkedIn leads · score ≥ 80')).toBeTruthy();
      expect(screen.getByTestId('icp-count-i2').textContent).toBe('1');
    });
  });

  describe('When there are no profiles', () => {
    it('Then the empty state explains that ICPs drive the LinkedIn fit score', async () => {
      svc.list.mockResolvedValue([]);
      render(<IcpListPage />);
      expect(await screen.findByText('No ideal customer profiles yet')).toBeTruthy();
      expect(screen.getByText(/fit score/)).toBeTruthy();
    });
  });

  describe('When loading fails', () => {
    it('Then an error state with Retry is shown', async () => {
      svc.list.mockRejectedValueOnce(new Error('boom'));
      render(<IcpListPage />);
      expect(await screen.findByText('boom')).toBeTruthy();
      fireEvent.click(screen.getByText('Retry'));
      await screen.findByTestId('icp-row-i1');
    });
  });

  describe('When New ICP is clicked', () => {
    it('Then it navigates to the new form', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getByText('New ICP'));
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps/new');
    });
  });

  describe('When Edit is chosen from the row menu', () => {
    it('Then it navigates to the edit form', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      fireEvent.click(screen.getAllByText('Edit')[1]);
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps/i2');
    });
  });

  describe('When Set as default is chosen on a non-default profile', () => {
    it('Then setDefault is called and the list reloads', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      expect(screen.getAllByText('Set as default')).toHaveLength(1);
      fireEvent.click(screen.getByText('Set as default'));
      await waitFor(() => expect(svc.setDefault).toHaveBeenCalledWith('i2'));
      await waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2));
    });
  });

  describe('When Archive is chosen and confirmed', () => {
    it('Then the profile is archived and the list reloads', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[0]);
      await waitFor(() => expect(svc.archive).toHaveBeenCalledWith('i1'));
      await waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2));
    });
  });

  describe('When Archive is declined', () => {
    it('Then nothing is archived', async () => {
      confirmResult.value = false;
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[0]);
      await new Promise((r) => setTimeout(r, 10));
      expect(svc.archive).not.toHaveBeenCalled();
    });
  });

  describe('When archiving fails', () => {
    it('Then an error toast is raised', async () => {
      svc.archive.mockRejectedValueOnce(new Error('nope'));
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[0]);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nope'));
    });
  });
});
