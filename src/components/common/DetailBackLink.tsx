import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Back navigation for record detail pages.
 *
 * Renders the familiar inline link at the top of the page AND a floating control
 * that fades in once the reader has scrolled past the header. Detail pages run to
 * several screens (Profile, Activity, Notes, Products…), and the inline link
 * scrolling out of reach forced a trip back to the top for every record — costly
 * for anyone working through a list.
 *
 * Destination: when the user arrived from somewhere inside the app, go back to
 * exactly that place (a task list, a search result, the dashboard). Only fall back
 * to the module list when there is no in-app history to return to — e.g. the
 * record was opened from a bookmark or a deep link in an email.
 */

/** Scroll distance, in px, past which the floating control appears. */
export const FLOATING_REVEAL_PX = 280;

/**
 * The one label every detail page shows. Module-specific wording ("Back to
 * Leads") described the *fallback* destination, not where the click actually
 * goes — misleading the moment the record was opened from Tasks, a search
 * result or a dashboard card. A single neutral control tells the truth in
 * every case.
 */
export const BACK_LABEL = 'Back';

export interface DetailBackLinkProps {
    /** Route to use when there is no in-app history entry to return to. */
    fallbackTo: string;
    /** Overrides the visible/accessible name. Defaults to "Back" — leave unset. */
    label?: string;
    className?: string;
}

/**
 * True when the current entry was reached by navigating within the app.
 *
 * React Router's history stamps each entry it pushes with a numeric `idx` on
 * `window.history.state`; anything above 0 means there is an earlier in-app entry
 * to return to. Reading the raw history state rather than calling `useLocation()`
 * keeps this component usable in the many detail-page tests that mock
 * react-router-dom with only the hooks their page already needed.
 */
export function hasInAppHistory(historyState: unknown): boolean {
    const idx = (historyState as { idx?: unknown } | null)?.idx;
    return typeof idx === 'number' && idx > 0;
}

/**
 * The location a record was opened from, when the opener recorded one.
 *
 * `navigate(-1)` alone is only as good as the history stack, and a detail page
 * that itself links onward (a quote to its deal) can leave that stack somewhere
 * the reader never expected — so a quote opened from the Quotes list could land
 * back on Deal Details. An explicit `state.from`, stamped by whoever opened the
 * record, is unambiguous: it is the exact URL — filters, page and all — the
 * reader was looking at.
 */
export function backTargetFromState(locationState: unknown): string | null {
    const from = (locationState as { from?: unknown } | null)?.from;
    return typeof from === 'string' && from.startsWith('/') ? from : null;
}

export const DetailBackLink: React.FC<DetailBackLinkProps> = ({ fallbackTo, label = BACK_LABEL, className = '' }) => {
    const navigate = useNavigate();
    const [showFloating, setShowFloating] = useState(false);
    // A second click while the first navigation is still settling would pop two
    // history entries and overshoot the page the reader came from.
    const navigating = useRef(false);

    const goBack = () => {
        if (navigating.current) return;
        navigating.current = true;
        // Released on the next tick; by then this component has been unmounted
        // by a successful navigation, so only a no-op click re-enables itself.
        window.setTimeout(() => { navigating.current = false; }, 0);

        const explicit =
            typeof window !== 'undefined' ? backTargetFromState(window.history.state?.usr) : null;
        if (explicit) navigate(explicit);
        else if (typeof window !== 'undefined' && hasInAppHistory(window.history.state)) navigate(-1);
        else navigate(fallbackTo);
    };

    useEffect(() => {
        // The MFE renders inside the shell's scroll container, so the scroll event
        // may originate from an ancestor rather than the window. Listening in the
        // capture phase on document catches both without knowing the layout.
        const onScroll = (e: Event) => {
            const target = e.target as HTMLElement | Document | null;
            const top =
                target && (target as HTMLElement).scrollTop !== undefined
                    ? (target as HTMLElement).scrollTop
                    : window.scrollY;
            setShowFloating(top > FLOATING_REVEAL_PX);
        };
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('scroll', onScroll);
        return () => {
            document.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    return (
        <>
            <button
                type="button"
                onClick={goBack}
                aria-label={label}
                className={`flex items-center gap-1 text-slate-300 hover:text-slate-100 transition-colors group ${className}`}
            >
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {label}
            </button>

            <button
                type="button"
                onClick={goBack}
                aria-label={label}
                title={label}
                data-testid="detail-back-floating"
                className={`fixed left-6 bottom-6 z-40 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/95 px-4 py-3 text-xs font-bold text-slate-200 shadow-xl backdrop-blur transition-all hover:border-blue-500/60 hover:text-slate-50 ${
                    showFloating ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
                }`}
            >
                <ChevronLeft size={16} />
                {label}
            </button>
        </>
    );
};

export default DetailBackLink;
