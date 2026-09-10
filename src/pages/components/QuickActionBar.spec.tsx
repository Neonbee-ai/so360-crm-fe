import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import QuickActionBar, { DOUBLE_CLICK_GUARD_MS } from './QuickActionBar';

const ALL_LABELS = ['Add Note', 'Send Email', 'Log Call', 'Schedule Meeting', 'Create Task', 'Add Document'];

function renderBar(overrides: Partial<React.ComponentProps<typeof QuickActionBar>> = {}) {
    const handlers = {
        onAddNote: vi.fn(),
        onSendEmail: vi.fn(),
        onLogCall: vi.fn(),
        onScheduleMeeting: vi.fn(),
        onCreateTask: vi.fn(),
        onUploadDocument: vi.fn(),
    };
    const utils = render(<QuickActionBar {...handlers} {...overrides} />);
    return { ...utils, handlers };
}

describe('Given no permission props are passed (legacy callers)', () => {
    test('When QuickActionBar renders, Then all six actions are shown by default', () => {
        renderBar();
        for (const label of ALL_LABELS) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });
});

describe('Given a default Employee with no activity permissions granted', () => {
    test('When QuickActionBar renders, Then none of the six action buttons appear and nothing is rendered', () => {
        const { container } = renderBar({
            canAddNote: false, canSendEmail: false, canLogCall: false,
            canScheduleMeeting: false, canCreateTask: false, canUploadDocument: false,
        });
        for (const label of ALL_LABELS) {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
        expect(container.firstChild).toBeNull();
    });
});

describe('Given an Employee whose Admin granted only Create Task', () => {
    test('When QuickActionBar renders, Then only Create Task is visible and no empty slots remain for the rest', () => {
        const { container } = renderBar({
            canAddNote: false, canSendEmail: false, canLogCall: false,
            canScheduleMeeting: false, canCreateTask: true, canUploadDocument: false,
        });
        expect(screen.getByText('Create Task')).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(1);
        for (const label of ALL_LABELS.filter(l => l !== 'Create Task')) {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
    });
});

describe('Given an Admin with all six permissions granted', () => {
    test('When QuickActionBar renders, Then all six actions are visible', () => {
        renderBar({
            canAddNote: true, canSendEmail: true, canLogCall: true,
            canScheduleMeeting: true, canCreateTask: true, canUploadDocument: true,
        });
        for (const label of ALL_LABELS) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    test('When Create Task is clicked, Then onCreateTask fires', () => {
        const { handlers } = renderBar({
            canAddNote: true, canSendEmail: true, canLogCall: true,
            canScheduleMeeting: true, canCreateTask: true, canUploadDocument: true,
        });
        fireEvent.click(screen.getByText('Create Task'));
        expect(handlers.onCreateTask).toHaveBeenCalledTimes(1);
    });
});

describe('Given a permission that was granted is later revoked by the Admin', () => {
    test('When QuickActionBar re-renders with the permission false, Then the corresponding button disappears', () => {
        const { rerender, handlers } = renderBar({ canCreateTask: true });
        expect(screen.getByText('Create Task')).toBeInTheDocument();

        rerender(<QuickActionBar {...handlers} canCreateTask={false} />);
        expect(screen.queryByText('Create Task')).not.toBeInTheDocument();
    });
});

describe('Given rapid repeat clicks on a visible action', () => {
    test('When the same action is clicked twice within the double-click guard window, Then the handler fires only once', () => {
        vi.useFakeTimers();
        const { handlers } = renderBar({ canAddNote: true });
        const btn = screen.getByText('Add Note');
        fireEvent.click(btn);
        vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS - 50);
        fireEvent.click(btn);
        expect(handlers.onAddNote).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
