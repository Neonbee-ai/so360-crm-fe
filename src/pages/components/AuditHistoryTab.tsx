import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, Search, Filter, ShieldCheck } from 'lucide-react';
import { auditTrailApi, AuditTrailEntry, AuditTrailFilters } from '../../services/crmService';

interface Props {
    entityType: string;
    entityId: string;
}

const SOURCE_STYLE: Record<string, string> = {
    manual: 'bg-slate-800 text-slate-400 border-slate-700',
    api: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    workflow: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    import: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ai: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    scheduled_job: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

function fieldLabel(fieldName: string | null): string {
    if (!fieldName) return '—';
    return fieldName
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

const PAGE_SIZE = 25;

export default function AuditHistoryTab({ entityType, entityId }: Props) {
    const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exporting, setExporting] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

    const buildFilters = useCallback((pageOffset: number): AuditTrailFilters => ({
        search: search || undefined,
        source: sourceFilter || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        limit: PAGE_SIZE,
        offset: pageOffset,
    }), [search, sourceFilter, startDate, endDate]);

    const load = useCallback(async (pageOffset: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await auditTrailApi.getAuditTrail(entityType, entityId, buildFilters(pageOffset));
            setEntries(result.data);
            setTotal(result.meta.total);
            setOffset(pageOffset);
        } catch (err: any) {
            setError(err.message || 'Failed to load audit trail');
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, buildFilters]);

    useEffect(() => {
        load(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityType, entityId, search, sourceFilter, startDate, endDate]);

    const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
        setExporting(format);
        try {
            const { blob, filename } = await auditTrailApi.exportAuditTrail(entityType, entityId, format, buildFilters(0));
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `audit-trail_${entityType}_${entityId}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || 'Export failed');
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck size={14} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">System-generated, read-only audit history</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search field, value, or description..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50"
                    />
                </div>
                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
                >
                    <option value="">All Sources</option>
                    <option value="manual">Manual</option>
                    <option value="api">API</option>
                    <option value="workflow">Workflow</option>
                    <option value="import">Import</option>
                    <option value="ai">AI</option>
                    <option value="scheduled_job">Scheduled Job</option>
                </select>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
                />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
                />
                <div className="flex items-center gap-1 ml-auto">
                    {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                        <button
                            key={format}
                            onClick={() => handleExport(format)}
                            disabled={exporting !== null}
                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            {exporting === format ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <Filter size={24} className="mb-2" />
                    <p className="text-xs">No audit history matches these filters.</p>
                </div>
            ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-900/80 text-slate-500 uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="text-left px-4 py-3 font-black">Field / Event</th>
                                <th className="text-left px-4 py-3 font-black">Previous Value</th>
                                <th className="text-left px-4 py-3 font-black">New Value</th>
                                <th className="text-left px-4 py-3 font-black">Modified By</th>
                                <th className="text-left px-4 py-3 font-black">Date &amp; Time</th>
                                <th className="text-left px-4 py-3 font-black">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-900/40">
                                    <td className="px-4 py-3 text-slate-200 font-semibold">
                                        {entry.kind === 'field_change' ? fieldLabel(entry.field_name) : (entry.description || 'Event')}
                                        {entry.change_reason && (
                                            <div className="text-slate-500 text-[11px] font-normal mt-0.5">{entry.change_reason}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">{entry.old_value ?? '—'}</td>
                                    <td className="px-4 py-3 text-slate-200">{entry.new_value ?? '—'}</td>
                                    <td className="px-4 py-3 text-slate-400">{entry.changed_by_name || 'System'}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatDateTime(entry.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${SOURCE_STYLE[entry.source || 'manual']}`}>
                                            {entry.source || 'manual'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                            disabled={offset === 0 || loading}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => load(offset + PAGE_SIZE)}
                            disabled={offset + PAGE_SIZE >= total || loading}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
