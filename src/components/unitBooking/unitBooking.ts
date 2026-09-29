import type { InventoryItem, ReservationStatus } from '../../types/crm';

/** Hold durations offered when attaching a unit. 48h is the default. */
export const HOLD_HOUR_OPTIONS = [24, 48, 72, 168] as const;
export const DEFAULT_HOLD_HOURS = 48;

export function holdHoursLabel(h: number): string {
    return h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h}h`;
}

/**
 * "Only available" is applied client-side: Inventory's search-with-variants
 * already returns `available_stock` (on-hand minus reserved) per item, and
 * has no availability query param. An item without the field is kept — we
 * cannot claim it is unavailable.
 */
export function filterAvailable(items: InventoryItem[], onlyAvailable: boolean): InventoryItem[] {
    if (!onlyAvailable) return items;
    return items.filter(it => it.available_stock == null || it.available_stock > 0);
}

export interface ReservationView {
    label: string;
    tone: 'held' | 'sold' | 'muted';
}

/**
 * How a product line's reservation reads. Held lines show time left; a hold
 * whose expiry has passed reads "Hold expired" even before the backend sweep
 * flips its status. Returns null when the line carries no reservation.
 */
export function describeReservation(
    status: ReservationStatus | string | null | undefined,
    expiresAt: string | null | undefined,
    now: number = Date.now(),
): ReservationView | null {
    if (!status) return null;
    if (status === 'sold') return { label: 'Sold', tone: 'sold' };
    if (status === 'held') {
        if (!expiresAt) return { label: 'Held', tone: 'held' };
        const ms = new Date(expiresAt).getTime() - now;
        if (Number.isNaN(ms)) return { label: 'Held', tone: 'held' };
        if (ms <= 0) return { label: 'Hold expired', tone: 'muted' };
        const hours = Math.floor(ms / 3_600_000);
        if (hours >= 24) return { label: `Held · ${Math.floor(hours / 24)}d ${hours % 24}h left`, tone: 'held' };
        if (hours >= 1) return { label: `Held · ${hours}h left`, tone: 'held' };
        return { label: `Held · ${Math.max(1, Math.floor(ms / 60_000))}m left`, tone: 'held' };
    }
    if (status === 'expired') return { label: 'Hold expired', tone: 'muted' };
    if (status === 'released') return { label: 'Released', tone: 'muted' };
    return null;
}

/** Shown when `unit_visibility=assigned_only` blocks a hold/book on someone else's unit. */
export const UNIT_NOT_ALLOCATED_MESSAGE = "This unit isn't allocated to you — ask your manager";

/**
 * Error text for a failed unit hold/book. The backend answers 403
 * `UNIT_NOT_ALLOCATED` (as `code`, `error` or in the message) when the unit
 * belongs to another agent's allocation; that becomes a plain-language hint.
 * Anything else keeps the backend's own sentence, else the fallback.
 */
export function unitBookingErrorMessage(e: unknown, fallback: string): string {
    const err = (e ?? {}) as { status?: number; message?: string; body?: { code?: unknown; error?: unknown; message?: unknown } | null };
    if (err.status === 403) {
        const b = err.body ?? {};
        const hay = [b.code, b.error, b.message, err.message].map((v) => (typeof v === 'string' ? v : '')).join(' ');
        if (hay.includes('UNIT_NOT_ALLOCATED')) return UNIT_NOT_ALLOCATED_MESSAGE;
    }
    return err.message || fallback;
}
