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

/** `+05:30` / `-08:00` / `+00:00` — the browser's current offset from UTC. */
export function localOffsetSuffix(date: Date = new Date()): string {
  // getTimezoneOffset() counts minutes *behind* UTC, so the sign is inverted.
  const total = -date.getTimezoneOffset();
  const sign = total < 0 ? '-' : '+';
  const abs = Math.abs(total);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/**
 * Serialise a date/datetime input value for the API **without losing the
 * calendar date the user picked**.
 *
 * `new Date('2026-08-13T00:00:00').toISOString()` yields `2026-08-12T18:30:00Z`
 * in IST — the wall-clock date silently rolls back a day, and the server's
 * "is this in the past?" check then rejects a task the user scheduled for today.
 *
 *   date only  → `2026-08-13`                  (a calendar date, no instant at all)
 *   with time  → `2026-08-13T14:30:00+05:30`   (an instant that still states its zone)
 *
 * Both forms let the server recover the user's calendar date exactly, which is
 * what the past-date rule is actually about.
 */
export function inputValueToApiValue(value: string): string {
  if (!value) return value;
  if (!value.includes('T')) return value;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}${localOffsetSuffix(new Date(withSeconds))}`;
}

/**
 * Split a stored due-date into the two controls a task form shows.
 *
 * Every task kind now carries an optional time, not just Reminder — a follow-up
 * call due "20 Aug" told nobody whether to ring at 9am or 6pm. A task saved
 * without a time stays at UTC midnight, which is how every surface knows the
 * user never picked one and must not invent one.
 */
export function splitStoredDueDate(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  if (!hasTimeComponent(value)) return { date: dueDateCalendarDay(value), time: '' };
  const d = parseUtcDate(value);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * Assemble what the API is sent for a due date: a bare calendar date when no
 * time was chosen, a zone-stamped instant when one was.
 */
export function composeDueDate(date: string, time: string): string {
  if (!date) return '';
  return inputValueToApiValue(time ? `${date}T${time}` : date);
}

/**
 * The calendar date a stored due-date represents, as `YYYY-MM-DD`.
 *
 * Date-only tasks are persisted at UTC midnight, so their day must be read in
 * UTC — rendering that instant in a negative-offset zone would show the previous
 * day. Timed values are a real instant and are read in the viewer's own zone.
 */
export function dueDateCalendarDay(value: string | Date): string {
  const d = parseUtcDate(value);
  if (isNaN(d.getTime())) return '';
  return hasTimeComponent(d)
    ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    : `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
