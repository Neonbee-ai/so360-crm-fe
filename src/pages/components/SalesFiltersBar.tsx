import { useEffect, useMemo, useState } from 'react';
import type { FilterField, FilterValues, ListFilterConfig } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import { validateDateRange, type SalesFilters } from '../../services/salesReportService';

export interface FilterOption {
    id: string;
    name: string;
}

export const hasActiveFilters = (f: SalesFilters): boolean =>
    Boolean(f.project_id || f.agent_id || f.developer_id || f.from || f.to);

/**
 * Shared filter config for the Sales register and the Commission report:
 * project (inventory categories), agent (CRM users) and developer (supplied by
 * the page) as quick filters, plus a from/to date range in the Filters drawer.
 * Option lists that fail to load simply stay empty; the page still works unfiltered.
 */
export function useSalesFilterConfig(
    value: SalesFilters,
    onChange: (next: SalesFilters) => void,
    developers: FilterOption[] = [],
): { config: ListFilterConfig; rangeError: string | null } {
    const [projects, setProjects] = useState<FilterOption[]>([]);
    const [agents, setAgents] = useState<FilterOption[]>([]);

    useEffect(() => {
        let alive = true;
        crmService.getProductCategories()
            .then((rows) => { if (alive) setProjects((rows || []).map((r) => ({ id: r.id, name: r.name }))); })
            .catch(() => { /* optional options */ });
        crmService.getUsers()
            .then((rows) => { if (alive) setAgents((rows || []).map((u) => ({ id: u.id, name: u.full_name || u.email }))); })
            .catch(() => { /* optional options */ });
        return () => { alive = false; };
    }, []);

    const opts = (list: FilterOption[]) => list.map((o) => ({ value: o.id, label: o.name }));
    const fields = useMemo<FilterField[]>(() => {
        const f: FilterField[] = [
            { key: 'project_id', label: 'Project', type: 'select', quick: true, options: opts(projects) },
            { key: 'agent_id', label: 'Agent', type: 'select', quick: true, options: opts(agents) },
        ];
        if (developers.length > 0) f.push({ key: 'developer_id', label: 'Developer', type: 'select', quick: true, options: opts(developers) });
        f.push({ key: 'range', label: 'Date range', type: 'daterange' });
        return f;
    }, [projects, agents, developers]);

    const values: FilterValues = {};
    if (value.project_id) values.project_id = value.project_id;
    if (value.agent_id) values.agent_id = value.agent_id;
    if (value.developer_id) values.developer_id = value.developer_id;
    if (value.from || value.to) values.range = { start: value.from ?? '', end: value.to ?? '' };

    const config: ListFilterConfig = {
        fields,
        values,
        onChange: (next) => {
            const r = next.range as { start?: string; end?: string } | null | undefined;
            const out: SalesFilters = {};
            if (typeof next.project_id === 'string') out.project_id = next.project_id;
            if (typeof next.agent_id === 'string') out.agent_id = next.agent_id;
            if (typeof next.developer_id === 'string') out.developer_id = next.developer_id;
            if (r?.start) out.from = r.start;
            if (r?.end) out.to = r.end;
            onChange(out);
        },
        onClear: () => onChange({}),
    };
    return { config, rangeError: validateDateRange(value) };
}
