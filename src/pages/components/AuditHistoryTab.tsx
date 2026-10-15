import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, EmptyState } from '@so360/design-system';
import { Loader2, Download, Search, Filter, ShieldCheck } from 'lucide-react';
import { auditTrailApi, AuditTrailEntry, AuditTrailFilters } from '../../services/crmService';

interface Props {
    entityType: string;
    entityId: string;
}

const SOURCE_TONE: Record<string, 'neutral' | 'primary' | 'info' | 'warning' | 'success'> = {
    manual: 'neutral',
    api: 'primary',
    workflow: 'info',
    import: 'warning',
    ai: 'success',
    scheduled_job: 'info',
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
            <div className="flex items-center gap-2 text-fg-muted">
                <ShieldCheck size={14} />
                <p className="text-xs font-medium">System-generated, read-only audit history</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search field, value, or description..."
                        className="w-full bg-surface border border-line rounded-nb pl-9 pr-3 py-2 text-xs text-fg placeholder-fg-subtle outline-none focus:border-primary/50"
                    />
                </div>
                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-surface border border-line rounded-nb px-3 py-2 text-xs text-fg-subtle outline-none"
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
                    className="bg-surface border border-line rounded-nb px-3 py-2 text-xs text-fg-subtle outline-none"
                />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-surface border border-line rounded-nb px-3 py-2 text-xs text-fg-subtle outline-none"
                />
                <div className="flex items-center gap-1 ml-auto">
                    {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                        <Button
                            key={format}
                            variant="secondary"
                            onClick={() => handleExport(format)}
                            disabled={exporting !== null}
                        >
                            {exporting === format ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            {format.toUpperCase()}
                        </Button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-nb px-4 py-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12 text-fg-muted">
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : entries.length === 0 ? (
                <EmptyState icon={Filter} title="No audit history matches these filters" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-surface-sunken text-fg-muted text-xs">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Field or event</th>
                                <th className="text-left px-4 py-3 font-medium">Previous value</th>
                                <th className="text-left px-4 py-3 font-medium">New value</th>
                                <th className="text-left px-4 py-3 font-medium">Modified by</th>
                                <th className="text-left px-4 py-3 font-medium">Date and time</th>
                                <th className="text-left px-4 py-3 font-medium">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-surface-sunken">
                                    <td className="px-4 py-3 text-fg font-semibold">
                                        {entry.kind === 'field_change' ? fieldLabel(entry.field_name) : (entry.description || 'Event')}
                                        {entry.change_reason && (
                                            <div className="text-fg-muted text-xs font-normal mt-0.5">{entry.change_reason}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-fg-subtle">{entry.old_value ?? '—'}</td>
                                    <td className="px-4 py-3 text-fg">{entry.new_value ?? '—'}</td>
                                    <td className="px-4 py-3 text-fg-subtle">{entry.changed_by_name || 'System'}</td>
                                    <td className="px-4 py-3 text-fg-subtle">{formatDateTime(entry.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <Badge size="sm" tone={SOURCE_TONE[entry.source || 'manual'] ?? 'neutral'}>{entry.source || 'manual'}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
                    <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => load(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0 || loading}>
                            Previous
                        </Button>
                        <Button variant="secondary" onClick={() => load(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || loading}>
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
