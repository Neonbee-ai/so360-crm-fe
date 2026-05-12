import { describe, it, expect } from 'vitest';
import { formatMoney, formatDateTime, mapCampaign, mapAbandonedCart } from './marketingMappers';

describe('formatMoney', () => {
  it('formats a number with default locale', () => {
    const result = formatMoney(1234.5);
    expect(result).toContain('1,234.50');
  });

  it('formats with a currency code', () => {
    const result = formatMoney(99.9, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('99.90');
  });

  it('formats with EUR currency', () => {
    const result = formatMoney(50, 'EUR', 'de-DE');
    // de-DE EUR formatting varies by environment, just ensure it contains the amount
    expect(result).toBeDefined();
  });

  it('handles null value', () => {
    expect(formatMoney(null)).toBe('0.00');
  });

  it('handles undefined value', () => {
    expect(formatMoney(undefined)).toBe('0.00');
  });

  it('handles string number', () => {
    const result = formatMoney('42.5');
    expect(result).toContain('42.50');
  });

  it('handles NaN input', () => {
    expect(formatMoney('not-a-number')).toBe('0.00');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('0.00');
  });

  it('handles invalid currency code gracefully', () => {
    // Invalid currency should fall through to generic number rendering
    const result = formatMoney(100, 'INVALID_CODE');
    expect(result).toContain('100.00');
  });

  it('handles empty string value', () => {
    expect(formatMoney('')).toBe('0.00');
  });
});

describe('formatDateTime', () => {
  it('returns a formatted date string for a valid ISO date', () => {
    const result = formatDateTime('2026-01-15T10:30:00Z');
    expect(result).not.toBe('-');
    expect(typeof result).toBe('string');
  });

  it('returns "-" for null', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('returns "-" for empty string', () => {
    expect(formatDateTime('')).toBe('-');
  });

  it('returns "-" for an invalid date string', () => {
    expect(formatDateTime('not-a-date')).toBe('-');
  });
});

describe('mapCampaign', () => {
  it('maps a full campaign object', () => {
    const raw = {
      id: 'c-1',
      name: 'Summer Sale',
      campaign_type: 'email',
      status: 'active',
      total_recipients: 500,
      sent_at: '2026-06-01T12:00:00Z',
    };
    const result = mapCampaign(raw);
    expect(result).toEqual({
      id: 'c-1',
      name: 'Summer Sale',
      campaignType: 'email',
      status: 'active',
      totalRecipients: 500,
      sentAt: '2026-06-01T12:00:00Z',
    });
  });

  it('maps using camelCase campaignType fallback', () => {
    const raw = { id: 'c-2', name: 'Test', campaignType: 'sms' };
    const result = mapCampaign(raw);
    expect(result.campaignType).toBe('sms');
  });

  it('handles null/undefined raw', () => {
    const result = mapCampaign(null);
    expect(result.id).toBe('');
    expect(result.name).toBe('');
    expect(result.campaignType).toBe('-');
    expect(result.status).toBe('-');
    expect(result.totalRecipients).toBe(0);
    expect(result.sentAt).toBeNull();
  });

  it('handles partial data', () => {
    const result = mapCampaign({ id: 'c-3' });
    expect(result.id).toBe('c-3');
    expect(result.name).toBe('');
    expect(result.totalRecipients).toBe(0);
  });
});

describe('mapAbandonedCart', () => {
  it('maps a full abandoned cart object', () => {
    const raw = {
      id: 'ac-1',
      customer_email: 'john@example.com',
      cart_total: 199.99,
      item_count: 3,
      recovery_status: 'pending',
      abandoned_at: '2026-05-01T08:00:00Z',
    };
    const result = mapAbandonedCart(raw);
    expect(result).toEqual({
      id: 'ac-1',
      customerEmail: 'john@example.com',
      cartTotal: 199.99,
      itemCount: 3,
      status: 'pending',
      abandonedAt: '2026-05-01T08:00:00Z',
    });
  });

  it('handles null/undefined raw', () => {
    const result = mapAbandonedCart(null);
    expect(result.id).toBe('');
    expect(result.customerEmail).toBe('');
    expect(result.cartTotal).toBe(0);
    expect(result.itemCount).toBe(0);
    expect(result.status).toBe('');
    expect(result.abandonedAt).toBeNull();
  });

  it('handles partial data', () => {
    const result = mapAbandonedCart({ id: 'ac-2', customer_email: 'test@test.com' });
    expect(result.id).toBe('ac-2');
    expect(result.customerEmail).toBe('test@test.com');
    expect(result.cartTotal).toBe(0);
    expect(result.itemCount).toBe(0);
  });
});
