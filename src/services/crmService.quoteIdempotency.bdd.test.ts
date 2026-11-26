/** crmService.createQuote — Idempotency-Key header (Pulse 3f510e56). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { crmService } from './crmService';

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 201,
    text: () => Promise.resolve(JSON.stringify({ id: 'q-1' })),
    json: () => Promise.resolve({ id: 'q-1' }),
  });
});

const sentHeaders = () => fetchMock.mock.calls[0][1].headers as Record<string, string>;

describe('crmService.createQuote', () => {
  it('Given an idempotency key / When the quote is created / Then POST /quotes carries Idempotency-Key and the usual headers', async () => {
    await crmService.createQuote({ deal_id: 'deal-1' }, { idempotencyKey: 'key-1' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/quotes$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(sentHeaders()['Idempotency-Key']).toBe('key-1');
    expect(sentHeaders()['Content-Type']).toBe('application/json');
  });

  it('Given no idempotency key / When the quote is created / Then no Idempotency-Key header is sent', async () => {
    await crmService.createQuote({ deal_id: 'deal-1' });
    expect(sentHeaders()).not.toHaveProperty('Idempotency-Key');
  });
});
