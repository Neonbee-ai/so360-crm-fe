import React, { useEffect, useState } from 'react';
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

export interface DetailBackLinkProps {
    /** Route to use when there is no in-app history entry to return to. */
    fallbackTo: string;
    /** e.g. "Back to Leads". Also used as the floating control's accessible name. */
    label: string;
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

export const DetailBackLink: React.FC<DetailBackLinkProps> = ({ fallbackTo, label, className = '' }) => {
    const navigate = useNavigate();
    const [showFloating, setShowFloating] = useState(false);

    const goBack = () => {
        if (typeof window !== 'undefined' && hasInAppHistory(window.history.state)) navigate(-1);
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
                className={`flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors group ${className}`}
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
