import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
  list: vi.fn(), segments: vi.fn(), create: vi.fn(), update: vi.fn(), draft: vi.fn(),
}));
const nav = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ id: undefined as string | undefined }));

vi.mock('../services/icpService', async () => {
  const actual = await vi.importActual<any>('../services/icpService');
  return { ...actual, icpService: svc };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useParams: () => params }));
vi.mock('@so360/design-system', async () => await import('../test/icpDsMock'));

import IcpFormPage from './IcpFormPage';
import { toast } from '../test/icpDsMock';

const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });
const fillValid = () => {
  type('icp-name', 'Enterprise CTOs');
  type('icp-criterion-label-0', 'CTO');
  type('icp-criterion-keywords-0', 'cto, vp engineering');
  type('icp-criterion-weight-0', '60');
};

beforeEach(() => {
  vi.clearAllMocks();
  params.id = undefined;
  svc.list.mockResolvedValue([]);
  svc.segments.mockResolvedValue([{ id: 's1', name: 'Hot leads' }]);
  svc.create.mockResolvedValue({ id: 'new' });
  svc.update.mockResolvedValue({ id: 'i1' });
});

describe('Given the ICP form (create)', () => {
  describe('When saved with an empty name', () => {
    it('Then a name-required error shows and nothing is posted', async () => {
      render(<IcpFormPage />);
      fireEvent.click(screen.getByTestId('icp-save'));
      expect(await screen.findByText('Name is required')).toBeTruthy();
      expect(svc.create).not.toHaveBeenCalled();
    });
  });

  describe('When all criteria are removed and it is saved', () => {
    it('Then an at-least-one-criterion error shows', async () => {
      render(<IcpFormPage />);
      type('icp-name', 'X');
      fireEvent.click(screen.getByTestId('icp-criterion-remove-0'));
      fireEvent.click(screen.getByTestId('icp-save'));
      expect((await screen.findByTestId('icp-criteria-error')).textContent).toBe('Add at least one criterion');
      expect(svc.create).not.toHaveBeenCalled();
    });
  });

  describe('When a weight is above 100', () => {
    it('Then a weight bounds error shows', async () => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-criterion-weight-0', '101');
      fireEvent.click(screen.getByTestId('icp-save'));
      expect(await screen.findByTestId('icp-weight-error')).toBeTruthy();
      expect(svc.create).not.toHaveBeenCalled();
    });
  });

  describe('When a weight is below 1', () => {
    it('Then a weight bounds error shows', async () => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-criterion-weight-0', '0');
      fireEvent.click(screen.getByTestId('icp-save'));
      expect(await screen.findByTestId('icp-weight-error')).toBeTruthy();
    });
  });

  describe('When a valid form with no auto-list is saved', () => {
    it('Then create is called with the form values and it returns to the list', async () => {
      render(<IcpFormPage />);
      fillValid();
      fireEvent.click(screen.getByTestId('icp-save'));
      await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
      const v = svc.create.mock.calls[0][0];
      expect(v.name).toBe('Enterprise CTOs');
      expect(v.auto_segment_id).toBeNull();
      expect(v.criteria[0]).toMatchObject({
        category: 'role', label: 'CTO', weight: 60, is_positive: true,
        match_config: { keywords: ['cto', 'vp engineering'] },
      });
      await waitFor(() => expect(nav).toHaveBeenCalledWith('/crm/settings/icps'));
    });
  });

  describe('When Add criterion and the Exclude toggle are used', () => {
    it('Then a second row appears and flips to Exclude', async () => {
      render(<IcpFormPage />);
      fireEvent.click(screen.getByTestId('icp-add-criterion'));
      expect(screen.getByTestId('icp-criterion-1')).toBeTruthy();
      fireEvent.click(screen.getByTestId('icp-criterion-positive-1'));
      expect(screen.getByTestId('icp-criterion-positive-1').textContent).toBe('Exclude');
    });
  });

  describe('When saving fails', () => {
    it('Then an error toast shows and the user stays on the form', async () => {
      svc.create.mockRejectedValueOnce(new Error('bad'));
      render(<IcpFormPage />);
      fillValid();
      fireEvent.click(screen.getByTestId('icp-save'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('bad'));
      expect(nav).not.toHaveBeenCalled();
    });
  });
});

describe('Given the auto-add to list section', () => {
  describe('When no list is chosen', () => {
    it('Then the min score field is hidden', async () => {
      render(<IcpFormPage />);
      expect(screen.queryByTestId('icp-min-score')).toBeNull();
    });
  });

  describe('When a list is chosen', () => {
    it('Then min score shows with default 70 and is saved with the segment id', async () => {
      render(<IcpFormPage />);
      await screen.findByText('Hot leads');
      fillValid();
      type('icp-segment', 's1');
      expect((screen.getByTestId('icp-min-score') as HTMLInputElement).value).toBe('70');
      type('icp-min-score', '85');
      fireEvent.click(screen.getByTestId('icp-save'));
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0]).toMatchObject({ auto_segment_id: 's1', auto_segment_min_score: 85 });
    });
  });
});

describe('Given the ICP form (edit)', () => {
  const saved = {
    id: 'i1', name: 'Founders', description: 'd', target_persona: 'Founder', is_default: true,
    auto_segment_id: 's1', auto_segment_min_score: 90,
    icp_criteria: [{ id: 'c1', category: 'industry', label: 'SaaS', weight: 40, is_positive: false, match_config: { keywords: ['saas'] } }],
  };

  describe('When opened for an existing profile', () => {
    it('Then the form is prefilled including criteria and auto-list', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([saved]);
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      expect((screen.getByTestId('icp-criterion-label-0') as HTMLInputElement).value).toBe('SaaS');
      expect((screen.getByTestId('icp-criterion-category-0') as HTMLSelectElement).value).toBe('industry');
      expect((screen.getByTestId('icp-criterion-weight-0') as HTMLInputElement).value).toBe('40');
      expect(screen.getByTestId('icp-criterion-positive-0').textContent).toBe('Exclude');
      expect((screen.getByTestId('icp-min-score') as HTMLInputElement).value).toBe('90');
    });
  });

  describe('When the edited profile is saved', () => {
    it('Then update is called with the profile id', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([saved]);
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      type('icp-name', 'Founders v2');
      fireEvent.click(screen.getByTestId('icp-save'));
      await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
      expect(svc.update.mock.calls[0][0]).toBe('i1');
      expect(svc.update.mock.calls[0][1].name).toBe('Founders v2');
    });
  });

  describe('When the profile id is unknown', () => {
    it('Then a not-found message is shown', async () => {
      params.id = 'nope';
      render(<IcpFormPage />);
      expect(await screen.findByText('Profile not found')).toBeTruthy();
    });
  });
});

describe('Given the Neura rail card', () => {
  describe('When Draft succeeds', () => {
    it('Then the form is filled for review and nothing is saved', async () => {
      svc.draft.mockResolvedValue({
        name: 'Fintech CFOs', description: 'CFOs at fintechs', target_persona: 'CFO',
        criteria: [{ category: 'role', label: 'CFO', weight: 80, match_config: { keywords: ['cfo'] }, is_positive: true }],
      });
      render(<IcpFormPage />);
      type('icp-brief', 'CFOs at fintech startups');
      fireEvent.click(screen.getByTestId('icp-draft-btn'));
      await screen.findByDisplayValue('Fintech CFOs');
      expect(svc.draft).toHaveBeenCalledWith('CFOs at fintech startups', '');
      expect((screen.getByTestId('icp-criterion-label-0') as HTMLInputElement).value).toBe('CFO');
      expect((screen.getByTestId('icp-persona') as HTMLInputElement).value).toBe('CFO');
      expect(svc.create).not.toHaveBeenCalled();
    });
  });

  describe('When Draft fails', () => {
    it('Then an error is shown and the form is untouched', async () => {
      svc.draft.mockRejectedValue(new Error('Neura down'));
      render(<IcpFormPage />);
      type('icp-name', 'Keep me');
      type('icp-brief', 'anything');
      fireEvent.click(screen.getByTestId('icp-draft-btn'));
      expect((await screen.findByTestId('icp-draft-error')).textContent).toBe('Neura down');
      expect((screen.getByTestId('icp-name') as HTMLInputElement).value).toBe('Keep me');
    });
  });

  describe('When the brief is empty', () => {
    it('Then Draft is disabled', () => {
      render(<IcpFormPage />);
      expect((screen.getByTestId('icp-draft-btn') as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
