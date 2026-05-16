import { describe, it, expect } from 'vitest';
import { formatMoney, formatDateTime, mapCampaign, mapAbandonedCart } from './marketingMappers';

describe('formatMoney', () => {
  describe('Given a numeric dollar amount', () => {
    it('When formatted with no currency / Then returns a locale-formatted decimal string', () => {
      const result = formatMoney(1234.5);
      expect(result).toContain('1,234.50');
    });

    it('When formatted with USD currency / Then includes the dollar sign', () => {
      const result = formatMoney(99.9, 'USD');
      expect(result).toContain('$');
      expect(result).toContain('99.90');
    });

    it('When formatted with zero value / Then returns 0.00', () => {
      expect(formatMoney(0)).toBe('0.00');
    });
  });

  describe('Given a missing or invalid value', () => {
    it('When value is null / Then returns 0.00', () => {
      expect(formatMoney(null)).toBe('0.00');
    });

    it('When value is undefined / Then returns 0.00', () => {
      expect(formatMoney(undefined)).toBe('0.00');
    });

    it('When value is a non-numeric string / Then returns 0.00', () => {
      expect(formatMoney('not-a-number')).toBe('0.00');
    });

    it('When value is an empty string / Then returns 0.00', () => {
      expect(formatMoney('')).toBe('0.00');
    });
  });

  describe('Given a string number', () => {
    it('When a numeric string is passed / Then formats it correctly', () => {
      expect(formatMoney('42.5')).toContain('42.50');
    });
  });

  describe('Given an invalid currency code', () => {
    it('When an unknown currency is used / Then falls back to plain number format', () => {
      const result = formatMoney(100, 'INVALID_CODE');
      expect(result).toContain('100.00');
    });
  });
});

describe('formatDateTime', () => {
  describe('Given a valid ISO date string', () => {
    it('When formatted / Then returns a non-empty date string', () => {
      const result = formatDateTime('2026-01-15T10:30:00Z');
      expect(result).not.toBe('-');
      expect(typeof result).toBe('string');
    });
  });

  describe('Given a missing or invalid value', () => {
    it('When value is null / Then returns -', () => {
      expect(formatDateTime(null)).toBe('-');
    });

    it('When value is undefined / Then returns -', () => {
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('When value is empty string / Then returns -', () => {
      expect(formatDateTime('')).toBe('-');
    });

    it('When value is an invalid date string / Then returns -', () => {
      expect(formatDateTime('not-a-date')).toBe('-');
    });
  });
});

describe('mapCampaign', () => {
  describe('Given a fully-populated raw campaign object', () => {
    it('When mapped / Then maps id, name, status and totalRecipients correctly', () => {
      const raw = {
        id: 'c-1', name: 'Summer Sale', campaign_type: 'email',
        status: 'sent', total_recipients: 500, sent_at: '2026-01-10T09:00:00Z',
      };
      const vm = mapCampaign(raw);
      expect(vm.id).toBe('c-1');
      expect(vm.name).toBe('Summer Sale');
      expect(vm.campaignType).toBe('email');
      expect(vm.status).toBe('sent');
      expect(vm.totalRecipients).toBe(500);
      expect(vm.sentAt).toBe('2026-01-10T09:00:00Z');
    });
  });

  describe('Given a raw campaign with missing optional fields', () => {
    it('When mapped / Then uses default placeholder values', () => {
      const vm = mapCampaign({});
      expect(vm.id).toBe('');
      expect(vm.name).toBe('');
      expect(vm.campaignType).toBe('-');
      expect(vm.status).toBe('-');
      expect(vm.totalRecipients).toBe(0);
      expect(vm.sentAt).toBeNull();
    });
  });

  describe('Given a null raw campaign', () => {
    it('When mapped with null / Then returns safe defaults', () => {
      const vm = mapCampaign(null);
      expect(vm.id).toBe('');
      expect(vm.name).toBe('');
      expect(vm.totalRecipients).toBe(0);
    });
  });
});

describe('mapAbandonedCart', () => {
  describe('Given a fully-populated raw abandoned cart', () => {
    it('When mapped / Then maps all fields correctly', () => {
      const raw = {
        id: 'ac-1', customer_email: 'jane@test.com',
        cart_total: 250.5, item_count: 3,
        recovery_status: 'pending', abandoned_at: '2026-01-10T12:00:00Z',
      };
      const vm = mapAbandonedCart(raw);
      expect(vm.id).toBe('ac-1');
      expect(vm.customerEmail).toBe('jane@test.com');
      expect(vm.cartTotal).toBe(250.5);
      expect(vm.itemCount).toBe(3);
      expect(vm.status).toBe('pending');
      expect(vm.abandonedAt).toBe('2026-01-10T12:00:00Z');
    });
  });

  describe('Given a raw abandoned cart with missing fields', () => {
    it('When mapped with an empty object / Then returns safe defaults', () => {
      const vm = mapAbandonedCart({});
      expect(vm.id).toBe('');
      expect(vm.customerEmail).toBe('');
      expect(vm.cartTotal).toBe(0);
      expect(vm.itemCount).toBe(0);
      expect(vm.status).toBe('');
      expect(vm.abandonedAt).toBeNull();
    });
  });
});
