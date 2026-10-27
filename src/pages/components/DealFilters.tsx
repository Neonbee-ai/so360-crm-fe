import React, { useState, useEffect } from 'react';
import { crmService } from '../../services/crmService';
import { User, DealFilters as Filters } from '../../types/crm';
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
