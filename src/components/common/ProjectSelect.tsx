import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
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
    const [selectedLabel, setSelectedLabel] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
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

    // Name of the current selection. It may be outside the loaded page (or a
    // closed project), so resolve it by id rather than by looking in `options`.
    useEffect(() => {
        if (!value) {
            setSelectedLabel('');
            return;
        }
        const known = options.find(o => o.id === value);
        if (known) {
            setSelectedLabel(labelOf(known));
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const p = await crmService.getProjectById(value);
                if (!cancelled) setSelectedLabel(p ? labelOf(p) : '');
            } catch {
                if (!cancelled) setSelectedLabel('');
            }
        })();
        return () => { cancelled = true; };
    }, [value, options]);

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
        close();
    };

    // Index 0 is the "none" row; project rows follow.
    const rowCount = options.length + 1;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
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

    // "No projects found" only when there is genuinely nothing more to read.
    const showEmpty = !isLoading && !error && options.length === 0 && !hasMore;
    const optionId = (index: number) => `${listId}-opt-${index}`;

    return (
        <div ref={containerRef} className={`relative ${className}`} data-testid="project-select">
            <div
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-disabled={disabled}
                onClick={() => { if (!disabled) setIsOpen(true); }}
                className={`flex items-center gap-2 w-full bg-slate-950 border rounded-xl px-4 py-3 cursor-pointer transition-all
                    ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700/50 hover:border-slate-600'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${inputClassName}`}
            >
                <Search size={14} className="text-slate-500 shrink-0" />
                {isOpen ? (
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={selectedLabel || placeholder}
                        aria-label="Search projects"
                        aria-autocomplete="list"
                        aria-controls={listId}
                        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                        className="flex-1 bg-transparent font-bold text-slate-50 outline-none placeholder:text-slate-500 min-w-0"
                        data-testid="project-select-input"
                    />
                ) : (
                    <span className={`flex-1 font-bold truncate ${value ? 'text-slate-50' : 'text-slate-400'}`}>
                        {value ? (selectedLabel || '…') : noneLabel}
                    </span>
                )}
                {value && !isOpen ? (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(''); }}
                        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        aria-label="Clear project"
                        data-testid="project-select-clear"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>

            {isOpen && (
                <div
                    role="listbox"
                    id={listId}
                    aria-label="Projects"
                    className="absolute z-50 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
                    data-testid="project-select-list"
                >
                    <div className="max-h-56 overflow-y-auto">
                        <button
                            type="button"
                            role="option"
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
