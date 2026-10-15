import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const neura = vi.hoisted(() => ({ post: vi.fn() }));
const crm = vi.hoisted(() => ({ getCustomerSegments: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api, crmNeuraClient: neura, crmService: crm }));

import {
  icpService, toIcpBody, validateIcp, icpToForm, applyDraft, emptyIcpForm, emptyCriterion, ICP_CATEGORIES,
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

  describe('When loading segments', () => {
    it('Then the existing customer-segments client is reused', async () => {
      crm.getCustomerSegments.mockResolvedValueOnce([{ id: 's', name: 'S' }]);
      expect(await icpService.segments()).toEqual([{ id: 's', name: 'S' }]);
    });
  });
});

describe('Given toIcpBody', () => {
  it('When no segment is chosen Then auto fields are null', () => {
    const b = toIcpBody(valid());
    expect(b).toMatchObject({ name: 'Ent', auto_segment_id: null, auto_segment_min_score: null });
    expect(b.criteria[0]).toEqual({ category: 'role', label: 'CTO', weight: 50, match_config: { keywords: ['cto'] }, is_positive: true });
  });
  it('When a segment is chosen Then score defaults to 70 and is clamped to 1..100', () => {
    expect(toIcpBody({ ...valid(), auto_segment_id: 's' , auto_segment_min_score: null }).auto_segment_min_score).toBe(70);
    expect(toIcpBody({ ...valid(), auto_segment_id: 's', auto_segment_min_score: 500 }).auto_segment_min_score).toBe(100);
    expect(toIcpBody({ ...valid(), auto_segment_id: 's', auto_segment_min_score: 0 }).auto_segment_min_score).toBe(1);
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
      id: 'i', name: 'N', is_default: true, auto_segment_id: 's', auto_segment_min_score: 90,
      icp_criteria: [{ id: 'c', category: 'location', label: 'UAE', weight: 20, match_config: { keywords: ['dubai'] }, is_positive: false }],
    });
    expect(f).toMatchObject({ name: 'N', is_default: true, auto_segment_id: 's', auto_segment_min_score: 90 });
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
