import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
    usePersistedState,
    useListScrollRestore,
    clearListViewState,
    listViewStorageKey,
    LIST_VIEW_STATE_PREFIX,
} from './useListViewState';

/**
 * Cover for "opening a record from a filtered list and coming back loses the
 * filter, the page and the scroll position".
 */

const Filterable: React.FC<{ storageKey?: string }> = ({ storageKey = 'demo.filter' }) => {
    const [filter, setFilter] = usePersistedState(storageKey, 'All');
    const [page, setPage] = usePersistedState('demo.page', 1);
    return (
        <div>
            <span data-testid="filter">{filter}</span>
            <span data-testid="page">{page}</span>
            <button onClick={() => setFilter('Overdue')}>filter overdue</button>
            <button onClick={() => setPage(p => p + 1)}>next page</button>
        </div>
    );
};

beforeEach(() => {
    sessionStorage.clear();
});

describe('Given a list page whose view state is persisted', () => {
    it('When nothing was stored yet / Then it starts from the supplied default', () => {
        render(<Filterable />);
        expect(screen.getByTestId('filter')).toHaveTextContent('All');
        expect(screen.getByTestId('page')).toHaveTextContent('1');
    });

    it('When the user filters and pages / Then the choice is written to session storage', () => {
        render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        fireEvent.click(screen.getByText('next page'));
        expect(sessionStorage.getItem(listViewStorageKey('demo.filter'))).toBe('"Overdue"');
        expect(sessionStorage.getItem(listViewStorageKey('demo.page'))).toBe('2');
    });

    it('When the page is re-mounted after a detail-page round trip / Then the view comes back as it was left', () => {
        const first = render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        fireEvent.click(screen.getByText('next page'));
        first.unmount();

        render(<Filterable />);
        expect(screen.getByTestId('filter')).toHaveTextContent('Overdue');
        expect(screen.getByTestId('page')).toHaveTextContent('2');
    });

    it('When the stored entry is corrupt / Then the list still renders on its default', () => {
        sessionStorage.setItem(listViewStorageKey('demo.filter'), '{not json');
        render(<Filterable />);
        expect(screen.getByTestId('filter')).toHaveTextContent('All');
    });

    it('When an updater function is used / Then it behaves exactly like useState', () => {
        render(<Filterable />);
        fireEvent.click(screen.getByText('next page'));
        fireEvent.click(screen.getByText('next page'));
        expect(screen.getByTestId('page')).toHaveTextContent('3');
    });

    it('When every entry is cleared / Then nothing under the list-view namespace survives', () => {
        render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        sessionStorage.setItem('unrelated', 'keep me');

        clearListViewState();

        expect(Object.keys(sessionStorage).filter(k => k.startsWith(LIST_VIEW_STATE_PREFIX))).toHaveLength(0);
        expect(sessionStorage.getItem('unrelated')).toBe('keep me');
    });

    it('When two lists use different keys / Then their state stays independent', () => {
        const a = render(<Filterable storageKey="leads.filter" />);
        fireEvent.click(screen.getByText('filter overdue'));
        a.unmount();

        render(<Filterable storageKey="quotes.filter" />);
        expect(screen.getByTestId('filter')).toHaveTextContent('All');
    });
});

const Scrollable: React.FC<{ ready: boolean }> = ({ ready }) => {
    const ref = useRef<HTMLDivElement>(null);
    useListScrollRestore('demo', ref, ready);
    return <div ref={ref} data-testid="content">rows</div>;
};

describe('Given a list that was scrolled before the user opened a record', () => {
    beforeEach(() => {
        sessionStorage.clear();
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
        window.scrollTo = vi.fn() as any;
    });

    it('When the user scrolls / Then the offset is recorded', () => {
        render(<Scrollable ready />);
        act(() => {
            (window as any).scrollY = 420;
            window.dispatchEvent(new Event('scroll'));
        });
        expect(sessionStorage.getItem(`${listViewStorageKey('demo')}:scroll`)).toBe('420');
    });

    it('When the rows have rendered / Then the recorded offset is reapplied', async () => {
        sessionStorage.setItem(`${listViewStorageKey('demo')}:scroll`, '360');
        render(<Scrollable ready />);
        await act(async () => {
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        });
        expect(window.scrollTo).toHaveBeenCalledWith(0, 360);
    });

    it('When the rows have not rendered yet / Then nothing is restored into an empty container', async () => {
        sessionStorage.setItem(`${listViewStorageKey('demo')}:scroll`, '360');
        render(<Scrollable ready={false} />);
        await act(async () => {
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        });
        expect(window.scrollTo).not.toHaveBeenCalled();
    });
});

describe('Given the same list viewed under different organisations', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
    });

    it('When the org changes / Then the previous org\'s filter is not applied', () => {
        localStorage.setItem('active_org', JSON.stringify({ id: 'org-a' }));
        const a = render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        a.unmount();

        localStorage.setItem('active_org', JSON.stringify({ id: 'org-b' }));
        render(<Filterable />);
        expect(screen.getByTestId('filter')).toHaveTextContent('All');
    });

    it('When the user returns to the first org / Then their view is still there', () => {
        localStorage.setItem('active_org', JSON.stringify({ id: 'org-a' }));
        const a = render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        a.unmount();

        localStorage.setItem('active_org', JSON.stringify({ id: 'org-b' }));
        const b = render(<Filterable />);
        b.unmount();

        localStorage.setItem('active_org', JSON.stringify({ id: 'org-a' }));
        render(<Filterable />);
        expect(screen.getByTestId('filter')).toHaveTextContent('Overdue');
    });

    it('When active_org is missing or unreadable / Then the list still works on an unscoped key', () => {
        localStorage.setItem('active_org', '{not json');
        render(<Filterable />);
        fireEvent.click(screen.getByText('filter overdue'));
        expect(screen.getByTestId('filter')).toHaveTextContent('Overdue');
    });
});
