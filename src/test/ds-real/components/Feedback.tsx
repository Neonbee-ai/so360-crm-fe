import React, { useEffect, useState } from 'react';
import { mergeClassName } from '../utils/cx';
import { resolveTestId } from '../utils/testId';
import { useReplay } from '../hooks/useReplay';

/** Tick that draws itself in (260ms stroke). Decorative. */
export const DrawnCheck: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-testid="drawn-check" className={className}>
        <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-nb-draw [stroke-dasharray:24] [stroke-dashoffset:24]" />
    </svg>
);

export type SavedState = 'idle' | 'saving' | 'saved' | 'error';

export interface SavedIndicatorProps {
    /** idle renders nothing; saving = spinner; saved = drawn tick + "Saved" for `holdMs`, then fades. */
    state: SavedState;
    holdMs?: number;
    savingLabel?: string;
    savedLabel?: string;
    errorLabel?: string;
    className?: string;
    'data-testid'?: string;
}

/**
 * Autosave status for forms and settings: "Saving…" spinner, then a tick and
 * "Saved" for 1.6s. Polite live region so screen readers hear the outcome.
 */
export const SavedIndicator: React.FC<SavedIndicatorProps> = ({
    state, holdMs = 1600, savingLabel = 'Saving…', savedLabel = 'Saved', errorLabel = 'Not saved', className, ...rest
}) => {
    const [showSaved, setShowSaved] = useState(state === 'saved');
    useEffect(() => {
        if (state !== 'saved') {
            setShowSaved(false);
            return undefined;
        }
        setShowSaved(true);
        const t = setTimeout(() => setShowSaved(false), holdMs);
        return () => clearTimeout(t);
    }, [state, holdMs]);
    const visible = state === 'saving' || state === 'error' || showSaved;
    return (
        <span
            role="status"
            aria-live="polite"
            data-testid={resolveTestId(rest['data-testid'], 'saved-indicator')}
            data-state={visible ? state : 'idle'}
            className={mergeClassName('inline-flex min-h-nb-touch items-center gap-1.5 text-nb-label', className)}
        >
            {state === 'saving' && (
                <>
                    <span aria-hidden="true" data-testid="saved-indicator-spinner" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent text-fg-muted" />
                    <span className="text-fg-muted">{savingLabel}</span>
                </>
            )}
            {state === 'saved' && showSaved && (
                <span className="inline-flex animate-nb-fade items-center gap-1.5 text-success">
                    <DrawnCheck className="h-3.5 w-3.5" />
                    <span>{savedLabel}</span>
                </span>
            )}
            {state === 'error' && <span className="text-danger">{errorLabel}</span>}
        </span>
    );
};

export interface TypingDotsProps {
    /** Screen-reader text, e.g. "Neura is typing". */
    label?: string;
    className?: string;
    'data-testid'?: string;
}

/** Three bouncing dots (1s loop, staggered) for "someone is typing". Static under reduced motion. */
export const TypingDots: React.FC<TypingDotsProps> = ({ label = 'Typing', className, ...rest }) => (
    <span role="status" data-testid={resolveTestId(rest['data-testid'], 'typing-dots')} className={mergeClassName('inline-flex items-center gap-1 text-fg-muted', className)}>
        <span className="sr-only">{label}</span>
        {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden="true" className="h-1.5 w-1.5 animate-nb-dot rounded-full bg-current" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
    </span>
);

/**
 * New-item highlight: returns `animate-nb-flash` (1.4s teal tint fading out) the
 * first time `key` is seen after mount, e.g. a row just created or received.
 * Spread `onAnimationEnd` on the same element.
 */
export function useFlash(key: unknown): { className: string; onAnimationEnd: (e?: { target: unknown; currentTarget: unknown }) => void } {
    const r = useReplay(key);
    return { className: r.active ? 'animate-nb-flash' : '', onAnimationEnd: r.onAnimationEnd };
}

/** Wraps children in a block that flashes once on mount (or when `flashKey` changes). */
export const FlashHighlight: React.FC<{ flashKey?: unknown; className?: string; children?: React.ReactNode }> = ({ flashKey, className, children }) => {
    const [on, setOn] = useState(false);
    useEffect(() => setOn(true), [flashKey]);
    return (
        <div data-flash={on || undefined} onAnimationEnd={(e: React.AnimationEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) setOn(false); }} className={mergeClassName(`rounded-nb ${on ? 'animate-nb-flash' : ''}`.trim(), className)}>
            {children}
        </div>
    );
};
