import { describe, it, expect } from 'vitest';
import { groupUpNext, UP_NEXT_DAYS } from './upNext';
import type { UpNextTask } from '../types/crm';

const item = (id: string, over: Partial<UpNextTask> = {}): UpNextTask =>
    ({
        id,
        title: id,
        at: '2026-10-07T15:00:00.000Z',
        kind: 'booked',
        overdue: false,
        day_offset: 0,
        ...over,
    }) as UpNextTask;

describe('groupUpNext', () => {
    describe('Given an agenda with overdue items and items on several days', () => {
        const items = [
            item('late', { overdue: true, day_offset: -2 }),
            item('late-today', { overdue: true, day_offset: 0 }),
            item('a', { day_offset: 0 }),
            item('b', { day_offset: 0 }),
            item('c', { day_offset: 3 }),
            item('d', { day_offset: 6 }),
        ];

        it('When grouped / Then overdue items form their own group, then one group per day, in order', () => {
            const groups = groupUpNext(items);
            expect(groups.map(g => g.key)).toEqual(['overdue', 0, 1, 2, 3, 4, 5, 6]);
            expect(groups).toHaveLength(UP_NEXT_DAYS + 1);
            expect(groups[0].items.map(i => i.id)).toEqual(['late', 'late-today']);
            expect(groups[1].items.map(i => i.id)).toEqual(['a', 'b']);
            expect(groups[4].items.map(i => i.id)).toEqual(['c']);
            expect(groups[7].items.map(i => i.id)).toEqual(['d']);
        });

        it('When days are empty / Then they are still present with no items', () => {
            const groups = groupUpNext(items);
            expect(groups[2].items).toEqual([]);
        });
    });

    describe('Given an item that is not overdue but sits on a past calendar day (timezone edge)', () => {
        it('When grouped / Then it is shown under today rather than lost', () => {
            const groups = groupUpNext([item('edge', { day_offset: -1, overdue: false })]);
            expect(groups[1].items.map(i => i.id)).toEqual(['edge']);
        });
    });

    describe('Given an empty agenda', () => {
        it('When grouped / Then every group is empty', () => {
            expect(groupUpNext([]).every(g => g.items.length === 0)).toBe(true);
        });
    });
});
