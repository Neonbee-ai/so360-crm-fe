import { eventBus } from '@so360/event-bus';

/**
 * Broadcast when the set of active leads changes (delete / restore).
 *
 * Lead counts live in several places at once — the Leads grid, the CRM
 * dashboard KPIs, pipeline/stage widgets. The backend already excludes
 * soft-deleted leads from every query, so those surfaces only ever showed a
 * stale number because nothing told them to re-read. This topic is that
 * signal: publish after the server confirms, subscribe wherever a lead-derived
 * number is rendered.
 */
export const LEADS_CHANGED_TOPIC = 'crm:leads:changed';

export type LeadsChangedReason = 'deleted' | 'restored';

export interface LeadsChangedPayload {
  reason: LeadsChangedReason;
  ids: string[];
}

/** Publish only for server-confirmed ids — never for optimistic UI removals. */
export function publishLeadsChanged(reason: LeadsChangedReason, ids: string[]) {
  if (!ids?.length) return;
  eventBus.publish(LEADS_CHANGED_TOPIC, { reason, ids } as LeadsChangedPayload);
}

/** Subscribe to lead-set changes. Returns the unsubscribe function. */
export function onLeadsChanged(handler: (payload: LeadsChangedPayload) => void) {
  return eventBus.subscribe(LEADS_CHANGED_TOPIC, handler as any);
}
