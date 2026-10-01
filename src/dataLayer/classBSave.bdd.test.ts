import { describe, it, expect, vi, beforeEach } from 'vitest';

// Class B save path: error mapping, version wiring and response fallbacks.

const api = vi.hoisted(() => ({
  lead: vi.fn(),
  deal: vi.fn(),
  partner: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  leadsApi: { update: (...a: unknown[]) => api.lead(...a) },
  dealsApi: { update: (...a: unknown[]) => api.deal(...a) },
  partnersApi: { update: (...a: unknown[]) => api.partner(...a) },
}));

import {
  saveClassBCustomFields,
  isVersionConflict,
  wireVersion,
  recordVersion,
  classBVersionOf,
  currentClassBValues,
  classBRecordView,
} from './classBSave';

beforeEach(() => {
  api.lead.mockReset();
  api.deal.mockReset();
  api.partner.mockReset();
});

describe('Feature: Class B version helpers', () => {
  describe('Scenario: wire version derivation', () => {
    it('then integers pass, digit strings are parsed and anything else is dropped', () => {
      // Given / When / Then
      expect(wireVersion(4)).toBe(4);
      expect(wireVersion(4.5)).toBeUndefined();
      expect(wireVersion('12')).toBe(12);
      expect(wireVersion('2024-01-01T00:00:00Z')).toBeUndefined();
      expect(wireVersion(null)).toBeUndefined();
      expect(wireVersion(undefined)).toBeUndefined();
    });
  });

  describe('Scenario: record version fallback', () => {
    it('then custom_fields_version wins, else updated_at, else null', () => {
      expect(recordVersion(null)).toBeNull();
      expect(recordVersion({ custom_fields_version: 3, updated_at: 'x' })).toBe(3);
      expect(recordVersion({ updated_at: 'x' })).toBe('x');
      expect(recordVersion({})).toBeNull();
      expect(classBVersionOf({ custom_fields_version: '3' })).toBeNull();
    });
  });

  describe('Scenario: current values view', () => {
    it('then leads read class_b_custom_fields and non-object values become empty', () => {
      expect(currentClassBValues('crm.lead', { class_b_custom_fields: { a: 1 }, custom_fields: { b: 2 } })).toEqual({ a: 1 });
      expect(currentClassBValues('crm.deal', { custom_fields: [1] })).toEqual({});
      expect(currentClassBValues('crm.deal', null)).toEqual({});
      expect(classBRecordView('crm.deal', null)).toBeNull();
    });
  });
});

describe('Feature: Version conflict detection', () => {
  describe('Scenario: conflict signalled in different error shapes', () => {
    it('then status, statusCode, response.status, body.code, response.data.code and body.error are all recognised', () => {
      // Given error shapes from fetch wrappers, axios and Nest
      expect(isVersionConflict({ status: 409 })).toBe(true);
      expect(isVersionConflict({ statusCode: 409 })).toBe(true);
      expect(isVersionConflict({ response: { status: 409 } })).toBe(true);
      expect(isVersionConflict({ code: 'DATASET_VERSION_CONFLICT' })).toBe(true);
      expect(isVersionConflict({ body: { code: 'DATASET_VERSION_CONFLICT' } })).toBe(true);
      expect(isVersionConflict({ response: { data: { error: 'DATASET_VERSION_CONFLICT' } } })).toBe(true);
    });

    it('then non-conflict and malformed errors are not conflicts', () => {
      expect(isVersionConflict({ status: '409' })).toBe(false);
      expect(isVersionConflict({ code: 409 })).toBe(false);
      expect(isVersionConflict(null)).toBe(false);
      expect(isVersionConflict({ status: 400, body: { code: 'DATASET_FIELD_REQUIRED' } })).toBe(false);
    });
  });
});

describe('Feature: Saving Class B custom fields', () => {
  describe('Given the version argument is omitted', () => {
    it('then the version is derived from the current record', async () => {
      api.deal.mockResolvedValue({ id: 'd1', custom_fields: { a: 1 }, custom_fields_version: 8 });
      // When
      const res = await saveClassBCustomFields('crm.deal', 'd1', { custom_fields_version: 7 }, { a: 1 });
      // Then
      expect(api.deal).toHaveBeenCalledWith('d1', { custom_fields: { a: 1 }, version: 7 });
      expect(res).toEqual({ ok: true, record: { id: 'd1', custom_fields: { a: 1 }, custom_fields_version: 8 } });
    });

    it('then a record with only updated_at sends no version', async () => {
      api.partner.mockResolvedValue({ id: 'p1', custom_fields: { a: 1 } });
      await saveClassBCustomFields('core.partner', 'p1', { updated_at: '2024-01-01' }, { a: 1 });
      expect(api.partner).toHaveBeenCalledWith('p1', { custom_fields: { a: 1 } });
    });
  });

  describe('Given a digit-string version is passed explicitly', () => {
    it('then it is sent as a number', async () => {
      api.lead.mockResolvedValue({ id: 'l1', class_b_custom_fields: { a: 1 } });
      const res = await saveClassBCustomFields('crm.lead', 'l1', null, { a: 1 }, '5');
      expect(api.lead).toHaveBeenCalledWith('l1', { custom_fields: { a: 1 }, version: 5 });
      expect(res.record).toEqual({ id: 'l1', class_b_custom_fields: { a: 1 }, custom_fields: { a: 1 } });
    });
  });

  describe('Given the response lacks the Class B values', () => {
    it('then a lead response without class_b_custom_fields merges onto the current row', async () => {
      api.lead.mockResolvedValue({ id: 'l1', updated_at: 'u2' });
      const res = await saveClassBCustomFields(
        'crm.lead', 'l1', { id: 'l1', class_b_custom_fields: { a: 1, b: 2 } }, { b: null, c: 3 }, null,
      );
      expect(res).toEqual({
        ok: true,
        record: { id: 'l1', class_b_custom_fields: { a: 1, b: 2 }, updated_at: 'u2', custom_fields: { a: 1, c: 3 } },
      });
    });

    it('then a non-object response keeps the current row with the locally merged values', async () => {
      api.deal.mockResolvedValue('OK');
      const res = await saveClassBCustomFields('crm.deal', 'd1', { id: 'd1', custom_fields: { a: 1 } }, { a: 2 }, 1);
      expect(res).toEqual({ ok: true, record: { id: 'd1', custom_fields: { a: 2 } } });
    });

    it('then a null response with no current row yields only the changed values', async () => {
      api.partner.mockResolvedValue(null);
      const res = await saveClassBCustomFields('core.partner', 'p1', null, { a: 2 }, 1);
      expect(res).toEqual({ ok: true, record: { custom_fields: { a: 2 } } });
    });
  });

  describe('Given the backend rejects with 409 DATASET_VERSION_CONFLICT', () => {
    it('then the result is a conflict carrying the joined validation message', async () => {
      api.deal.mockRejectedValue({ response: { status: 409, data: { message: ['stale', 'reload'] } } });
      const res = await saveClassBCustomFields('crm.deal', 'd1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, conflict: true, error: 'stale; reload' });
    });
  });

  describe('Given the backend rejects with 400 DATASET_FIELD_*', () => {
    it('then the body message is returned verbatim', async () => {
      api.lead.mockRejectedValue({ status: 400, body: { code: 'DATASET_FIELD_TYPE', message: 'Plate must be text' } });
      const res = await saveClassBCustomFields('crm.lead', 'l1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Plate must be text' });
    });

    it('then a blank body message falls back to the error message', async () => {
      api.lead.mockRejectedValue({ status: 400, body: { message: '   ' }, message: 'Bad Request' });
      const res = await saveClassBCustomFields('crm.lead', 'l1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Bad Request' });
    });
  });

  describe('Given an error with no usable message', () => {
    it('then the default message is used', async () => {
      api.partner.mockRejectedValue({ message: '  ' });
      const res = await saveClassBCustomFields('core.partner', 'p1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Failed to save custom fields' });
    });

    it('then a null rejection also uses the default message', async () => {
      api.partner.mockRejectedValue(null);
      const res = await saveClassBCustomFields('core.partner', 'p1', null, { a: 1 }, 1);
      expect(res).toEqual({ ok: false, error: 'Failed to save custom fields' });
    });
  });
});
