import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./crmService', () => ({ crmCoreClient: { get: (...a: any[]) => get(...a), post: (...a: any[]) => post(...a), getOrgId: () => 'org-1' } }));

import { contactFeed, priceLists, documentLayouts, QUOTE_DOC_TYPE } from './coreS2sService';

beforeEach(() => vi.clearAllMocks());

describe('Given the Core Contact 360 feed', () => {
  describe('When grouped() succeeds', () => {
    it('Then it requests the org-scoped route and returns the groups', async () => {
      get.mockResolvedValue({ total: 2, groups: { order: { count: 2, items: [] } } });
      const r = await contactFeed.grouped('lead', 'l1');
      expect(get).toHaveBeenCalledWith('/v1/entity-links/lead/l1/grouped?org_id=org-1');
      expect(r.total).toBe(2);
    });
    it('Then missing fields default to an empty feed', async () => {
      get.mockResolvedValue(undefined);
      expect(await contactFeed.grouped('lead', 'l1')).toEqual({ total: 0, groups: {}, entity: undefined });
    });
  });
  describe('When Core fails', () => {
    it('Then an empty feed is returned', async () => {
      get.mockRejectedValue(new Error('boom'));
      expect(await contactFeed.grouped('lead', 'l1')).toEqual({ total: 0, groups: {} });
    });
  });
});

describe('Given price lists', () => {
  it('When list() succeeds Then active lists are requested, scoped to the customer', async () => {
    get.mockResolvedValue([{ id: 'p1', name: 'Gold' }]);
    expect(await priceLists.list('c1')).toHaveLength(1);
    expect(get.mock.calls[0][0]).toContain('/filter/all?active=true&customer_id=c1');
  });
  it('When list() gets a non-array or fails Then it returns []', async () => {
    get.mockResolvedValueOnce({});
    expect(await priceLists.list()).toEqual([]);
    get.mockRejectedValueOnce(new Error('x'));
    expect(await priceLists.list()).toEqual([]);
  });
  it('When resolveOne() finds a price Then it is returned', async () => {
    post.mockResolvedValue({ prices: [{ item_id: 'i1', price: 9 }] });
    expect(await priceLists.resolveOne('i1', { qty: 3 })).toEqual({ item_id: 'i1', price: 9 });
    expect(post).toHaveBeenCalledWith('/v1/products/price-lists/org-1/resolve', { item_ids: ['i1'], qty: 3 });
  });
  it('When the price is null, absent, or the call fails Then it returns null', async () => {
    post.mockResolvedValueOnce({ prices: [{ item_id: 'i1', price: null }] });
    expect(await priceLists.resolveOne('i1')).toBeNull();
    post.mockResolvedValueOnce({});
    expect(await priceLists.resolveOne('i1')).toBeNull();
    post.mockRejectedValueOnce(new Error('x'));
    expect(await priceLists.resolveOne('i1')).toBeNull();
  });
});

describe('Given document layouts', () => {
  it('When render() succeeds Then the HTML is returned', async () => {
    post.mockResolvedValue({ html: '<p>q</p>' });
    expect(await documentLayouts.render(QUOTE_DOC_TYPE, { number: 'Q1' })).toBe('<p>q</p>');
    expect(post).toHaveBeenCalledWith('/v1/documents/layouts/org-1/render', { doc_type: 'sales_quote', document: { number: 'Q1' } });
  });
  it('When there is no html or the call fails Then it returns null', async () => {
    post.mockResolvedValueOnce({});
    expect(await documentLayouts.render('sales_quote', {})).toBeNull();
    post.mockRejectedValueOnce(new Error('x'));
    expect(await documentLayouts.render('sales_quote', {})).toBeNull();
  });
});
