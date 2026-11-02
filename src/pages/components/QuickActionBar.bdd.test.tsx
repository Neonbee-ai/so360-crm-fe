import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickActionBar, { DOUBLE_CLICK_GUARD_MS } from './QuickActionBar';

/**
 * Regression cover for "Create Task / Schedule Meeting behave inconsistently
 * from the record header". Every action must be a plain, repeatable request to
 * open something — never a navigation, and never a no-op because some flag was
 * already set from a previous click.
 */
const handlers = () => ({
    onAddNote: vi.fn(),
    onSendEmail: vi.fn(),
    onLogCall: vi.fn(),
    onScheduleMeeting: vi.fn(),
    onCreateTask: vi.fn(),
    onUploadDocument: vi.fn(),
});

const ACTION_NAMES = [
    'Add Note',
    'Send Email',
    'Log Call',
    'Schedule Meeting',
    'Create Task',
    'Add Document',
];

// The actions live in a "Log activity" menu: open it, then pick the item.
// The menu closes after each pick, so every pick reopens it first.
const openMenu = () => {
    const trigger = screen.getByRole('button', { name: /Log activity/ });
    if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
};
const pick = (name: string) => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name }));
};

describe('Given the quick action bar', () => {
    it('When rendered / Then every action is an ordinary button, not a link that navigates', () => {
        render(<QuickActionBar {...handlers()} />);
        const trigger = screen.getByRole('button', { name: /Log activity/ });
        expect(trigger.getAttribute('type')).toBe('button');
        openMenu();
        for (const name of ACTION_NAMES) {
            const button = screen.getByRole('menuitem', { name });
            expect(button).toBeInTheDocument();
            // A link would change the route; these actions never do.
            expect(button.tagName).toBe('BUTTON');
        }
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it.each([
        ['Create Task', 'onCreateTask'],
        ['Schedule Meeting', 'onScheduleMeeting'],
        ['Log Call', 'onLogCall'],
        ['Add Note', 'onAddNote'],
        ['Add Document', 'onUploadDocument'],
        ['Send Email', 'onSendEmail'],
    ] as const)('When %s is clicked / Then only its own handler runs', (name, key) => {
        const props = handlers();
        render(<QuickActionBar {...props} />);
        pick(name);

        expect(props[key]).toHaveBeenCalledTimes(1);
        for (const [otherKey, fn] of Object.entries(props)) {
            if (otherKey !== key) expect(fn).not.toHaveBeenCalled();
        }
    });
});

describe('Given an impatient double click on a quick action', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('When clicked twice in quick succession / Then the action runs once', () => {
        const props = handlers();
        render(<QuickActionBar {...props} />);
        pick('Schedule Meeting');
        pick('Schedule Meeting');

        expect(props.onScheduleMeeting).toHaveBeenCalledTimes(1);
    });

    it('When clicked again after the guard window / Then it opens again', () => {
        const props = handlers();
        render(<QuickActionBar {...props} />);
        pick('Schedule Meeting');
        vi.setSystemTime(Date.now() + DOUBLE_CLICK_GUARD_MS + 1);
        pick('Schedule Meeting');

        // Closing a modal and asking for it again must always work — the old
        // wiring silently ignored every click after the first.
        expect(props.onScheduleMeeting).toHaveBeenCalledTimes(2);
    });

    it('When two different actions are clicked back to back / Then neither swallows the other', () => {
        const props = handlers();
        render(<QuickActionBar {...props} />);

        pick('Create Task');
        pick('Schedule Meeting');

        expect(props.onCreateTask).toHaveBeenCalledTimes(1);
        expect(props.onScheduleMeeting).toHaveBeenCalledTimes(1);
    });
});
