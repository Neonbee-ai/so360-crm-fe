import { describe, it, expect } from 'vitest';
import {
    DASHBOARD_WIDGETS,
    DASHBOARD_WIDGET_LABELS,
    DEFAULT_LAYOUT,
    layoutRows,
    moveWidget,
    normalizeLayout,
    toggleWidget,
    visibleWidgets,
    type DashboardLayout,
} from './dashboardLayout';

/**
 * Feature: customizable CRM dashboard layout rules (RE §31).
 */
describe('Feature: dashboard layout rules', () => {
    describe('Given the widget catalogue', () => {
        it('then every widget has a label and the default shows all of them in catalogue order', () => {
            expect(DEFAULT_LAYOUT.order).toEqual(['kpis', 'commerce', 're_widgets', 'reminders', 'revenue', 'performance']);
            expect(DEFAULT_LAYOUT.hidden).toEqual([]);
            for (const w of DASHBOARD_WIDGETS) expect(DASHBOARD_WIDGET_LABELS[w.key]).toBe(w.label);
        });
    });

    describe('Given a stored preference is read back', () => {
        it('then a valid stored order and hidden list are kept', () => {
            const order = ['performance', 'kpis', 'commerce', 're_widgets', 'reminders', 'revenue'];
            expect(normalizeLayout({ order, hidden: ['revenue'] })).toEqual({ order, hidden: ['revenue'] });
        });

        it('then unknown and repeated keys are dropped and missing widgets are appended in default order', () => {
            const out = normalizeLayout({ order: ['revenue', 'bogus', 'revenue', 'kpis'], hidden: ['kpis', 'kpis', 'nope'] });
            expect(out.order).toEqual(['revenue', 'kpis', 'commerce', 're_widgets', 'reminders', 'performance']);
            expect(out.hidden).toEqual(['kpis']);
        });

        it.each([null, undefined, 'x', 42, [], { order: 'kpis', hidden: {} }])(
            'then malformed input %p falls back to the default layout',
            (raw) => {
                expect(normalizeLayout(raw)).toEqual(DEFAULT_LAYOUT);
            },
        );
    });

    describe('Given the user reorders widgets', () => {
        it('then moving a widget down swaps it with its neighbour', () => {
            expect(moveWidget(DEFAULT_LAYOUT, 'kpis', 'down').order.slice(0, 2)).toEqual(['commerce', 'kpis']);
        });

        it('then moving a widget up swaps it with its neighbour', () => {
            expect(moveWidget(DEFAULT_LAYOUT, 'commerce', 'up').order.slice(0, 2)).toEqual(['commerce', 'kpis']);
        });

        it('then a move past either end, or of an unknown key, returns the same layout', () => {
            expect(moveWidget(DEFAULT_LAYOUT, 'kpis', 'up')).toBe(DEFAULT_LAYOUT);
            expect(moveWidget(DEFAULT_LAYOUT, 'performance', 'down')).toBe(DEFAULT_LAYOUT);
            expect(moveWidget(DEFAULT_LAYOUT, 'bogus', 'down')).toBe(DEFAULT_LAYOUT);
        });

        it('then the input layout is never mutated', () => {
            const before = [...DEFAULT_LAYOUT.order];
            moveWidget(DEFAULT_LAYOUT, 'kpis', 'down');
            expect(DEFAULT_LAYOUT.order).toEqual(before);
        });
    });

    describe('Given the user hides or shows widgets', () => {
        it('then toggling hides a visible widget and shows it again on a second toggle', () => {
            const hidden = toggleWidget(DEFAULT_LAYOUT, 'revenue');
            expect(hidden.hidden).toEqual(['revenue']);
            expect(toggleWidget(hidden, 'revenue').hidden).toEqual([]);
        });

        it('then toggling an unknown key returns the same layout', () => {
            expect(toggleWidget(DEFAULT_LAYOUT, 'bogus')).toBe(DEFAULT_LAYOUT);
        });
    });

    describe('Given a layout is rendered', () => {
        const layout: DashboardLayout = {
            order: ['revenue', 'kpis', 'commerce', 're_widgets', 'reminders', 'performance'],
            hidden: ['kpis', 'performance'],
        };

        it('then the panel rows list every widget in order with its visibility', () => {
            expect(layoutRows(layout).slice(0, 2)).toEqual([
                { key: 'revenue', visible: true },
                { key: 'kpis', visible: false },
            ]);
            expect(layoutRows(layout)).toHaveLength(6);
        });

        it('then only visible widgets are rendered, in the user order', () => {
            expect(visibleWidgets(layout)).toEqual(['revenue', 'commerce', 're_widgets', 'reminders']);
        });
    });
});
