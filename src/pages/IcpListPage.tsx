import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DeleteConfirmDialog, toast } from '@so360/design-system';
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

    const linkBtn = 'rounded-lg px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-50';

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-50">Ideal customer profiles</h1>
                    {!loading && <p className="mt-1 font-medium text-slate-400">{`${icps.length} profile${icps.length === 1 ? '' : 's'}`}</p>}
                </div>
                {canCreate && <Button onClick={() => navigate(`${BASE}/new`)}>New ICP</Button>}
            </header>
            {loading ? (
                <div className="flex justify-center py-10 text-slate-400" data-testid="icp-loading"><span data-testid="spinner">Loading…</span></div>
            ) : error ? (
                <div role="status" className="rounded-2xl border border-slate-700/50 bg-slate-900 p-8 text-center">
                    <h3 className="font-black text-slate-50">Could not load profiles</h3>
                    <p className="mt-1 text-slate-400">{error}</p>
                    <div className="mt-4"><Button onClick={() => void load()}>Retry</Button></div>
                </div>
            ) : icps.length === 0 ? (
                <div role="status" className="rounded-2xl border border-slate-700/50 bg-slate-900 p-8 text-center">
                    <h3 className="font-black text-slate-50">No ideal customer profiles yet</h3>
                    <p className="mt-1 text-slate-400">An ICP describes who you want to sell to. The LinkedIn extension scores every profile you capture against it to give a fit score, and can add strong matches to a list automatically.</p>
                    {canCreate && <div className="mt-4"><Button onClick={() => navigate(`${BASE}/new`)}>New ICP</Button></div>}
                </div>
            ) : (
                <table className="w-full text-sm text-slate-200" data-testid="icp-table">
                    <thead>
                        <tr className="border-b border-slate-700/50 text-left text-slate-400">
                            <th className="py-2 pr-3 font-medium">Name</th>
                            <th className="py-2 pr-3 font-medium">Criteria</th>
                            <th className="py-2 pr-3 font-medium">Auto-add to list</th>
                            <th className="py-2 font-medium" aria-label="Actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {icps.map((icp) => {
                            const items = rowItems(icp);
                            const seg = segmentName(icp.auto_segment_id);
                            return (
                                <tr key={icp.id} className="border-b border-slate-700/50" data-testid={`icp-row-${icp.id}`}>
                                    <td className="py-3 pr-3">
                                        <span className="font-medium">{icp.name}</span>{' '}
                                        {icp.is_default && (
                                            <span data-testid="badge" className="rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-bold text-blue-300">Default</span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-3" data-testid={`icp-count-${icp.id}`}>{icp.icp_criteria?.length ?? 0}</td>
                                    <td className="py-3 pr-3 text-slate-400">
                                        {seg ? `${seg} · score ≥ ${icp.auto_segment_min_score ?? 70}` : '—'}
                                    </td>
                                    <td className="py-3 text-right">
                                        {items.length > 0 && (
                                            <div role="group" aria-label={`Actions for ${icp.name}`} className="inline-flex gap-1">
                                                {items.map((it) => (
                                                    <button
                                                        key={it.label}
                                                        type="button"
                                                        className={it.danger ? `${linkBtn} text-red-400` : linkBtn}
                                                        onClick={it.onSelect}
                                                    >
                                                        {it.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
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
        </div>
    );
};

export default IcpListPage;
