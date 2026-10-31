import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import { Badge, Button, DeleteConfirmDialog, DataTable, EmptyState, ListPageTemplate, toast, type DataTableColumn, Skeleton } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { icpService, type Icp } from '../services/icpService';

const BASE = '/crm/settings/icps';

const IcpListPage: React.FC = () => {
    const navigate = useNavigate();
    const shell = useShellBridge() as any;
    const canCreate = shell?.hasPermission?.('linkedin_sync.create') ?? true;
    const canUpdate = shell?.hasPermission?.('linkedin_sync.update') ?? true;
    const canDelete = shell?.hasPermission?.('linkedin_sync.delete') ?? true;

    const [icps, setIcps] = useState<Icp[]>([]);
    const [audiences, setAudiences] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<Icp | null>(null);
    const [archiving, setArchiving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [list, segs] = await Promise.all([
                icpService.list(),
                icpService.audiences().catch(() => []),
            ]);
            setIcps(list);
            setAudiences(segs);
        } catch (e: any) {
            setError(e?.message || 'Could not load ideal customer profiles');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const audienceName = useMemo(() => {
        const m = new Map(audiences.map((s) => [s.id, s.name]));
        return (id?: string | null) => (id ? m.get(id) ?? 'Unknown list' : null);
    }, [audiences]);

    const onSetDefault = async (icp: Icp) => {
        try {
            await icpService.setDefault(icp.id);
            toast.success(`${icp.name} is now the default profile`);
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not set default');
        }
    };

    const onArchive = async () => {
        const icp = archiveTarget;
        if (!icp) return;
        setArchiving(true);
        try {
            await icpService.archive(icp.id);
            toast.success('Profile archived');
            setArchiveTarget(null);
            await load();
        } catch (e: any) {
            setArchiveTarget(null);
            toast.error(e?.message || 'Could not archive profile');
        } finally {
            setArchiving(false);
        }
    };

    const rowItems = (icp: Icp): { label: string; danger?: boolean; onSelect: () => void }[] => [
        ...(canUpdate ? [{ label: 'Edit', onSelect: () => navigate(`${BASE}/${icp.id}`) }] : []),
        ...(canUpdate && !icp.is_default ? [{ label: 'Set as default', onSelect: () => void onSetDefault(icp) }] : []),
        ...(canDelete ? [{ label: 'Archive', danger: true, onSelect: () => setArchiveTarget(icp) }] : []),
    ];

    const columns: DataTableColumn<Icp>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (icp) => (
                <>
                    <span className="font-medium">{icp.name}</span>{' '}
                    {icp.is_default && <Badge tone="primary" size="sm" data-testid="badge">Default</Badge>}
                </>
            ),
        },
        { key: 'criteria', header: 'Criteria', align: 'right', render: (icp) => <span data-testid={`icp-count-${icp.id}`}>{icp.icp_criteria?.length ?? 0}</span> },
        {
            key: 'auto',
            header: 'Auto-add to list',
            render: (icp) => {
                const seg = audienceName(icp.auto_audience_id);
                return <span className="text-fg-muted">{seg ? `${seg} · score ≥ ${icp.auto_segment_min_score ?? 70}` : '—'}</span>;
            },
        },
    ];

    const newBtn = <Button onClick={() => navigate(`${BASE}/new`)}>New ICP</Button>;

    const body = loading ? (
        <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4" data-testid="icp-loading">
            <Skeleton variant="rect" />
            <Skeleton variant="text" lines={3} />
            <span className="sr-only" data-testid="spinner">Loading…</span>
        </div>
    ) : error ? (
        <EmptyState title="Could not load profiles" description={error} action={{ label: 'Retry', onClick: () => void load() }} />
    ) : (
        <DataTable<Icp>
            name="icps"
            data-testid="icp-table"
            rows={icps}
            rowKey={(icp) => icp.id}
            columns={columns}
            getRowProps={(icp) => ({ 'data-testid': `icp-row-${icp.id}` })}
            rowActions={canUpdate || canDelete ? rowItems : undefined}
        />
    );

    return (
        <>
            <ListPageTemplate
                trail={[{ label: 'Settings', to: '/crm/settings' }]}
                title="Ideal customer profiles"
                description={!loading ? `${icps.length} profile${icps.length === 1 ? '' : 's'}` : undefined}
                primaryAction={canCreate ? newBtn : undefined}
                isEmpty={!loading && !error && icps.length === 0}
                empty={(
                    <EmptyState
                        icon={Target}
                        title="No ideal customer profiles yet"
                        description="An ICP describes who you want to sell to. The LinkedIn extension scores every profile you capture against it to give a fit score, and can add strong matches to a list automatically."
                        action={canCreate ? { label: 'New ICP', onClick: () => navigate(`${BASE}/new`) } : undefined}
                    />
                )}
            >
                {body}
            </ListPageTemplate>
            <DeleteConfirmDialog
                isOpen={archiveTarget !== null}
                onClose={() => setArchiveTarget(null)}
                onConfirm={() => void onArchive()}
                title="Archive profile"
                message={`Archive "${archiveTarget?.name ?? ''}"? It will stop scoring new LinkedIn leads.`}
                confirmText="Archive"
                isLoading={archiving}
                variant="danger"
            />
        </>
    );
};

export default IcpListPage;
