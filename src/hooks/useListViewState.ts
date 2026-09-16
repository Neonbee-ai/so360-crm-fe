import { useEffect, useRef, useState } from 'react';

/**
 * Remembers a list page's view state — search text, filters, sort, page — and
 * its scroll offset, for the lifetime of the browser tab.
 *
 * Detail pages return the user to the previous history entry, which re-mounts
 * the list from scratch: empty search box, page 1, scrolled to the top. Anyone
 * working through a filtered list had to rebuild that view after every record
 * they opened. Persisting it per key restores the list exactly as it was left.
 *
 * sessionStorage (not localStorage) is deliberate — a filter is part of "what I
 * am doing right now", not a preference that should greet the user next week.
 * Keeping it out of the URL also means shared links stay clean.
 */

export const LIST_VIEW_STATE_PREFIX = 'crm:list-view:';

/**
 * Entries are scoped to the active organisation. A saved "owner = Priya" filter
 * means nothing in a different org, and silently applying it there would show an
 * empty list with no visible cause. The shell persists the org as JSON under
 * `active_org`; anything unreadable degrades to an unscoped key rather than
 * throwing.
 */
function activeOrgScope(): string {
    try {
        const raw = localStorage.getItem('active_org');
        if (!raw) return 'no-org';
        const id = (JSON.parse(raw) as { id?: string } | null)?.id;
        return id || 'no-org';
    } catch {
        return 'no-org';
    }
}

export const listViewStorageKey = (key: string) => `${LIST_VIEW_STATE_PREFIX}${activeOrgScope()}:${key}`;

function readPersisted<T>(key: string, initial: T): T {
    if (typeof sessionStorage === 'undefined') return initial;
    try {
        const raw = sessionStorage.getItem(listViewStorageKey(key));
        return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
        // Corrupt or unreadable entries must never take the list down.
        return initial;
    }
}

/**
 * Drop-in replacement for `useState` whose value survives a round trip to a
 * detail page. Same tuple, same setter semantics (value or updater fn).
 */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => readPersisted(key, initial));

    useEffect(() => {
        if (typeof sessionStorage === 'undefined') return;
        try {
            sessionStorage.setItem(listViewStorageKey(key), JSON.stringify(value));
        } catch {
            // Quota / private-mode failures are not worth surfacing.
        }
    }, [key, value]);

    return [value, setValue];
}

/** Clears every persisted list-view entry — used when the org context changes. */
export function clearListViewState() {
    if (typeof sessionStorage === 'undefined') return;
    try {
        Object.keys(sessionStorage)
            .filter(k => k.startsWith(LIST_VIEW_STATE_PREFIX))
            .forEach(k => sessionStorage.removeItem(k));
    } catch {
        /* ignore */
    }
}

/**
 * Restores the scroll offset a list had when the user last left it, and keeps
 * recording it while they stay.
 *
 * The MFE renders inside the shell's scroll container rather than the document,
 * so the element that actually scrolls is discovered at runtime: walk up from
 * `anchorRef` to the first overflowing ancestor, falling back to the window when
 * the page scrolls normally (tests, standalone dev server).
 *
 * `ready` should flip once the rows are rendered — restoring earlier leaves the
 * container too short to accept the offset.
 */
export function useListScrollRestore(
    key: string,
    anchorRef: React.RefObject<HTMLElement | null>,
    ready: boolean,
) {
    const restored = useRef(false);

    useEffect(() => {
        if (typeof sessionStorage === 'undefined') return;

        const scrollKey = `${listViewStorageKey(key)}:scroll`;

        const findScroller = (): HTMLElement | Window => {
            let node: HTMLElement | null = anchorRef.current?.parentElement ?? null;
            while (node) {
                if (node.scrollHeight > node.clientHeight + 1) {
                    const overflowY = getComputedStyle(node).overflowY;
                    if (overflowY === 'auto' || overflowY === 'scroll') return node;
                }
                node = node.parentElement;
            }
            return window;
        };

        const scroller = findScroller();
        const getTop = () => (scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop);
        const setTop = (top: number) => {
            if (scroller === window) window.scrollTo(0, top);
            else (scroller as HTMLElement).scrollTop = top;
        };

        if (ready && !restored.current) {
            restored.current = true;
            let saved = 0;
            try {
                saved = Number(sessionStorage.getItem(scrollKey)) || 0;
            } catch {
                /* ignore */
            }
            // Rows land a frame after `ready` flips.
            if (saved > 0) requestAnimationFrame(() => setTop(saved));
        }

        const onScroll = () => {
            try {
                sessionStorage.setItem(scrollKey, String(getTop()));
            } catch {
                /* ignore */
            }
        };
        scroller.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
        return () => scroller.removeEventListener('scroll', onScroll);
    }, [key, anchorRef, ready]);
}
