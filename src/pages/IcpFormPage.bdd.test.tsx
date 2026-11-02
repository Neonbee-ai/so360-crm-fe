import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
  list: vi.fn(), audiences: vi.fn(), create: vi.fn(), update: vi.fn(), draft: vi.fn(),
}));
const nav = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ id: undefined as string | undefined }));

vi.mock('../services/icpService', async () => {
  const actual = await vi.importActual<any>('../services/icpService');
  return { ...actual, icpService: svc };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useParams: () => params }));
vi.mock('@so360/design-system', async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import('../test/icpDsMock')) }));

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
  svc.audiences.mockResolvedValue([{ id: 's1', name: 'Hot leads' }]);
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
      expect(v.auto_audience_id).toBeNull();
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
      type('icp-audience', 's1');
      expect((screen.getByTestId('icp-min-score') as HTMLInputElement).value).toBe('70');
      type('icp-min-score', '85');
      fireEvent.click(screen.getByTestId('icp-save'));
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0]).toMatchObject({ auto_audience_id: 's1', auto_segment_min_score: 85 });
    });
  });
});

describe('Given the ICP form (edit)', () => {
  const saved = {
    id: 'i1', name: 'Founders', description: 'd', target_persona: 'Founder', is_default: true,
    auto_audience_id: 's1', auto_segment_min_score: 90,
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

const deferred = <T,>() => {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const click = (testId: string) => fireEvent.click(screen.getByTestId(testId));
const savedIcp = {
  id: 'i1', name: 'Founders', description: 'd', target_persona: 'Founder', is_default: false,
  auto_audience_id: null, auto_segment_min_score: null,
  icp_criteria: [{ id: 'c1', category: 'industry', label: 'SaaS', weight: 40, is_positive: true, match_config: { keywords: ['saas'] } }],
};

describe('Given the page titles and navigation', () => {
  describe('When opened in create mode', () => {
    it('Then the title says New, nothing is listed and no errors show before submit', async () => {
      render(<IcpFormPage />);
      expect(screen.getByText('New ideal customer profile')).toBeTruthy();
      expect(screen.queryByText('Name is required')).toBeNull();
      await waitFor(() => expect(svc.audiences).toHaveBeenCalled());
      expect(svc.list).not.toHaveBeenCalled();
    });
  });
  describe('When Cancel is clicked', () => {
    it('Then it navigates to the list without saving', () => {
      render(<IcpFormPage />);
      click('icp-cancel');
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps');
      expect(svc.create).not.toHaveBeenCalled();
    });
  });
  describe('When Back is clicked', () => {
    it('Then it navigates to the list', () => {
      render(<IcpFormPage />);
      fireEvent.click(screen.getByLabelText('Back to Ideal customer profiles'));
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps');
    });
  });
});

describe('Given validation messaging', () => {
  describe('When submitted empty and then the name is fixed', () => {
    it('Then the name error disappears', async () => {
      render(<IcpFormPage />);
      click('icp-save');
      expect(await screen.findByText('Name is required')).toBeTruthy();
      type('icp-name', 'Fixed');
      expect(screen.queryByText('Name is required')).toBeNull();
    });
  });
  describe('When the name is only whitespace', () => {
    it('Then the name-required error shows', async () => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-name', '   ');
      click('icp-save');
      expect(await screen.findByText('Name is required')).toBeTruthy();
      expect(svc.create).not.toHaveBeenCalled();
    });
  });
  describe('When a criterion has no label', () => {
    it('Then the every-criterion-needs-a-label error shows', async () => {
      render(<IcpFormPage />);
      type('icp-name', 'X');
      click('icp-save');
      expect((await screen.findByTestId('icp-criteria-error')).textContent).toBe('Every criterion needs a label');
      expect(svc.create).not.toHaveBeenCalled();
    });
  });
  describe('When the weight is cleared', () => {
    it('Then it is treated as 0 and the weight error shows', async () => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-criterion-weight-0', '');
      click('icp-save');
      expect((await screen.findByTestId('icp-weight-error')).textContent).toBe('Weight must be between 1 and 100');
    });
  });
  describe('When the weight is exactly 1 or exactly 100', () => {
    it.each(['1', '100'])('Then %s is accepted and saved', async (w) => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-criterion-weight-0', w);
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0].criteria[0].weight).toBe(Number(w));
      expect(screen.queryByTestId('icp-weight-error')).toBeNull();
    });
  });
});

describe('Given criteria management', () => {
  describe('When Add criterion is clicked', () => {
    it('Then a blank Include row with weight 50 and role category is appended', () => {
      render(<IcpFormPage />);
      click('icp-add-criterion');
      expect((screen.getByTestId('icp-criterion-category-1') as HTMLSelectElement).value).toBe('role');
      expect((screen.getByTestId('icp-criterion-label-1') as HTMLInputElement).value).toBe('');
      expect((screen.getByTestId('icp-criterion-weight-1') as HTMLInputElement).value).toBe('50');
      expect(screen.getByTestId('icp-criterion-positive-1').textContent).toBe('Include');
    });
  });
  describe('When a criterion is edited (category, label, keywords, weight, exclude)', () => {
    it('Then only that row changes and the values are saved', async () => {
      render(<IcpFormPage />);
      fillValid();
      click('icp-add-criterion');
      type('icp-criterion-category-1', 'company');
      type('icp-criterion-label-1', 'Acme');
      type('icp-criterion-keywords-1', 'acme');
      type('icp-criterion-weight-1', '15');
      click('icp-criterion-positive-1');
      expect((screen.getByTestId('icp-criterion-label-0') as HTMLInputElement).value).toBe('CTO');
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      const [c0, c1] = svc.create.mock.calls[0][0].criteria;
      expect(c0).toMatchObject({ category: 'role', label: 'CTO', is_positive: true });
      expect(c1).toMatchObject({ category: 'company', label: 'Acme', weight: 15, is_positive: false, match_config: { keywords: ['acme'] } });
    });
  });
  describe('When the Exclude toggle is flipped twice', () => {
    it('Then it is back to Include', () => {
      render(<IcpFormPage />);
      click('icp-criterion-positive-0');
      expect(screen.getByTestId('icp-criterion-positive-0').textContent).toBe('Exclude');
      click('icp-criterion-positive-0');
      expect(screen.getByTestId('icp-criterion-positive-0').textContent).toBe('Include');
    });
  });
  describe('When the first of two criteria is removed', () => {
    it('Then the second remains as the only row', () => {
      render(<IcpFormPage />);
      click('icp-add-criterion');
      type('icp-criterion-label-1', 'Second');
      click('icp-criterion-remove-0');
      expect(screen.queryByTestId('icp-criterion-1')).toBeNull();
      expect((screen.getByTestId('icp-criterion-label-0') as HTMLInputElement).value).toBe('Second');
    });
  });
  describe('When description, persona and default are set', () => {
    it('Then they are saved and the default toggle can be switched off again', async () => {
      render(<IcpFormPage />);
      fillValid();
      type('icp-description', 'About');
      type('icp-persona', 'Buyer');
      click('icp-default');
      expect(screen.getByTestId('icp-default').getAttribute('aria-checked')).toBe('true');
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0]).toMatchObject({ description: 'About', target_persona: 'Buyer', is_default: true });
    });
    it('Then toggling default twice saves is_default false', async () => {
      render(<IcpFormPage />);
      fillValid();
      click('icp-default'); click('icp-default');
      expect(screen.getByTestId('icp-default').getAttribute('aria-checked')).toBe('false');
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0].is_default).toBe(false);
    });
  });
});

describe('Given the auto-add min score and segment clearing', () => {
  describe('When the min score is 0 or above 100', () => {
    it('Then it is passed through the form and clamped by the body mapper (verified in the service spec)', async () => {
      render(<IcpFormPage />);
      await screen.findByText('Hot leads');
      fillValid();
      type('icp-audience', 's1');
      type('icp-min-score', '0');
      expect((screen.getByTestId('icp-min-score') as HTMLInputElement).value).toBe('0');
      type('icp-min-score', '101');
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0].auto_segment_min_score).toBe(101);
    });
  });
  describe('When the min score is cleared', () => {
    it('Then the field falls back to showing 70', async () => {
      render(<IcpFormPage />);
      await screen.findByText('Hot leads');
      type('icp-audience', 's1');
      type('icp-min-score', '40');
      type('icp-min-score', '');
      expect((screen.getByTestId('icp-min-score') as HTMLInputElement).value).toBe('70');
    });
  });
  describe('When a segment is chosen and then cleared', () => {
    it('Then the min score is hidden and the segment is saved as null', async () => {
      render(<IcpFormPage />);
      await screen.findByText('Hot leads');
      fillValid();
      type('icp-audience', 's1');
      expect(screen.getByTestId('icp-min-score')).toBeTruthy();
      type('icp-audience', '');
      expect(screen.queryByTestId('icp-min-score')).toBeNull();
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0].auto_audience_id).toBeNull();
    });
  });
  describe('When the segment list fails to load', () => {
    it('Then the form still works with only the None option', async () => {
      svc.audiences.mockRejectedValue(new Error('segs'));
      render(<IcpFormPage />);
      await waitFor(() => expect(svc.audiences).toHaveBeenCalled());
      const sel = screen.getByTestId('icp-audience') as HTMLSelectElement;
      expect(Array.from(sel.options).map((o) => o.value)).toEqual(['']);
    });
  });
});

describe('Given saving outcomes', () => {
  describe('When create succeeds', () => {
    it('Then a Profile created toast shows', async () => {
      render(<IcpFormPage />);
      fillValid();
      click('icp-save');
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile created'));
    });
  });
  describe('When saving fails without a message', () => {
    it('Then the fallback toast shows and Save is enabled again', async () => {
      svc.create.mockRejectedValueOnce({});
      render(<IcpFormPage />);
      fillValid();
      click('icp-save');
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not save profile'));
      await waitFor(() => expect((screen.getByTestId('icp-save') as HTMLButtonElement).disabled).toBe(false));
      expect(screen.getByTestId('icp-save').textContent).toBe('Save');
    });
  });
  describe('When Save is clicked twice while the request is pending', () => {
    it('Then the button shows Saving…, is disabled and create is called once', async () => {
      const d = deferred<any>();
      svc.create.mockReturnValue(d.promise);
      render(<IcpFormPage />);
      fillValid();
      click('icp-save');
      await waitFor(() => expect(screen.getByTestId('icp-save').textContent).toBe('Saving…'));
      expect((screen.getByTestId('icp-save') as HTMLButtonElement).disabled).toBe(true);
      click('icp-save');
      expect(svc.create).toHaveBeenCalledTimes(1);
      d.resolve({ id: 'n' });
      await waitFor(() => expect(nav).toHaveBeenCalledTimes(1));
    });
  });
  describe('When the form is submitted with Enter', () => {
    it('Then it saves through the form submit handler', async () => {
      render(<IcpFormPage />);
      fillValid();
      fireEvent.submit(screen.getByTestId('icp-name').closest('form')!);
      await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
    });
  });
});

describe('Given the edit form load and save states', () => {
  describe('When the profile is still loading', () => {
    it('Then a spinner shows instead of the form', () => {
      params.id = 'i1';
      svc.list.mockReturnValue(new Promise(() => undefined));
      render(<IcpFormPage />);
      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByTestId('icp-save')).toBeNull();
    });
  });
  describe('When loading fails with a message', () => {
    it('Then the error is shown with a back button to the list', async () => {
      params.id = 'i1';
      svc.list.mockRejectedValue(new Error('load boom'));
      render(<IcpFormPage />);
      expect((await screen.findByRole('alert')).textContent).toBe('load boom');
      fireEvent.click(screen.getByLabelText('Back to Ideal customer profiles'));
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps');
    });
  });
  describe('When loading fails without a message', () => {
    it('Then the fallback error shows', async () => {
      params.id = 'i1';
      svc.list.mockRejectedValue({});
      render(<IcpFormPage />);
      expect(await screen.findByText('Could not load profile')).toBeTruthy();
    });
  });
  describe('When the profile has no auto list', () => {
    it('Then the edit title shows and the min score is hidden', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([savedIcp]);
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      expect(screen.getByText('Edit ideal customer profile')).toBeTruthy();
      expect(screen.queryByTestId('icp-min-score')).toBeNull();
      expect(screen.getByTestId('icp-criterion-positive-0').textContent).toBe('Include');
    });
  });
  describe('When the edit is saved successfully', () => {
    it('Then a Profile updated toast shows and it returns to the list', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([savedIcp]);
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      click('icp-save');
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile updated'));
      expect(nav).toHaveBeenCalledWith('/crm/settings/icps');
      expect(svc.create).not.toHaveBeenCalled();
    });
  });
  describe('When the edit save fails', () => {
    it('Then an error toast shows and there is no navigation', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([savedIcp]);
      svc.update.mockRejectedValueOnce(new Error('conflict'));
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      click('icp-save');
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('conflict'));
      expect(nav).not.toHaveBeenCalled();
    });
  });
  describe('When the auto segment of a saved profile is cleared', () => {
    it('Then update receives a null segment', async () => {
      params.id = 'i1';
      svc.list.mockResolvedValue([{ ...savedIcp, auto_audience_id: 's1', auto_segment_min_score: 90 }]);
      render(<IcpFormPage />);
      await screen.findByDisplayValue('Founders');
      await screen.findByText('Hot leads');
      type('icp-audience', '');
      click('icp-save');
      await waitFor(() => expect(svc.update).toHaveBeenCalled());
      expect(svc.update.mock.calls[0][1].auto_audience_id).toBeNull();
    });
  });
});

describe('Given the page unmounts before requests settle', () => {
  describe('When segments and list resolve after unmount', () => {
    it('Then nothing throws and no state is applied', async () => {
      params.id = 'i1';
      const seg = deferred<any[]>(); const lst = deferred<any[]>();
      svc.audiences.mockReturnValue(seg.promise); svc.list.mockReturnValue(lst.promise);
      const { unmount } = render(<IcpFormPage />);
      unmount();
      seg.resolve([{ id: 's', name: 'S' }]); lst.resolve([savedIcp]);
      await new Promise((r) => setTimeout(r, 0));
      expect(svc.list).toHaveBeenCalledTimes(1);
    });
  });
  describe('When the list rejects after unmount', () => {
    it('Then the error is swallowed', async () => {
      params.id = 'i1';
      const lst = deferred<any[]>();
      svc.list.mockReturnValue(lst.promise);
      const { unmount } = render(<IcpFormPage />);
      unmount();
      lst.reject(new Error('late'));
      await new Promise((r) => setTimeout(r, 0));
      expect(svc.list).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Given the Neura draft in more situations', () => {
  const brief = 'CFOs at fintech startups';
  describe('When drafting is in progress', () => {
    it('Then the button shows Drafting… and is disabled until it settles', async () => {
      const d = deferred<any>();
      svc.draft.mockReturnValue(d.promise);
      render(<IcpFormPage />);
      type('icp-brief', brief);
      click('icp-draft-btn');
      await waitFor(() => expect(screen.getByTestId('icp-draft-btn').textContent).toBe('Drafting…'));
      expect((screen.getByTestId('icp-draft-btn') as HTMLButtonElement).disabled).toBe(true);
      d.resolve({ name: 'Done' });
      await waitFor(() => expect(screen.getByTestId('icp-draft-btn').textContent).toBe('Draft'));
      expect(toast.success).toHaveBeenCalledWith('Draft ready — review before saving');
    });
  });
  describe('When the brief is whitespace only', () => {
    it('Then Draft stays disabled and Neura is not called', () => {
      render(<IcpFormPage />);
      type('icp-brief', '    ');
      expect((screen.getByTestId('icp-draft-btn') as HTMLButtonElement).disabled).toBe(true);
      click('icp-draft-btn');
      expect(svc.draft).not.toHaveBeenCalled();
    });
  });
  describe('When the brief has surrounding spaces and a name is already typed', () => {
    it('Then the trimmed brief and the current name are sent', async () => {
      svc.draft.mockResolvedValue({});
      render(<IcpFormPage />);
      type('icp-name', 'Mine');
      type('icp-brief', `  ${brief}  `);
      click('icp-draft-btn');
      await waitFor(() => expect(svc.draft).toHaveBeenCalledWith(brief, 'Mine'));
    });
  });
  describe('When Neura answers 422 (nothing usable) without a message', () => {
    it('Then the friendly retry message shows and the form is untouched', async () => {
      svc.draft.mockRejectedValue(Object.assign({}, { status: 422 }));
      render(<IcpFormPage />);
      type('icp-name', 'Keep');
      type('icp-brief', brief);
      click('icp-draft-btn');
      expect((await screen.findByTestId('icp-draft-error')).textContent).toBe('Neura could not draft a profile. Try again.');
      expect((screen.getByTestId('icp-name') as HTMLInputElement).value).toBe('Keep');
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
  describe('When Neura answers 422 with a server message', () => {
    it('Then that message is shown', async () => {
      svc.draft.mockRejectedValue(Object.assign(new Error('Could not extract criteria'), { status: 422 }));
      render(<IcpFormPage />);
      type('icp-brief', brief);
      click('icp-draft-btn');
      expect((await screen.findByTestId('icp-draft-error')).textContent).toBe('Could not extract criteria');
    });
  });
  describe('When the network fails', () => {
    it('Then the error is shown and Draft is enabled again for a retry', async () => {
      svc.draft.mockRejectedValue(new TypeError('Failed to fetch'));
      render(<IcpFormPage />);
      type('icp-brief', brief);
      click('icp-draft-btn');
      expect((await screen.findByTestId('icp-draft-error')).textContent).toBe('Failed to fetch');
      expect((screen.getByTestId('icp-draft-btn') as HTMLButtonElement).disabled).toBe(false);
    });
  });
  describe('When a failed draft is retried successfully', () => {
    it('Then the previous error is cleared', async () => {
      svc.draft.mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce({ name: 'Second' });
      render(<IcpFormPage />);
      type('icp-brief', brief);
      click('icp-draft-btn');
      await screen.findByTestId('icp-draft-error');
      click('icp-draft-btn');
      await screen.findByDisplayValue('Second');
      expect(screen.queryByTestId('icp-draft-error')).toBeNull();
    });
  });
  describe('When the draft has no usable criteria', () => {
    it('Then the existing criteria are kept while other fields are filled', async () => {
      svc.draft.mockResolvedValue({ name: 'Named', criteria: [] });
      render(<IcpFormPage />);
      type('icp-criterion-label-0', 'Mine');
      type('icp-brief', brief);
      click('icp-draft-btn');
      await screen.findByDisplayValue('Named');
      expect((screen.getByTestId('icp-criterion-label-0') as HTMLInputElement).value).toBe('Mine');
    });
  });
  describe('When the draft is applied and then saved after review', () => {
    it('Then the drafted criteria are what gets created', async () => {
      svc.draft.mockResolvedValue({
        name: 'Fintech CFOs',
        criteria: [
          { category: 'role', label: 'CFO', weight: 80, match_config: { keywords: ['cfo'] } },
          { category: 'industry', label: 'Fintech', weight: 30, match_config: { keywords: ['fintech'] }, is_positive: false },
        ],
      });
      render(<IcpFormPage />);
      type('icp-brief', brief);
      click('icp-draft-btn');
      await screen.findByDisplayValue('Fintech CFOs');
      expect(screen.getByTestId('icp-criterion-1')).toBeTruthy();
      click('icp-save');
      await waitFor(() => expect(svc.create).toHaveBeenCalled());
      expect(svc.create.mock.calls[0][0].criteria).toHaveLength(2);
      expect(svc.create.mock.calls[0][0].criteria[1].is_positive).toBe(false);
    });
  });
});
