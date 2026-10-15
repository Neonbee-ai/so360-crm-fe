import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Target } from 'lucide-react';
import { Badge, Button, EmptyState, ListPageTemplate, Menu, Spinner, toast, useConfirm } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { icpService, type Icp } from '../services/icpService';

const BASE = '/crm/settings/icps';

const IcpListPage: React.FC = () => {
    const navigate = useNavigate();
    const shell = useShellBridge() as any;
    const canCreate = shell?.hasPermission?.('linkedin_sync.create') ?? true;
    const canUpdate = shell?.hasPermission?.('linkedin_sync.update') ?? true;
    const canDelete = shell?.hasPermission?.('linkedin_sync.delete') ?? true;
    const [confirm, confirmDialog] = useConfirm();

    const [icps, setIcps] = useState<Icp[]>([]);
    const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const onArchive = async (icp: Icp) => {
        const ok = await confirm({
            title: 'Archive profile',
            message: `Archive "${icp.name}"? It will stop scoring new LinkedIn leads.`,
            confirmLabel: 'Archive',
            intent: 'danger',
        });
        if (!ok) return;
        try {
            await icpService.archive(icp.id);
            toast.success('Profile archived');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not archive profile');
        }
    };

    const rowItems = (icp: Icp) => [
        ...(canUpdate ? [{ label: 'Edit', onSelect: () => navigate(`${BASE}/${icp.id}`) }] : []),
        ...(canUpdate && !icp.is_default ? [{ label: 'Set as default', onSelect: () => void onSetDefault(icp) }] : []),
        ...(canDelete ? [{ label: 'Archive', danger: true, onSelect: () => void onArchive(icp) }] : []),
    ];

    return (
        <>
            <ListPageTemplate
                title="Ideal customer profiles"
                description={loading ? undefined : `${icps.length} profile${icps.length === 1 ? '' : 's'}`}
                primaryAction={canCreate ? <Button onClick={() => navigate(`${BASE}/new`)}>New ICP</Button> : undefined}
            >
                {loading ? (
                    <div className="flex justify-center py-10" data-testid="icp-loading"><Spinner /></div>
                ) : error ? (
                    <EmptyState title="Could not load profiles" description={error} action={{ label: 'Retry', onClick: () => void load() }} />
                ) : icps.length === 0 ? (
                    <EmptyState
                        icon={Target}
                        title="No ideal customer profiles yet"
                        description="An ICP describes who you want to sell to. The LinkedIn extension scores every profile you capture against it to give a fit score, and can add strong matches to a list automatically."
                        action={canCreate ? { label: 'New ICP', onClick: () => navigate(`${BASE}/new`) } : undefined}
                    />
                ) : (
                    <table className="w-full text-nb-body text-fg" data-testid="icp-table">
                        <thead>
                            <tr className="border-b border-line text-left text-fg-muted">
                                <th className="py-nb-2 pr-nb-3 font-medium">Name</th>
                                <th className="py-nb-2 pr-nb-3 font-medium">Criteria</th>
                                <th className="py-nb-2 pr-nb-3 font-medium">Auto-add to list</th>
                                <th className="w-nb-control-md" aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {icps.map((icp) => {
                                const items = rowItems(icp);
                                const seg = segmentName(icp.auto_segment_id);
                                return (
                                    <tr key={icp.id} className="border-b border-line" data-testid={`icp-row-${icp.id}`}>
                                        <td className="py-nb-3 pr-nb-3">
                                            <span className="font-medium">{icp.name}</span>{' '}
                                            {icp.is_default && <Badge tone="primary" size="sm">Default</Badge>}
                                        </td>
                                        <td className="py-nb-3 pr-nb-3" data-testid={`icp-count-${icp.id}`}>{icp.icp_criteria?.length ?? 0}</td>
                                        <td className="py-nb-3 pr-nb-3 text-fg-muted">
                                            {seg ? `${seg} · score ≥ ${icp.auto_segment_min_score ?? 70}` : '—'}
                                        </td>
                                        <td className="py-nb-3 text-right">
                                            {items.length > 0 && (
                                                <Menu
                                                    items={items}
                                                    placement="bottom-end"
                                                    trigger={
                                                        <button
                                                            type="button"
                                                            aria-label={`Actions for ${icp.name}`}
                                                            className="inline-flex min-h-nb-touch min-w-nb-touch items-center justify-center rounded-nb text-fg-muted hover:bg-fg/state-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                    }
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </ListPageTemplate>
            {confirmDialog}
        </>
    );
};

export default IcpListPage;
