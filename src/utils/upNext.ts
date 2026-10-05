import { UpNextTask } from '../types/crm';

export const UP_NEXT_DAYS = 7;

export type UpNextGroupKey = 'overdue' | number;

export interface UpNextGroup {
    /** 'overdue' or the day offset 0..6 from today. */
    key: UpNextGroupKey;
    items: UpNextTask[];
}

/**
 * Splits the agenda for the day strip: every overdue item in one group (they
 * are not dropped), then one group per day 0..6. Days with nothing on them
 * are kept so the strip always shows the full week. Input order is preserved.
 */
export function groupUpNext(items: UpNextTask[]): UpNextGroup[] {
    const groups: UpNextGroup[] = [{ key: 'overdue', items: items.filter(i => i.overdue) }];
    for (let day = 0; day < UP_NEXT_DAYS; day++) {
        groups.push({
            key: day,
            items: items.filter(i => !i.overdue && Math.max(0, i.day_offset) === day),
        });
    }
    return groups;
}
