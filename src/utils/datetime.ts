/**
 * Parse a value into a Date, treating timezone-less timestamp strings
 * (Postgres "timestamp without time zone") as UTC instead of browser-local.
 * Idempotent: values already carrying Z or a ±HH:MM offset, Date objects,
 * epoch numbers, and date-only strings are left untouched.
 */
export function parseUtcDate(value: string | number | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (value == null) return new Date(NaN);
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  const hasTime = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  return hasTime && !hasTz ? new Date(s.replace(' ', 'T') + 'Z') : new Date(s);
}

/**
 * Alias used by scheduling surfaces (reminders, tasks, meetings) where the
 * intent — "read what the database stored" — reads more clearly than the
 * mechanism. Same function, same guarantees.
 */
export const parseStoredTimestamp = parseUtcDate;

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Format a stored timestamp for an `<input type="datetime-local">` — LOCAL wall
 * clock.
 *
 * A `datetime-local` input is unconditionally local, so feeding it the output of
 * `toISOString()` (which is UTC) displayed the wrong time and then re-shifted the
 * value by the UTC offset on every save — reminders drifted a little further each
 * time they were edited.
 */
export function toDatetimeLocalInputValue(value: string | Date): string {
  const d = parseUtcDate(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Format a stored timestamp for an `<input type="date">` — LOCAL calendar day. */
export function toDateInputValue(value: string | Date): string {
  const d = parseUtcDate(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Convert a date/datetime input value to the ISO instant to persist.
 *
 * A bare `YYYY-MM-DD` is parsed by `new Date()` as UTC midnight, not local
 * midnight — that is how a reminder ended up stored at an instant that rendered
 * as "12:00 AM" everywhere. Anchoring the date-only form explicitly to local
 * midnight keeps the calendar day the user actually picked.
 */
export function inputValueToIso(value: string): string {
  const anchored = value.includes('T') ? value : `${value}T00:00:00`;
  return new Date(anchored).toISOString();
}

/** True when a stored timestamp carries a meaningful time-of-day (not midnight UTC). */
export function hasTimeComponent(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const d = parseUtcDate(value);
  if (isNaN(d.getTime())) return false;
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
}
