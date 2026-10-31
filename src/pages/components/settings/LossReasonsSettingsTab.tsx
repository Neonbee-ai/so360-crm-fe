import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast, useConfirm, Card, Button, IconButton, TextField, Checkbox, Skeleton } from '@so360/design-system';
import { lossReasonsService, LossReason } from '../../../services/salesConfigService';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean }

/** Settings -> Loss reasons. The org's own list; deals must pick one when lost. */
const LossReasonsSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [rows, setRows] = useState<LossReason[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [label, setLabel] = useState('');
    const [needsCompetitor, setNeedsCompetitor] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setRows(await lossReasonsService.list()); }
        catch (err) { toast.error(describeApiError(err, 'Could not load loss reasons.')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!label.trim()) { toast.error('Give the reason a name.'); return; }
        setBusy(true);
        try {
            await lossReasonsService.create({ label: label.trim(), requires_competitor: needsCompetitor });
            setLabel(''); setNeedsCompetitor(false);
            toast.success('Loss reason added');
            await load();
        } catch (err) { toast.error(describeApiError(err, 'Could not add the reason.')); }
        finally { setBusy(false); }
    };

    const patch = async (row: LossReason, body: Partial<LossReason>) => {
        setBusy(true);
        try {
            await lossReasonsService.update(row.id, body);
            setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...body } : r)));
        } catch (err) { toast.error(describeApiError(err, 'Could not update the reason.')); }
        finally { setBusy(false); }
    };

    const remove = async (row: LossReason) => {
        if (!await confirm({ title: 'Delete?', message: `Delete the reason "${row.label}"?`, intent: 'danger', confirmLabel: 'Delete' })) return;
        setBusy(true);
        try {
            await lossReasonsService.remove(row.id);
            setRows((rs) => rs.filter((r) => r.id !== row.id));
            toast.success('Loss reason deleted');
        } catch (err) { toast.error(describeApiError(err, 'Could not delete the reason.')); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-nb-4" data-testid="loss-reasons-tab">
            {confirmDialog}
            <Card title="Loss reasons">
                <p className="text-xs text-fg-muted mb-nb-3">Sales picks one of these when a deal is marked lost.</p>
                {canWrite && (
                    <div className="flex flex-wrap items-end gap-nb-3 mb-nb-4">
                        <TextField name="loss-reason-label" label="New reason" value={label} onChange={(e) => setLabel(e.target.value)} />
                        <Checkbox name="loss-reason-competitor" label="Ask for the competitor" checked={needsCompetitor} onChange={(e) => setNeedsCompetitor(e.target.checked)} />
                        <Button type="button" variant="primary" onClick={add} disabled={busy}><Plus size={14} /> Add</Button>
                    </div>
                )}
                {loading ? <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading...</span></div> : rows.length === 0 ? (
                    <p className="text-sm text-fg-muted" data-testid="loss-reasons-empty">No reasons yet. Until you add some, deals ask for a free-text reason.</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map((r) => (
                            <li key={r.id} className="flex items-center gap-nb-3 py-nb-2" data-testid={`loss-reason-${r.id}`}>
                                <span className="flex-1 text-sm text-fg">{r.label}</span>
                                <Checkbox name={`loss-reason-${r.id}-competitor`} label="Competitor" checked={!!r.requires_competitor} disabled={!canWrite || busy} onChange={(e) => patch(r, { requires_competitor: e.target.checked })} />
                                <Checkbox name={`loss-reason-${r.id}-active`} label="Active" checked={r.is_active !== false} disabled={!canWrite || busy} onChange={(e) => patch(r, { is_active: e.target.checked })} />
                                {canWrite && <IconButton label={`Delete ${r.label}`} variant="danger" icon={<Trash2 size={14} />} onClick={() => remove(r)} />}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default LossReasonsSettingsTab;
