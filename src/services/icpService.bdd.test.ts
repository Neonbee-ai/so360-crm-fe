import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const neura = vi.hoisted(() => ({ post: vi.fn() }));
const mkt = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api, crmNeuraClient: neura, crmMarketingClient: mkt }));

import {
  icpService, toIcpBody, validateIcp, icpToForm, applyDraft, emptyIcpForm, emptyCriterion, ICP_CATEGORIES,
  categoryLabel, DEFAULT_MIN_SCORE,
} from './icpService';

beforeEach(() => vi.clearAllMocks());

const valid = () => ({
  ...emptyIcpForm(), name: '  Ent  ',
  criteria: [{ ...emptyCriterion(), label: ' CTO ', match_config: { keywords: ['cto'] } }],
});

describe('Given the ICP service', () => {
  describe('When listing', () => {
    it('Then GET /linkedin-sync/icps is called and a non-array reads as empty', async () => {
      api.get.mockResolvedValueOnce([{ id: 'a' }]);
      expect(await icpService.list()).toEqual([{ id: 'a' }]);
      expect(api.get).toHaveBeenCalledWith('/linkedin-sync/icps');
      api.get.mockResolvedValueOnce(null);
      expect(await icpService.list()).toEqual([]);
    });
  });

  describe('When creating, updating, archiving and setting default', () => {
    it('Then the right verbs and paths are used', async () => {
      await icpService.create(valid());
      expect(api.post.mock.calls[0][0]).toBe('/linkedin-sync/icps');
      await icpService.update('i1', valid());
      expect(api.put.mock.calls[0][0]).toBe('/linkedin-sync/icps/i1');
      await icpService.setDefault('i1');
      expect(api.put).toHaveBeenLastCalledWith('/linkedin-sync/icps/i1', { is_default: true });
      await icpService.archive('i1');
      expect(api.delete).toHaveBeenCalledWith('/linkedin-sync/icps/i1');
    });
  });

  describe('When drafting with Neura', () => {
    it('Then draft-icp is posted to the Neura client with an optional trimmed name', async () => {
      await icpService.draft('CFOs', ' ');
      expect(neura.post).toHaveBeenCalledWith('/linkedin-ai/draft-icp', { description: 'CFOs' });
      await icpService.draft('CFOs', ' Fin ');
      expect(neura.post).toHaveBeenLastCalledWith('/linkedin-ai/draft-icp', { description: 'CFOs', name: 'Fin' });
    });
  });

  describe('When loading Marketing audiences', () => {
    it('Then marketing-be GET /v1/marketing/audiences is called and a bare array is returned', async () => {
      mkt.get.mockResolvedValueOnce([{ id: 'a', name: 'A' }]);
      expect(await icpService.audiences()).toEqual([{ id: 'a', name: 'A' }]);
      expect(mkt.get).toHaveBeenLastCalledWith('/v1/marketing/audiences');
    });
    it('Then a { data: [] } envelope is unwrapped', async () => {
      mkt.get.mockResolvedValueOnce({ data: [{ id: 'd', name: 'D' }] });
      expect(await icpService.audiences()).toEqual([{ id: 'd', name: 'D' }]);
    });
    it('Then an { items: [] } envelope is unwrapped', async () => {
      mkt.get.mockResolvedValueOnce({ items: [{ id: 'i', name: 'I' }] });
      expect(await icpService.audiences()).toEqual([{ id: 'i', name: 'I' }]);
    });
  });
  describe('When a legacy auto_segment_id is on the form', () => {
    it('Then toIcpBody never sends auto_segment_id', () => {
      const body = toIcpBody({ ...valid(), auto_audience_id: 'a', auto_segment_min_score: 80, auto_segment_id: 'old' } as any);
      expect(body).not.toHaveProperty('auto_segment_id');
      expect(body.auto_audience_id).toBe('a');
    });
  });
});

describe('Given toIcpBody', () => {
  it('When no segment is chosen Then auto fields are null', () => {
    const b = toIcpBody(valid());
    expect(b).toMatchObject({ name: 'Ent', auto_audience_id: null, auto_segment_min_score: null });
    expect(b.criteria[0]).toEqual({ category: 'role', label: 'CTO', weight: 50, match_config: { keywords: ['cto'] }, is_positive: true });
  });
  it('When a segment is chosen Then score defaults to 70 and is clamped to 1..100', () => {
    expect(toIcpBody({ ...valid(), auto_audience_id: 's' , auto_segment_min_score: null }).auto_segment_min_score).toBe(70);
    expect(toIcpBody({ ...valid(), auto_audience_id: 's', auto_segment_min_score: 500 }).auto_segment_min_score).toBe(100);
    expect(toIcpBody({ ...valid(), auto_audience_id: 's', auto_segment_min_score: 0 }).auto_segment_min_score).toBe(1);
  });
});

describe('Given validateIcp', () => {
  it('When the form is valid Then there are no errors', () => expect(validateIcp(valid())).toEqual({}));
  it('When name is blank Then name error', () => expect(validateIcp({ ...valid(), name: ' ' }).name).toBeTruthy());
  it('When there are no criteria Then criteria error', () => expect(validateIcp({ ...valid(), criteria: [] }).criteria).toBeTruthy());
  it('When a criterion has no label Then criteria error', () => {
    const v = valid(); v.criteria[0].label = ' ';
    expect(validateIcp(v).criteria).toBeTruthy();
  });
  it('When weight is 0, 101 or NaN Then weight error; 1 and 100 pass', () => {
    for (const w of [0, 101, NaN]) { const v = valid(); v.criteria[0].weight = w; expect(validateIcp(v).weights).toBeTruthy(); }
    for (const w of [1, 100]) { const v = valid(); v.criteria[0].weight = w; expect(validateIcp(v).weights).toBeUndefined(); }
  });
});

describe('Given icpToForm and applyDraft', () => {
  it('When a saved ICP is mapped Then fields and criteria are prefilled', () => {
    const f = icpToForm({
      id: 'i', name: 'N', is_default: true, auto_audience_id: 's', auto_segment_min_score: 90,
      icp_criteria: [{ id: 'c', category: 'location', label: 'UAE', weight: 20, match_config: { keywords: ['dubai'] }, is_positive: false }],
    });
    expect(f).toMatchObject({ name: 'N', is_default: true, auto_audience_id: 's', auto_segment_min_score: 90 });
    expect(f.criteria[0]).toMatchObject({ category: 'location', is_positive: false });
  });
  it('When a draft has unknown categories and wild weights Then they are normalised', () => {
    const f = applyDraft(emptyIcpForm(), {
      name: 'D', criteria: [{ category: 'weird', label: 'x', weight: 900, match_config: { keywords: ['a'] } }],
    });
    expect(f.criteria[0]).toMatchObject({ category: 'role', weight: 100, is_positive: true });
    expect(f.name).toBe('D');
  });
  it('When a draft has no criteria Then the current criteria are kept', () => {
    const cur = emptyIcpForm();
    expect(applyDraft(cur, { name: 'Z' }).criteria).toEqual(cur.criteria);
  });
  it('Then the category list has the six friendly labels', () => {
    expect(ICP_CATEGORIES.map((c) => c.label)).toEqual(
      ['Job title', 'Company', 'Industry', 'Location', 'Headline keywords', 'About keywords']);
  });
});

describe('Given service request payloads and error propagation', () => {
  describe('When create and update are called', () => {
    it('Then the body is the mapped form body and the response is returned', async () => {
      api.post.mockResolvedValueOnce({ id: 'new' });
      api.put.mockResolvedValueOnce({ id: 'i1' });
      const v = { ...valid(), is_default: true, auto_audience_id: 's1', auto_segment_min_score: 85 };
      expect(await icpService.create(v)).toEqual({ id: 'new' });
      expect(api.post).toHaveBeenCalledWith('/linkedin-sync/icps', toIcpBody(v));
      expect(await icpService.update('i1', v)).toEqual({ id: 'i1' });
      expect(api.put).toHaveBeenCalledWith('/linkedin-sync/icps/i1', toIcpBody(v));
      expect(toIcpBody(v)).toMatchObject({ is_default: true, auto_audience_id: 's1', auto_segment_min_score: 85 });
    });
  });

  describe('When the auto segment is cleared on update', () => {
    it('Then both auto fields are sent as null even if a stale score remains', async () => {
      await icpService.update('i1', { ...valid(), auto_audience_id: null, auto_segment_min_score: 90 });
      expect(api.put.mock.calls[0][1]).toMatchObject({ auto_audience_id: null, auto_segment_min_score: null });
    });
  });

  describe('When the response of archive is returned', () => {
    it('Then it is passed through', async () => {
      api.delete.mockResolvedValueOnce({ ok: true });
      expect(await icpService.archive('i1')).toEqual({ ok: true });
    });
  });

  describe('When the backend rejects', () => {
    it('Then every method propagates the error', async () => {
      const err = new Error('boom');
      api.get.mockRejectedValueOnce(err);
      await expect(icpService.list()).rejects.toBe(err);
      api.post.mockRejectedValueOnce(err);
      await expect(icpService.create(valid())).rejects.toBe(err);
      api.put.mockRejectedValueOnce(err);
      await expect(icpService.update('i1', valid())).rejects.toBe(err);
      api.put.mockRejectedValueOnce(err);
      await expect(icpService.setDefault('i1')).rejects.toBe(err);
      api.delete.mockRejectedValueOnce(err);
      await expect(icpService.archive('i1')).rejects.toBe(err);
      mkt.get.mockRejectedValueOnce(err);
      await expect(icpService.audiences()).rejects.toBe(err);
      neura.post.mockRejectedValueOnce(err);
      await expect(icpService.draft('x')).rejects.toBe(err);
    });
  });

  describe('When audiences returns a non-array', () => {
    it('Then it reads as empty', async () => {
      mkt.get.mockResolvedValueOnce(undefined);
      expect(await icpService.audiences()).toEqual([]);
    });
  });

  describe('When drafting without a name argument', () => {
    it('Then only the description is sent and the draft is returned (422 propagates)', async () => {
      neura.post.mockResolvedValueOnce({ name: 'D' });
      expect(await icpService.draft('CFOs')).toEqual({ name: 'D' });
      expect(neura.post).toHaveBeenCalledWith('/linkedin-ai/draft-icp', { description: 'CFOs' });
      const e422 = Object.assign(new Error('Neura could not draft'), { status: 422 });
      neura.post.mockRejectedValueOnce(e422);
      await expect(icpService.draft('CFOs', 'N')).rejects.toMatchObject({ status: 422 });
    });
  });
});

describe('Given toIcpBody optional text fields', () => {
  it('When description and persona are blank Then they are undefined; when set they are trimmed', () => {
    expect(toIcpBody(valid())).toMatchObject({ description: undefined, target_persona: undefined });
    const b = toIcpBody({ ...valid(), description: ' d ', target_persona: ' p ' });
    expect(b).toMatchObject({ description: 'd', target_persona: 'p' });
  });
  it('When the min score is fractional or in range Then it is rounded / kept', () => {
    expect(toIcpBody({ ...valid(), auto_audience_id: 's', auto_segment_min_score: 55.6 }).auto_segment_min_score).toBe(56);
    expect(toIcpBody({ ...valid(), auto_audience_id: 's', auto_segment_min_score: 1 }).auto_segment_min_score).toBe(1);
    expect(toIcpBody({ ...valid(), auto_audience_id: 's', auto_segment_min_score: 100 }).auto_segment_min_score).toBe(100);
  });
  it('When is_positive is false Then it is kept in the body', () => {
    const v = valid(); v.criteria[0].is_positive = false;
    expect(toIcpBody(v).criteria[0].is_positive).toBe(false);
  });
});

describe('Given icpToForm defaults and normalisation', () => {
  it('When optional fields are missing Then defaults apply', () => {
    const f = icpToForm({ id: 'i', name: undefined as any, is_default: undefined as any });
    expect(f).toEqual({
      name: '', description: '', target_persona: '', is_default: false, criteria: [],
      auto_audience_id: null, auto_segment_min_score: 70,
    });
  });
  it('When null description and persona Then empty strings', () => {
    const f = icpToForm({ id: 'i', name: 'N', is_default: false, description: null, target_persona: null });
    expect(f).toMatchObject({ description: '', target_persona: '' });
  });
  it('When description and persona are set Then they are kept', () => {
    expect(icpToForm({ id: 'i', name: 'N', is_default: false, description: 'd', target_persona: 'p' }))
      .toMatchObject({ description: 'd', target_persona: 'p' });
  });
  it('When a segment is set without a score Then the score defaults to 70', () => {
    expect(icpToForm({ id: 'i', name: 'N', is_default: false, auto_audience_id: 's', auto_segment_min_score: null }).auto_segment_min_score).toBe(70);
  });
  it('When no segment but a stale score Then the score is kept; null score defaults', () => {
    expect(icpToForm({ id: 'i', name: 'N', is_default: false, auto_audience_id: null, auto_segment_min_score: 40 }).auto_segment_min_score).toBe(40);
    expect(icpToForm({ id: 'i', name: 'N', is_default: false, auto_audience_id: null, auto_segment_min_score: null }).auto_segment_min_score).toBe(70);
  });
  it('When a criterion is sparse Then it is normalised (no id, role, empty label, weight 50, no keywords, positive)', () => {
    const f = icpToForm({ id: 'i', name: 'N', is_default: false, icp_criteria: [{} as any] });
    expect(f.criteria[0]).toEqual({ category: 'role', label: '', weight: 50, match_config: { keywords: [] }, is_positive: true });
  });
  it('When a criterion has an id, null label, non-array keywords and fractional weight Then normalised', () => {
    const f = icpToForm({
      id: 'i', name: 'N', is_default: false,
      icp_criteria: [
        { id: 'c', category: 'company', label: null as any, weight: 33.6, match_config: { keywords: 'x' as any }, is_positive: true },
        { category: 'industry', label: 'L', weight: 'abc' as any, match_config: { keywords: [1, 'b'] as any }, is_positive: false },
        { category: 'location', label: 'L', weight: -5, match_config: undefined as any, is_positive: true },
      ],
    });
    expect(f.criteria[0]).toEqual({ id: 'c', category: 'company', label: '', weight: 34, match_config: { keywords: [] }, is_positive: true });
    expect(f.criteria[1]).toMatchObject({ weight: 50, match_config: { keywords: ['1', 'b'] }, is_positive: false });
    expect(f.criteria[2]).toMatchObject({ weight: 1, match_config: { keywords: [] } });
  });
});

describe('Given applyDraft merging', () => {
  it('When the draft has empty name/description/persona Then current values are kept / overwritten as specified', () => {
    const cur = { ...emptyIcpForm(), name: 'Mine', description: 'cur d', target_persona: 'cur p' };
    const keep = applyDraft(cur, { name: '' });
    expect(keep).toMatchObject({ name: 'Mine', description: 'cur d', target_persona: 'cur p' });
    const over = applyDraft(cur, { name: 'New', description: 'nd', target_persona: 'np' });
    expect(over).toMatchObject({ name: 'New', description: 'nd', target_persona: 'np' });
  });
  it('When the draft criteria is an empty array Then current criteria are kept', () => {
    const cur = emptyIcpForm();
    expect(applyDraft(cur, { criteria: [] }).criteria).toEqual(cur.criteria);
  });
  it('When the draft is an empty object Then the form is unchanged', () => {
    const cur = emptyIcpForm();
    expect(applyDraft(cur, {})).toEqual(cur);
  });
});

describe('Given the factory helpers', () => {
  it('Then emptyIcpForm has one blank positive criterion, no segment and score 70', () => {
    expect(emptyIcpForm()).toEqual({
      name: '', description: '', target_persona: '', is_default: false,
      criteria: [{ category: 'role', label: '', weight: 50, match_config: { keywords: [] }, is_positive: true }],
      auto_audience_id: null, auto_segment_min_score: DEFAULT_MIN_SCORE,
    });
  });
  it('Then categoryLabel maps known values and falls back to the raw value', () => {
    expect(categoryLabel('industry')).toBe('Industry');
    expect(categoryLabel('mystery')).toBe('mystery');
  });
});
