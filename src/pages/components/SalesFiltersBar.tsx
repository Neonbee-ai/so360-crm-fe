import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { validateDateRange, type SalesFilters } from '../../services/salesReportService';

export interface FilterOption {
    id: string;
    name: string;
}

interface Props {
    value: SalesFilters;
    onChange: (next: SalesFilters) => void;
    /** Developers are not served by any list API — the page supplies what it has seen. */
    developers: FilterOption[];
}

const FIELD_CLS = 'bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-all font-bold text-xs';
const LABEL_CLS = 'flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500';

export const hasActiveFilters = (f: SalesFilters): boolean =>
    Boolean(f.project_id || f.agent_id || f.developer_id || f.from || f.to);

/**
 * Shared filter row for the Sales register and the Commission report:
 * project (inventory categories), agent (CRM users), developer (from the
 * page), and a from/to date range. Option lists that fail to load simply
 * stay empty — the page still works unfiltered.
 */
const SalesFiltersBar: React.FC<Props> = ({ value, onChange, developers }) => {
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

    const set = (key: keyof SalesFilters, v: string) => onChange({ ...value, [key]: v || undefined });
    const rangeError = validateDateRange(value);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3" data-testid="sales-filters">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <label className={LABEL_CLS}>
                    Project
                    <select aria-label="Project" className={FIELD_CLS} value={value.project_id ?? ''} onChange={(e) => set('project_id', e.target.value)}>
                        <option value="">All projects</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className={LABEL_CLS}>
                    Agent
                    <select aria-label="Agent" className={FIELD_CLS} value={value.agent_id ?? ''} onChange={(e) => set('agent_id', e.target.value)}>
                        <option value="">All agents</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>
                {developers.length > 0 && (
                    <label className={LABEL_CLS}>
                        Developer
                        <select aria-label="Developer" className={FIELD_CLS} value={value.developer_id ?? ''} onChange={(e) => set('developer_id', e.target.value)}>
                            <option value="">All developers</option>
                            {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </label>
                )}
                <label className={LABEL_CLS}>
                    From
                    <input type="date" aria-label="From" className={FIELD_CLS} value={value.from ?? ''} onChange={(e) => set('from', e.target.value)} />
                </label>
                <label className={LABEL_CLS}>
                    To
                    <input type="date" aria-label="To" className={FIELD_CLS} value={value.to ?? ''} onChange={(e) => set('to', e.target.value)} />
                </label>
            </div>
            <div className="flex items-center justify-between gap-3 min-h-[1.5rem]">
                {rangeError ? <p role="alert" className="text-xs font-bold text-rose-400">{rangeError}</p> : <span />}
                {hasActiveFilters(value) && (
                    <button
                        type="button"
                        onClick={() => onChange({})}
                        className="flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200"
                    >
                        <X size={12} /> Clear filters
                    </button>
                )}
            </div>
        </div>
    );
};

export default SalesFiltersBar;
