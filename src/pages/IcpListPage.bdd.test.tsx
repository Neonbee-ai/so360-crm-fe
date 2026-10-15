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
const shell = vi.hoisted(() => ({ value: { hasPermission: (_: string) => true } as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => shell.value }));
vi.mock('@so360/design-system', async () => await import('../test/icpDsMock'));

import IcpListPage from './IcpListPage';
import { toast } from '../test/icpDsMock';

const icps = [
  { id: 'i1', name: 'Enterprise CTOs', is_default: true, auto_segment_id: 's1', auto_segment_min_score: 80,
    icp_criteria: [{ id: 'c1' }, { id: 'c2' }] },
  { id: 'i2', name: 'Founders', is_default: false, auto_segment_id: null, auto_segment_min_score: null, icp_criteria: [{ id: 'c3' }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  shell.value = { hasPermission: () => true };
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
      fireEvent.click(screen.getByTestId('confirm-yes'));
      await waitFor(() => expect(svc.archive).toHaveBeenCalledWith('i1'));
      await waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2));
    });
  });

  describe('When Archive is declined', () => {
    it('Then nothing is archived', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[0]);
      fireEvent.click(screen.getByTestId('confirm-no'));
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
      fireEvent.click(screen.getByTestId('confirm-yes'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nope'));
    });
  });
});

const allow = (...codes: string[]) => { shell.value = { hasPermission: (c: string) => codes.includes(c) }; };

describe('Given the list is loading', () => {
  describe('When the request has not resolved', () => {
    it('Then a spinner is shown and no table or description count', () => {
      svc.list.mockReturnValue(new Promise(() => undefined));
      render(<IcpListPage />);
      expect(screen.getByTestId('icp-loading')).toBeTruthy();
      expect(screen.queryByTestId('icp-table')).toBeNull();
      expect(screen.queryByText(/^\d+ profiles?$/)).toBeNull();
    });
  });
});

describe('Given the profile count description', () => {
  describe('When there is exactly one profile', () => {
    it('Then it reads "1 profile" (singular)', async () => {
      svc.list.mockResolvedValue([icps[1]]);
      render(<IcpListPage />);
      expect(await screen.findByText('1 profile')).toBeTruthy();
    });
  });
  describe('When there are several profiles', () => {
    it('Then it reads "2 profiles" (plural)', async () => {
      render(<IcpListPage />);
      expect(await screen.findByText('2 profiles')).toBeTruthy();
    });
  });
  describe('When there are none', () => {
    it('Then it reads "0 profiles"', async () => {
      svc.list.mockResolvedValue([]);
      render(<IcpListPage />);
      expect(await screen.findByText('0 profiles')).toBeTruthy();
    });
  });
});

describe('Given row rendering edge cases', () => {
  describe('When a profile has no criteria array and no auto list', () => {
    it('Then the criteria count is 0 and the auto-list column shows a dash', async () => {
      svc.list.mockResolvedValue([{ id: 'x', name: 'Bare', is_default: false }]);
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-x');
      expect(screen.getByTestId('icp-count-x').textContent).toBe('0');
      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.queryByTestId('badge')).toBeNull();
    });
  });
  describe('When the auto segment is not among the loaded segments', () => {
    it('Then it shows "Unknown list" with the min score', async () => {
      svc.list.mockResolvedValue([{ id: 'x', name: 'Orphan', is_default: false, auto_segment_id: 'gone', auto_segment_min_score: 55 }]);
      render(<IcpListPage />);
      expect(await screen.findByText('Unknown list · score ≥ 55')).toBeTruthy();
    });
  });
  describe('When a segment is set but the min score is null', () => {
    it('Then the score falls back to 70', async () => {
      svc.list.mockResolvedValue([{ id: 'x', name: 'N', is_default: false, auto_segment_id: 's1', auto_segment_min_score: null }]);
      render(<IcpListPage />);
      expect(await screen.findByText('Hot LinkedIn leads · score ≥ 70')).toBeTruthy();
    });
  });
  describe('When the segments request fails', () => {
    it('Then profiles still render and the list name is "Unknown list"', async () => {
      svc.segments.mockRejectedValue(new Error('segs down'));
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      expect(screen.getByText('Unknown list · score ≥ 80')).toBeTruthy();
    });
  });
  describe('When a profile is the default', () => {
    it('Then it has no Set as default action while others do', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      expect(screen.getAllByText('Set as default')).toHaveLength(1);
      expect(screen.getAllByText('Edit')).toHaveLength(2);
      expect(screen.getAllByText('Archive')).toHaveLength(2);
    });
  });
});

describe('Given error states without messages', () => {
  describe('When loading rejects with no message', () => {
    it('Then the generic load error is shown', async () => {
      svc.list.mockRejectedValueOnce({});
      render(<IcpListPage />);
      expect(await screen.findByText('Could not load ideal customer profiles')).toBeTruthy();
      expect(screen.getByText('Could not load profiles')).toBeTruthy();
    });
  });
  describe('When loading rejects with null', () => {
    it('Then the generic load error is shown', async () => {
      svc.list.mockRejectedValueOnce(null);
      render(<IcpListPage />);
      expect(await screen.findByText('Could not load ideal customer profiles')).toBeTruthy();
    });
  });
});

describe('Given set-default and archive outcomes', () => {
  describe('When Set as default succeeds', () => {
    it('Then a success toast names the profile', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      fireEvent.click(screen.getByText('Set as default'));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Founders is now the default profile'));
    });
  });
  describe('When Set as default fails with a message', () => {
    it('Then an error toast shows that message and the list is not reloaded', async () => {
      svc.setDefault.mockRejectedValueOnce(new Error('denied'));
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      fireEvent.click(screen.getByText('Set as default'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('denied'));
      expect(svc.list).toHaveBeenCalledTimes(1);
    });
  });
  describe('When Set as default fails without a message', () => {
    it('Then the fallback error toast shows', async () => {
      svc.setDefault.mockRejectedValueOnce({});
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      fireEvent.click(screen.getByText('Set as default'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not set default'));
    });
  });
  describe('When Archive succeeds', () => {
    it('Then a success toast shows', async () => {
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[1]);
      fireEvent.click(screen.getByTestId('confirm-yes'));
      await waitFor(() => expect(svc.archive).toHaveBeenCalledWith('i2'));
      expect(toast.success).toHaveBeenCalledWith('Profile archived');
    });
  });
  describe('When Archive fails without a message', () => {
    it('Then the fallback error toast shows and the list is not reloaded', async () => {
      svc.archive.mockRejectedValueOnce({});
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      fireEvent.click(screen.getAllByText('Archive')[0]);
      fireEvent.click(screen.getByTestId('confirm-yes'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not archive profile'));
      expect(svc.list).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Given permission and bridge variations', () => {
  describe('When the shell bridge is missing', () => {
    it('Then all actions default to allowed', async () => {
      shell.value = undefined;
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      expect(screen.getByText('New ICP')).toBeTruthy();
      expect(screen.getAllByText('Edit')).toHaveLength(2);
    });
  });
  describe('When the bridge has no hasPermission function', () => {
    it('Then all actions default to allowed', async () => {
      shell.value = {};
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      expect(screen.getByText('New ICP')).toBeTruthy();
      expect(screen.getAllByText('Archive')).toHaveLength(2);
    });
  });
  describe('When the user can only read', () => {
    it('Then there is no New ICP button and no row menu', async () => {
      allow('linkedin_sync.read');
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      expect(screen.queryByText('New ICP')).toBeNull();
      expect(screen.queryByText('Edit')).toBeNull();
      expect(screen.queryByText('Archive')).toBeNull();
      expect(screen.queryByLabelText('Actions for Founders')).toBeNull();
    });
  });
  describe('When the user can only create', () => {
    it('Then New ICP shows but Edit, Set as default and Archive do not', async () => {
      allow('linkedin_sync.create');
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i1');
      expect(screen.getByText('New ICP')).toBeTruthy();
      expect(screen.queryByText('Edit')).toBeNull();
    });
  });
  describe('When the user can only update', () => {
    it('Then Edit and Set as default show but Archive does not', async () => {
      allow('linkedin_sync.update');
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      expect(screen.getAllByText('Edit')).toHaveLength(2);
      expect(screen.getByText('Set as default')).toBeTruthy();
      expect(screen.queryByText('Archive')).toBeNull();
    });
  });
  describe('When the user can only delete', () => {
    it('Then Archive shows but Edit and Set as default do not', async () => {
      allow('linkedin_sync.delete');
      render(<IcpListPage />);
      await screen.findByTestId('icp-row-i2');
      expect(screen.getAllByText('Archive')).toHaveLength(2);
      expect(screen.queryByText('Edit')).toBeNull();
      expect(screen.queryByText('Set as default')).toBeNull();
    });
  });
  describe('When the list is empty and the user can create', () => {
    it('Then the empty-state New ICP action navigates to the new form', async () => {
      svc.list.mockResolvedValue([]);
      render(<IcpListPage />);
      await screen.findByText('No ideal customer profiles yet');
      const buttons = screen.getAllByText('New ICP');
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[1]);
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps/new');
    });
  });
  describe('When the list is empty and the user cannot create', () => {
    it('Then the empty state has no action', async () => {
      allow('linkedin_sync.read');
      svc.list.mockResolvedValue([]);
      render(<IcpListPage />);
      await screen.findByText('No ideal customer profiles yet');
      expect(screen.queryByText('New ICP')).toBeNull();
    });
  });
});
