import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Target } from 'lucide-react';
import { Badge, Button, DeleteConfirmDialog, EmptyState, ListPageTemplate, Menu, Spinner, toast } from '@so360/design-system';
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
    const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
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
                icpService.segments().catch(() => []),
            ]);
            setIcps(list);
            setSegments(segs);
        } catch (e: any) {
            setError(e?.message || 'Could not load ideal customer profiles');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const segmentName = useMemo(() => {
        const m = new Map(segments.map((s) => [s.id, s.name]));
        return (id?: string | null) => (id ? m.get(id) ?? 'Unknown list' : null);
    }, [segments]);

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

    const newBtn = <Button onClick={() => navigate(`${BASE}/new`)}>New ICP</Button>;

    const body = loading ? (
        <div className="flex justify-center py-nb-6 text-fg-muted" data-testid="icp-loading">
            <Spinner /><span className="sr-only" data-testid="spinner">Loading…</span>
        </div>
    ) : error ? (
        <EmptyState title="Could not load profiles" description={error} action={{ label: 'Retry', onClick: () => void load() }} />
    ) : (
        <div className="w-full overflow-x-auto" data-testid="icp-table">
            <table className="w-full text-sm text-fg">
                <thead>
                    <tr className="border-b border-line text-left text-fg-muted">
                        <th className="py-nb-2 pr-nb-3 font-medium">Name</th>
                        <th className="py-nb-2 pr-nb-3 font-medium">Criteria</th>
                        <th className="py-nb-2 pr-nb-3 font-medium">Auto-add to list</th>
                        <th className="py-nb-2 font-medium" aria-label="Actions" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {icps.map((icp) => {
                        const items = rowItems(icp);
                        const seg = segmentName(icp.auto_segment_id);
                        return (
                            <tr key={icp.id} data-testid={`icp-row-${icp.id}`}>
                                <td className="py-nb-3 pr-nb-3">
                                    <span className="font-medium">{icp.name}</span>{' '}
                                    {icp.is_default && <Badge tone="primary" size="sm" data-testid="badge">Default</Badge>}
                                </td>
                                <td className="py-nb-3 pr-nb-3" data-testid={`icp-count-${icp.id}`}>{icp.icp_criteria?.length ?? 0}</td>
                                <td className="py-nb-3 pr-nb-3 text-fg-muted">
                                    {seg ? `${seg} · score ≥ ${icp.auto_segment_min_score ?? 70}` : '—'}
                                </td>
                                <td className="py-nb-3 text-right">
                                    {items.length > 0 && (
                                        <Menu
                                            name={`icp-row-${icp.id}-menu`}
                                            trigger={<Button variant="secondary" size="sm" aria-label={`Actions for ${icp.name}`}><MoreVertical className="h-4 w-4" /></Button>}
                                            items={items}
                                            placement="bottom-end"
                                        />
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <>
            <ListPageTemplate
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
