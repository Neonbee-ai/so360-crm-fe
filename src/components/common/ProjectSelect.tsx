import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
import { Search, X, ChevronDown, Loader2 } from 'lucide-react';
import { crmService } from '../../services/crmService';

// Projects that can no longer take work. Hidden from the picker, but a task
// that is already linked to one still shows it (see `selectedLabel`).
const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'];
const PAGE_SIZE = 25;
// Most pages read in one go while every row of them is a closed project.
const MAX_AUTO_PAGES = 5;
const SEARCH_DEBOUNCE_MS = 300;

interface ProjectOption {
    id: string;
    title?: string;
    name?: string;
    code?: string;
    project_code?: string;
    status?: string;
}

interface ProjectSelectProps {
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    noneLabel?: string;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
}

const labelOf = (p: ProjectOption) => p.title || p.name || p.id;
const codeOf = (p: ProjectOption) => p.code || p.project_code || '';

/**
 * Searchable Project picker. Search and paging run on the Projects backend, so
 * every project is reachable no matter how many the tenant has, and a failed
 * load is shown (with Retry) instead of looking like "no projects".
 *
 * Keyboard: the closed control is a real button (Enter / Space / ArrowDown /
 * ArrowUp open it). Open, focus is in the search box; ArrowUp/Down move the
 * active option (aria-activedescendant), Enter selects, Escape closes and
 * returns focus to the button, Tab closes without trapping focus.
 */
export const ProjectSelect: React.FC<ProjectSelectProps> = ({
    value,
    onChange,
    placeholder = 'Search projects...',
    noneLabel = 'No Project',
    disabled = false,
    className = '',
    inputClassName = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [term, setTerm] = useState('');
    const [options, setOptions] = useState<ProjectOption[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    // Name of the selection when it had to be fetched by id (it may be outside
    // the loaded page, or a closed project). Keyed by id so a stale name never shows.
    const [resolved, setResolved] = useState<{ id: string; label: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // Set when the picker closes from the keyboard or a selection, so focus goes
    // back to the trigger (but not when the user clicks or tabs elsewhere).
    const restoreFocus = useRef(false);
    const listId = useId();
    // Discards the response of a superseded request (fast typing, close/reopen).
    const requestSeq = useRef(0);

    const load = useCallback(async (searchTerm: string, pageNo: number) => {
        const seq = ++requestSeq.current;
        setIsLoading(true);
        setError(false);
        try {
            // Closed projects are hidden client-side, so a whole page can come
            // back with nothing to show while more pages exist. Keep reading
            // (bounded) instead of showing "No projects found" over a non-empty
            // list. Past the bound, "Load more" stays available.
            let current = pageNo; // always the last page actually read
            let rows: ProjectOption[] = [];
            let more = false;
            for (let i = 0; i < MAX_AUTO_PAGES; i++) {
                current = pageNo + i;
                const res = await crmService.searchProjects({ search: searchTerm, page: current, limit: PAGE_SIZE });
                if (seq !== requestSeq.current) return;
                rows = (res?.data || []).filter((p: ProjectOption) => !CLOSED_STATUSES.includes(String(p.status || '').toUpperCase()));
                more = !!res?.hasMore;
                if (rows.length > 0 || !more) break;
            }
            setOptions(prev => (pageNo === 1 ? rows : [...prev, ...rows.filter(r => !prev.some(x => x.id === r.id))]));
            setHasMore(more);
            setPage(current);
        } catch {
            if (seq !== requestSeq.current) return;
            setError(true);
        } finally {
            if (seq === requestSeq.current) setIsLoading(false);
        }
    }, []);

    // Debounce the typed text into the term that actually hits the API.
    useEffect(() => {
        const t = setTimeout(() => setTerm(query), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        if (isOpen) {
            setActiveIndex(-1);
            load(term, 1);
        }
    }, [isOpen, term, load]);

    // The selection's name when it is among the loaded options.
    const knownLabel = useMemo(() => {
        const known = options.find(o => o.id === value);
        return known ? labelOf(known) : null;
    }, [options, value]);

    // Resolve the name by id only when it is not already known, and at most once
    // per id (not on every options change or render).
    useEffect(() => {
        if (!value) return;
        if (knownLabel !== null) {
            if (resolved?.id !== value || resolved.label !== knownLabel) setResolved({ id: value, label: knownLabel });
            return;
        }
        if (resolved?.id === value) return;
        let cancelled = false;
        (async () => {
            try {
                const p = await crmService.getProjectById(value);
                if (!cancelled) setResolved({ id: value, label: p ? labelOf(p) : '' });
            } catch {
                if (!cancelled) setResolved({ id: value, label: '' });
            }
        })();
        return () => { cancelled = true; };
    }, [value, knownLabel, resolved]);

    const selectedLabel = useMemo(() => {
        if (!value) return '';
        if (knownLabel !== null) return knownLabel;
        return resolved?.id === value ? resolved.label : '';
    }, [value, knownLabel, resolved]);

    // Return focus to the trigger once it is back in the DOM after closing.
    useEffect(() => {
        if (!isOpen && restoreFocus.current) {
            restoreFocus.current = false;
            triggerRef.current?.focus();
        }
    }, [isOpen]);

    // Keep the highlighted option visible while arrowing through a long list.
    useEffect(() => {
        if (!isOpen || activeIndex < 0) return;
        document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
    }, [isOpen, activeIndex, listId]);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setQuery('');
                setTerm('');
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const close = () => {
        setIsOpen(false);
        setQuery('');
        setTerm('');
    };

    const select = (id: string) => {
        onChange(id);
        restoreFocus.current = true;
        close();
    };

    // Index 0 is the "none" row; project rows follow.
    const rowCount = options.length + 1;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            restoreFocus.current = true;
            close();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, rowCount - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            // Never let Enter submit the surrounding task form from the picker.
            e.preventDefault();
            if (activeIndex === 0) select('');
            else if (activeIndex > 0 && options[activeIndex - 1]) select(options[activeIndex - 1].id);
        }
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setIsOpen(true);
        }
    };

    // Tabbing out of the picker closes it (no focus trap). relatedTarget is null
    // for clicks in browsers that don't focus buttons, so those are ignored here;
    // the outside-mousedown handler above covers them.
    const handleBlur = (e: React.FocusEvent) => {
        const next = e.relatedTarget as Node | null;
        if (isOpen && next && containerRef.current && !containerRef.current.contains(next)) close();
    };

    // "No projects found" only when there is genuinely nothing more to read.
    const showEmpty = !isLoading && !error && options.length === 0 && !hasMore;
    const optionId = (index: number) => `${listId}-opt-${index}`;

    return (
        <div ref={containerRef} onBlur={handleBlur} className={`relative ${className}`} data-testid="project-select">
            {isOpen ? (
                <div
                    className={`flex items-center gap-2 w-full bg-slate-950 border rounded-xl px-4 py-3 transition-all border-blue-500 ring-2 ring-blue-500/20 ${inputClassName}`}
                >
                    <Search size={14} className="text-slate-500 shrink-0" />
                    <input
                        autoFocus
                        type="text"
                        role="combobox"
                        aria-expanded={true}
                        aria-haspopup="listbox"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedLabel || placeholder}
                        aria-label="Search projects"
                        aria-autocomplete="list"
                        aria-controls={listId}
                        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                        className="flex-1 bg-transparent font-bold text-slate-50 outline-none placeholder:text-slate-500 min-w-0"
                        data-testid="project-select-input"
                    />
                    <ChevronDown size={14} className="text-slate-500 shrink-0 transition-transform rotate-180" />
                </div>
            ) : (
                <>
                    <button
                        ref={triggerRef}
                        type="button"
                        role="combobox"
                        aria-label="Project"
                        aria-expanded={false}
                        aria-haspopup="listbox"
                        aria-controls={listId}
                        aria-disabled={disabled}
                        disabled={disabled}
                        onClick={() => { if (!disabled) setIsOpen(true); }}
                        onKeyDown={handleTriggerKeyDown}
                        className={`flex items-center gap-2 w-full text-left bg-slate-950 border rounded-xl px-4 py-3 cursor-pointer transition-all border-slate-700/50 hover:border-slate-600 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20
                            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            ${inputClassName}`}
                    >
                        <Search size={14} className="text-slate-500 shrink-0" />
                        <span className={`flex-1 font-bold truncate ${value ? 'text-slate-50' : 'text-slate-400'}`}>
                            {value ? (selectedLabel || '…') : noneLabel}
                        </span>
                        {/* The clear button overlays this slot when a project is selected. */}
                        {value
                            ? <span className="w-[14px] shrink-0" aria-hidden="true" />
                            : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                    </button>
                    {value && (
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label="Clear project"
                            data-testid="project-select-clear"
                        >
                            <X size={14} />
                        </button>
                    )}
                </>
            )}

            {isOpen && (
                <div
                    role="listbox"
                    id={listId}
                    aria-label="Projects"
                    className="absolute z-50 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
                    data-testid="project-select-list"
                >
                    <div className="max-h-56 overflow-y-auto">
                        {/* Options are driven by aria-activedescendant, so they stay out of the Tab order. */}
                        <button
                            type="button"
                            role="option"
                            tabIndex={-1}
                            id={optionId(0)}
                            aria-selected={!value}
                            onClick={() => select('')}
                            className={`w-full text-left px-3 py-2 text-sm italic transition-colors ${activeIndex === 0 ? 'bg-slate-800' : 'hover:bg-slate-800'} text-slate-400`}
                            data-testid="project-option-none"
                        >
                            {noneLabel}
                        </button>
                        {options.map((p, i) => (
                            <button
                                key={p.id}
                                type="button"
                                role="option"
                                tabIndex={-1}
                                id={optionId(i + 1)}
                                aria-selected={p.id === value}
                                onClick={() => select(p.id)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between
                                    ${p.id === value ? 'bg-blue-600/20 text-blue-400' : 'text-slate-200'}
                                    ${activeIndex === i + 1 ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
                                data-testid={`project-option-${p.id}`}
                            >
                                <span className="font-medium truncate">{labelOf(p)}</span>
                                {codeOf(p) && <span className="text-slate-400 text-xs ml-2 shrink-0">{codeOf(p)}</span>}
                            </button>
                        ))}
                        {isLoading && (
                            <div className="px-3 py-3 flex items-center justify-center gap-2 text-sm text-slate-500" data-testid="project-select-loading">
                                <Loader2 size={14} className="animate-spin" /> Loading projects…
                            </div>
                        )}
                        {error && (
                            <div className="px-3 py-3 text-sm text-center text-red-400" role="alert" data-testid="project-select-error">
                                Couldn't load projects.{' '}
                                <button type="button" onClick={() => load(term, 1)} className="underline font-bold" data-testid="project-select-retry">
                                    Retry
                                </button>
                            </div>
                        )}
                        {showEmpty && (
                            <div className="px-3 py-3 text-sm text-slate-500 text-center italic" data-testid="project-select-empty">
                                No projects found
                            </div>
                        )}
                        {hasMore && !isLoading && !error && (
                            <button
                                type="button"
                                onClick={() => load(term, page + 1)}
                                className="w-full px-3 py-2 text-xs font-bold text-blue-400 hover:bg-slate-800 transition-colors"
                                data-testid="project-select-more"
                            >
                                Load more
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSelect;
