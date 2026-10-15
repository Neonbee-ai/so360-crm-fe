import React, { useState, useEffect } from 'react';
import { crmService } from '../../services/crmService';
import { User, DealFilters as Filters } from '../../types/crm';
import { X, Calendar, Search, Filter } from 'lucide-react';
import type { ListFilterConfig, FilterValues } from '@so360/design-system';

const DATE_RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_year', label: 'This Year' },
];

/** Comb `filterConfig` for deal lists: period/owner/company quick, custom range in the drawer. */
export function useDealFilterConfig(filters: Filters, onChange: (filters: Filters) => void): ListFilterConfig {
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => {
        let alive = true;
        crmService.getUsers().then((d) => { if (alive) setUsers(d ?? []); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);
    const hasRange = !!(filters.start_date || filters.end_date);
    const values: FilterValues = {};
    if (filters.date_range && filters.date_range !== 'custom') values.date_range = filters.date_range;
    if (filters.owner_id) values.owner_id = filters.owner_id;
    if (filters.company_name) values.company_name = filters.company_name;
    if (hasRange) values.range = { start: filters.start_date ?? '', end: filters.end_date ?? '' };
    return {
        fields: [
            { key: 'date_range', label: 'Date range', type: 'select', quick: true, options: DATE_RANGE_OPTIONS },
            { key: 'owner_id', label: 'Owner', type: 'select', quick: true, options: users.map((u) => ({ value: u.id, label: u.full_name })) },
            { key: 'company_name', label: 'Company', type: 'text', quick: true },
            { key: 'range', label: 'Custom range', type: 'daterange' },
        ],
        values,
        onChange: (next: FilterValues) => {
            const out: Filters = {};
            if (next.date_range) out.date_range = next.date_range as Filters['date_range'];
            if (next.owner_id) out.owner_id = next.owner_id as string;
            if (next.company_name) out.company_name = next.company_name as string;
            const r = next.range as { start?: string; end?: string } | undefined;
            if (r && (r.start || r.end)) {
                out.date_range = 'custom' as Filters['date_range'];
                if (r.start) out.start_date = r.start;
                if (r.end) out.end_date = r.end;
            }
            onChange(out);
        },
        onClear: () => onChange({}),
    };
}

interface DealFiltersProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
}

export const DealFilters: React.FC<DealFiltersProps> = ({ filters, onChange }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [showCustomDate, setShowCustomDate] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await crmService.getUsers();
                setUsers(data);
            } catch (error) {
                console.error('Failed to fetch users', error);
            }
        };
        fetchUsers();
    }, []);

    const handleChange = (key: keyof Filters, value: any) => {
        const newFilters = { ...filters };

        if (value === '' || value === undefined || value === null) {
            delete newFilters[key];
        } else {
            newFilters[key] = value;
        }

        if (key === 'date_range') {
            setShowCustomDate(value === 'custom');
            if (value !== 'custom') {
                delete newFilters.start_date;
                delete newFilters.end_date;
            }
        }

        onChange(newFilters);
    };

    const clearFilters = () => {
        onChange({});
        setShowCustomDate(false);
    };

    const hasActiveFilters = Object.keys(filters).length > 0;

    return (
        <div className="flex flex-wrap items-center gap-nb-2">
            <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={14} />
                <select
                    aria-label="Date range"
                    value={filters.date_range || ''}
                    onChange={(e) => handleChange('date_range', e.target.value)}
                    className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary pl-9 min-w-[10rem]"
                >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="this_year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>

            {showCustomDate && (
                <>
                    <input
                        type="date"
                        aria-label="Start date"
                        value={filters.start_date || ''}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                        className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary"
                    />
                    <input
                        type="date"
                        aria-label="End date"
                        value={filters.end_date || ''}
                        onChange={(e) => handleChange('end_date', e.target.value)}
                        className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary"
                    />
                </>
            )}

            <select
                aria-label="Owner"
                value={filters.owner_id || ''}
                onChange={(e) => handleChange('owner_id', e.target.value)}
                className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary min-w-[9rem]"
            >
                <option value="">All Owners</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
            </select>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={14} />
                <input
                    type="text"
                    placeholder="Search company..."
                    value={filters.company_name || ''}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary pl-9 w-full wc-medium:w-56"
                />
            </div>

            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 h-nb-control-md px-3 rounded-nb text-xs text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
                >
                    <X size={14} />
                    Clear
                </button>
            )}
        </div>
    );
};
