/**
 * Feature: lead-set changes are broadcast, and only when they really happened
 *
 * Every lead-derived number in the app (grid count, dashboard KPIs, pipeline
 * widgets) is read from the server. The server already excludes soft-deleted
 * leads, so the only reason a stale count stayed on screen was that nothing
 * told those surfaces to re-read. This topic is that signal — and it must fire
 * for confirmed deletions only, never for an optimistic UI removal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LEADS_CHANGED_TOPIC,
  publishLeadsChanged,
  onLeadsChanged,
} from './leadEvents';

describe('Feature: crm:leads:changed broadcast', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Scenario: a lead is deleted', () => {
    it('When ids are published / Then subscribers receive the reason and the ids', () => {
      const handler = vi.fn();
      const off = onLeadsChanged(handler);

      publishLeadsChanged('deleted', ['l1', 'l2']);

      expect(handler).toHaveBeenCalledWith({ reason: 'deleted', ids: ['l1', 'l2'] });
      off();
    });

    it('When a lead is restored / Then the reason distinguishes it from a deletion', () => {
      const handler = vi.fn();
      const off = onLeadsChanged(handler);

      publishLeadsChanged('restored', ['l1']);

      expect(handler).toHaveBeenCalledWith({ reason: 'restored', ids: ['l1'] });
      off();
    });
  });

  describe('Scenario: nothing actually changed', () => {
    it('When the id list is empty / Then nothing is published', () => {
      // A bulk delete where the server confirmed nothing must not make the
      // dashboard re-read as if a lead had gone.
      const handler = vi.fn();
      const off = onLeadsChanged(handler);

      publishLeadsChanged('deleted', []);

      expect(handler).not.toHaveBeenCalled();
      off();
    });

    it('When the id list is missing entirely / Then it does not throw', () => {
      expect(() => publishLeadsChanged('deleted', undefined as any)).not.toThrow();
    });
  });

  describe('Scenario: subscriber lifecycle', () => {
    it('When a subscriber unsubscribes / Then it stops receiving events', () => {
      const handler = vi.fn();
      const off = onLeadsChanged(handler);

      off();
      publishLeadsChanged('deleted', ['l1']);

      expect(handler).not.toHaveBeenCalled();
    });

    it('Given the topic name / Then it is namespaced to the CRM module', () => {
      // The topic crosses the MFE boundary, so the name is part of the
      // contract with the shell and any other listening remote.
      expect(LEADS_CHANGED_TOPIC).toBe('crm:leads:changed');
    });
  });
});
