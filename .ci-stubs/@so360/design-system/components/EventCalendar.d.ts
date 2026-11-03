import React from 'react';
export type EventTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
export type EventCalendarView = 'month' | 'week';
export interface CalendarEvent {
    id: string;
    title: string;
    /** `'YYYY-MM-DD'` (all-day) or `'YYYY-MM-DDTHH:mm'` (timed). */
    start: string;
    /** All-day: inclusive last day. Timed: end time (default start + 1h). Spanning days makes it a multi-day bar. */
    end?: string;
    /** Colour token, e.g. mapped from a status. Default `primary`. */
    tone?: EventTone;
    /** Extra text for the accessible name and the "+N more" list (assignee, status…). */
    description?: string;
}
/** A clicked empty time slot (week view), local `'YYYY-MM-DDTHH:mm'`. */
export interface EventCalendarSlot {
    start: string;
    end: string;
}
export interface EventCalendarProps {
    events: CalendarEvent[];
    /** Controlled view. */
    view?: EventCalendarView;
    defaultView?: EventCalendarView;
    onViewChange?: (view: EventCalendarView) => void;
    /** Any day inside the visible month/week. Controlled when provided. */
    date?: Date;
    defaultDate?: Date;
    onDateChange?: (date: Date) => void;
    onEventClick?: (event: CalendarEvent) => void;
    /** Click on a day (month cell / week day header); use it to create on that date. */
    onDateClick?: (iso: string) => void;
    /** Click on an empty week-view time slot; use it to create at that time. */
    onSlotClick?: (slot: EventCalendarSlot) => void;
    /** Month rows per day including the "+N more" row. Default 3. */
    maxEventsPerDay?: number;
    /** Week view visible hours [start, end). Default 8–20. */
    dayStartHour?: number;
    dayEndHour?: number;
    /** Week view: slot length in minutes (60 or 30). Default 60. */
    slotMinutes?: 30 | 60;
    /** 0 = Sunday, 1 = Monday (default). */
    weekStartsOn?: 0 | 1;
    locale?: string;
    /** Override "now" (tests / SSR). */
    today?: Date;
    /** Hide the title / navigation / view switch bar. */
    hideToolbar?: boolean;
    /** Extra toolbar content (filters, a create button). */
    toolbarActions?: React.ReactNode;
    /** Max height of the scrolling week time grid. Default `32rem`. */
    weekHeight?: string;
    className?: string;
    name?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare function parseEventDate(s: string): Date;
export interface NormalizedEvent {
    event: CalendarEvent;
    start: Date;
    end: Date;
    startDay: Date;
    /** Inclusive last day. */
    endDay: Date;
    timed: boolean;
    /** Spans more than one day (shown as a bar, also in the week all-day strip). */
    multiDay: boolean;
}
export declare function normalizeEvent(event: CalendarEvent): NormalizedEvent;
export interface EventSegment {
    n: NormalizedEvent;
    /** Column index of the first visible day (0-based). */
    col: number;
    span: number;
    lane: number;
    continuesBefore: boolean;
    continuesAfter: boolean;
}
/** Clip events to `[rangeStart, rangeStart + days)` and stack them into lanes (first fit, longest first). */
export declare function layoutSegments(events: NormalizedEvent[], rangeStart: Date, days: number): EventSegment[];
/** Month cell overflow: which segments render and how many are hidden per day. */
export declare function monthVisibility(segs: EventSegment[], maxRows: number): {
    visible: Set<EventSegment>;
    hidden: number[];
    max: number;
};
interface TimedPlacement {
    n: NormalizedEvent;
    top: number;
    height: number;
    col: number;
    cols: number;
}
/** Position single-day timed events in a day column; overlapping events share the width. */
export declare function layoutTimed(events: NormalizedEvent[], dayStartMin: number, dayEndMin: number): TimedPlacement[];
/** Month (multi-day bars, "+N more") and week (all-day strip + time grid) event calendar. */
export declare const EventCalendar: React.FC<EventCalendarProps>;
export {};
