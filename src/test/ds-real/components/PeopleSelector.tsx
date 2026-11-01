import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCombField } from './FormField';
import { Search, X, ChevronDown, User, Loader2 } from 'lucide-react';
import { httpGetJson } from './httpGetJson';
import { getAccessToken } from './authToken';
import { mergeClassName } from '../utils/cx';

/**
 * Resolves the People Connect base URL. Order: shell-injected window global
 * (works for pre-built remoteEntry.js bundles without a rebuild), then this
 * MFE's own build-time env, then a hostname-based fallback for the cloud
 * environments, then localhost.
 *
 * This file previously hardcoded `http://localhost:3015`, so every deployed
 * environment asked the viewer's own machine for the people list and the
 * selector was permanently empty outside a developer's laptop.
 *
 * `import.meta.env.VITE_SO360_PEOPLE_API` is accessed as a LITERAL on purpose:
 * this file is bundled from source into each consuming MFE, and Vite only
 * substitutes the exact text. An optional chain or a cast in the middle of
 * that expression silently ships the fallback instead.
 */
export function resolvePeopleApiUrl(): string {
  if (typeof window !== 'undefined' && typeof (window as any).VITE_SO360_PEOPLE_API === 'string' && (window as any).VITE_SO360_PEOPLE_API.trim()) {
    return (window as any).VITE_SO360_PEOPLE_API.trim().replace(/\/$/, '');
  }

  const envUrl = (import.meta.env.VITE_SO360_PEOPLE_API as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h.startsWith('dev.')) return 'https://dev.api.neonbee.app/people-api';
    if (h.startsWith('staging.')) return 'https://staging.api.neonbee.app/people-api';
    if (h.endsWith('.neonbee.app') || h.endsWith('.neonbee.ai')) return 'https://api.neonbee.app/people-api';
  }

  return 'http://localhost:3015';
}

export interface Person {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  job_title?: string;
  department_id?: string;
  department_name?: string;
  status: string;
  type: string;
}

export interface PeopleSelectorProps {
  /** Stable field name for Comb automation (data-comb-id). */
  name?: string;
  value?: string | string[];
  onChange: (personId: string | string[] | null, person?: Person | Person[]) => void;
  /** Required for the People Connect API source; unused with `loadOptions` / `options`. */
  orgId?: string;
  tenantId?: string;
  filters?: {
    department_id?: string;
    status?: 'active' | 'inactive' | 'on_leave' | 'terminated';
    type?: 'employee' | 'contractor';
    employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern';
  };
  multiSelect?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  required?: boolean;
  /**
   * Custom data source (replaces the People Connect `/people` call). Loaded once on mount and
   * filtered client-side. Use for broker routes, e.g. `() => crmService.getSalesReps()`.
   */
  loadOptions?: () => Promise<Person[]>;
  /** Static data source; same client-side filtering as `loadOptions`. */
  options?: Person[];
  /** Single-select only: shows a ✕ to clear the selection (onChange(null)). */
  clearable?: boolean;
}

/** Multi-field match used for custom sources: name, email, title, department. */
export function matchPerson(p: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.full_name, p.email, p.job_title, p.department_name].some((v) => (v || '').toLowerCase().includes(q));
}

const STATUS_COLORS = {
  active: 'bg-success',
  inactive: 'bg-fg-subtle',
  on_leave: 'bg-warning',
  terminated: 'bg-danger',
};

export const PeopleSelector: React.FC<PeopleSelectorProps> = ({
  name,
  value,
  onChange,
  orgId,
  tenantId,
  filters,
  multiSelect = false,
  placeholder = 'Select person...',
  clearable = false,
  disabled = false,
  className = '',
  error,
  required = false,
  loadOptions,
  options,
}) => {
  const comb = useCombField(name ?? 'people', 'people', { disabled, invalid: Boolean(error), required });
  const custom = Boolean(loadOptions || options);
  const [customPeople, setCustomPeople] = useState<Person[]>(options ?? []);
  const [customLoading, setCustomLoading] = useState(Boolean(loadOptions));
  const [customFailed, setCustomFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Get selected values as array
  const selectedIds = Array.isArray(value) ? value : value ? [value] : [];

  // Fetch people from API
  const fetchPeople = useCallback(async (search: string, currentPage: number, append = false) => {
    setLoading(true);
    try {
      // Get auth token from localStorage (set by shell)
      const token = getAccessToken();
      const effectiveTenantId = tenantId || localStorage.getItem('active_tenant');

      const body = await httpGetJson(`${resolvePeopleApiUrl()}/people`, {
        params: {
          search: search || undefined,
          page: currentPage,
          limit: 20,
          ...filters,
        },
        headers: {
          'X-Tenant-Id': effectiveTenantId || '',
          'X-Org-Id': orgId ?? '',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      const { data, meta } = body;

      if (append) {
        setPeople(prev => [...prev, ...data]);
      } else {
        setPeople(data);
      }

      setHasMore(meta.currentPage < meta.totalPages);
    } catch (err) {
      console.error('Failed to fetch people:', err);
      setPeople([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [orgId, tenantId, filters]);

  // Custom source: load once on mount.
  useEffect(() => {
    if (options) setCustomPeople(options);
  }, [options]);
  useEffect(() => {
    if (!loadOptions) return;
    let alive = true;
    setCustomLoading(true);
    loadOptions()
      .then((rows) => { if (alive) { setCustomPeople(rows ?? []); setCustomFailed(false); } })
      .catch(() => { if (alive) setCustomFailed(true); })
      .finally(() => { if (alive) setCustomLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (custom) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isOpen) {
        setPage(1);
        fetchPeople(searchTerm, 1, false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, isOpen, fetchPeople, custom]);

  const shownPeople = useMemo(
    () => (custom ? customPeople.filter((p) => matchPerson(p, searchTerm)).slice(0, 50) : people),
    [custom, customPeople, searchTerm, people],
  );
  const isLoading = custom ? customLoading : loading;

  // Hydrate selected chips from a pre-set `value` when the source can resolve it.
  const displayPeople = useMemo(() => {
    if (!custom) return selectedPeople;
    return selectedIds
      .map((id) => customPeople.find((p) => p.id === id) ?? selectedPeople.find((p) => p.id === id))
      .filter((p): p is Person => Boolean(p));
  }, [custom, selectedIds, customPeople, selectedPeople]);

  // Load more on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50 && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPeople(searchTerm, nextPage, true);
    }
  };

  // Handle selection
  const handleSelect = (person: Person) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(person.id);
      let newSelectedIds: string[];
      let newSelectedPeople: Person[];

      if (isSelected) {
        newSelectedIds = selectedIds.filter(id => id !== person.id);
        newSelectedPeople = selectedPeople.filter(p => p.id !== person.id);
      } else {
        newSelectedIds = [...selectedIds, person.id];
        newSelectedPeople = [...selectedPeople, person];
      }

      setSelectedPeople(newSelectedPeople);
      onChange(newSelectedIds, newSelectedPeople);
    } else {
      setSelectedPeople([person]);
      onChange(person.id, person);
      setIsOpen(false);
    }
  };

  // Remove chip
  const handleRemove = (personId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedIds = selectedIds.filter(id => id !== personId);
    const newSelectedPeople = selectedPeople.filter(p => p.id !== personId);
    setSelectedPeople(newSelectedPeople);
    onChange(multiSelect ? newSelectedIds : null, multiSelect ? newSelectedPeople : undefined);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} {...comb} className={mergeClassName(`relative`, className)} onKeyDown={handleKeyDown}>
      {/* Main input */}
      <div
        className={`
          relative min-h-nb-control-md flex flex-col justify-center px-3 py-1 bg-surface-raised border rounded-lg cursor-pointer
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-fg-subtle'}
          ${error ? 'border-danger' : 'border-line'}
          ${isOpen ? 'border-primary ring-2 ring-focus' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-wrap min-h-[26px]">
          {displayPeople.length > 0 ? (
            multiSelect ? (
              displayPeople.map(person => (
                <div
                  key={person.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-muted rounded text-sm text-fg"
                >
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <User className="w-4 h-4 text-fg-muted" />
                  )}
                  <span>{person.full_name}</span>
                  <button
                    onClick={(e) => handleRemove(person.id, e)}
                    className="hover:text-danger transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2">
                {displayPeople[0].avatar_url ? (
                  <img src={displayPeople[0].avatar_url} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <User className="w-5 h-5 text-fg-muted" />
                )}
                <span className="text-fg">{displayPeople[0].full_name}</span>
                {clearable && !disabled && (
                  <button
                    type="button"
                    aria-label="Clear selection"
                    onClick={(e) => handleRemove(displayPeople[0].id, e)}
                    className="relative z-10 hover:text-danger text-fg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          ) : (
            <span className="text-fg-muted">{placeholder}</span>
          )}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className={`w-5 h-5 text-fg-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-full bg-surface-raised border border-line rounded-lg shadow-lg max-h-[400px] overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-line">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search people..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[320px] overflow-y-auto" onScroll={handleScroll}>
            {isLoading && page === 1 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : shownPeople.length === 0 ? (
              <div className="py-8 text-center text-fg-muted">
                {customFailed ? 'People directory unavailable' : searchTerm ? 'No people found' : 'No people available'}
              </div>
            ) : (
              <>
                {shownPeople.map((person) => {
                  const isSelected = selectedIds.includes(person.id);
                  return (
                    <div
                      key={person.id}
                      className={`
                        px-3 py-2.5 cursor-pointer transition-colors border-b border-line last:border-b-0
                        ${isSelected ? 'bg-surface-muted' : 'hover:bg-surface-high'}
                      `}
                      onClick={() => handleSelect(person)}
                    >
                      <div className="flex items-center gap-3">
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-fg-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-fg truncate">{person.full_name}</span>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[person.status as keyof typeof STATUS_COLORS] || 'bg-fg-subtle'}`} />
                          </div>
                          <div className="text-xs text-fg-muted truncate">
                            {person.job_title && <span>{person.job_title}</span>}
                            {person.job_title && person.department_name && <span className="mx-1">•</span>}
                            {person.department_name && <span>{person.department_name}</span>}
                          </div>
                        </div>
                        {multiSelect && isSelected && (
                          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-primary-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!custom && loading && page > 1 && (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
