import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, EmptyState, Skeleton, DataTable, SearchInput, ListFilters, type ListFilterConfig, type FilterValues } from '@so360/design-system';
import { Filter, ShieldCheck } from 'lucide-react';
import ExportMenu from '../../components/ExportMenu';
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
        const { blob, filename } = await auditTrailApi.exportAuditTrail(entityType, entityId, format, buildFilters(0));
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `audit-trail_${entityType}_${entityId}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const filterConfig: ListFilterConfig = {
        fields: [
            {
                key: 'source', label: 'Source', type: 'select', quick: true,
                options: [
                    { value: 'manual', label: 'Manual' },
                    { value: 'api', label: 'API' },
                    { value: 'workflow', label: 'Workflow' },
                    { value: 'import', label: 'Import' },
                    { value: 'ai', label: 'AI' },
                    { value: 'scheduled_job', label: 'Scheduled Job' },
                ],
            },
            { key: 'range', label: 'Date range', type: 'daterange' },
        ],
        values: {
            ...(sourceFilter ? { source: sourceFilter } : {}),
            ...(startDate || endDate ? { range: { start: startDate, end: endDate } } : {}),
        } as FilterValues,
        onChange: (next: FilterValues) => {
            const r = next.range as { start?: string; end?: string } | undefined;
            setSourceFilter((next.source as string) || '');
            setStartDate(r?.start ?? '');
            setEndDate(r?.end ?? '');
        },
        onClear: () => { setSourceFilter(''); setStartDate(''); setEndDate(''); },
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-fg-muted">
                <ShieldCheck size={14} />
                <p className="text-xs font-medium">System-generated, read-only audit history</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-48">
                    <SearchInput
                        name="audit-search"
                        aria-label="Search audit history"
                        value={search}
                        onChange={setSearch}
                        placeholder="Search field, value, or description..."
                    />
                </div>
                <ListFilters {...filterConfig} />
                <ExportMenu className="ml-auto" label="Export audit history" onExport={handleExport} />
            </div>

            {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-nb px-4 py-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="py-nb-4"><Skeleton variant="text" lines={4} /></div>
            ) : entries.length === 0 ? (
                <EmptyState icon={Filter} title="No audit history matches these filters" />
            ) : (
                <DataTable
                    name="audit-history"
                    columns={[
                        { key: 'field', header: 'Field or event', widthClassName: 'min-w-48', render: (entry: AuditTrailEntry) => (
                            <div className="text-fg font-semibold">
                                {entry.kind === 'field_change' ? fieldLabel(entry.field_name) : (entry.description || 'Event')}
                                {entry.change_reason && (
                                    <div className="text-fg-muted text-xs font-normal mt-0.5">{entry.change_reason}</div>
                                )}
                            </div>
                        ) },
                        { key: 'old_value', header: 'Previous value', render: (entry: AuditTrailEntry) => <span className="text-fg-subtle">{entry.old_value ?? '—'}</span> },
                        { key: 'new_value', header: 'New value', render: (entry: AuditTrailEntry) => <span className="text-fg">{entry.new_value ?? '—'}</span> },
                        { key: 'changed_by', header: 'Modified by', render: (entry: AuditTrailEntry) => <span className="text-fg-subtle">{entry.changed_by_name || 'System'}</span> },
                        { key: 'created_at', header: 'Date and time', widthClassName: 'whitespace-nowrap min-w-44', render: (entry: AuditTrailEntry) => <span className="whitespace-nowrap text-fg-subtle">{formatDateTime(entry.created_at)}</span> },
                        { key: 'source', header: 'Source', render: (entry: AuditTrailEntry) => (
                            <Badge size="sm" tone={SOURCE_TONE[entry.source || 'manual'] ?? 'neutral'}>{entry.source || 'manual'}</Badge>
                        ) },
                    ]}
                    rows={entries}
                    rowKey={(entry: AuditTrailEntry) => String(entry.id)}
                />
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
