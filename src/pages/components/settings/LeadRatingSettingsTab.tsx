import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast, useConfirm, Card, Badge, Button, IconButton, TextField, NumberInput, Select, Checkbox, Skeleton } from '@so360/design-system';
import { ratingService, RatingCategory, COLOR_TOKENS, ColorToken } from '../../../services/salesConfigService';
import RatingMilestonesCard from './RatingMilestonesCard';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean }

const TONE_OPTIONS = COLOR_TOKENS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

/** Settings -> Lead rating. Labels with a colour and a score band; edit freely. */
const LeadRatingSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [rows, setRows] = useState<RatingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [label, setLabel] = useState('');
    const [min, setMin] = useState<number | null>(0);
    const [max, setMax] = useState<number | null>(null);
    const [tone, setTone] = useState<ColorToken>('neutral');

    const load = useCallback(async () => {
        setLoading(true);
        try { setRows(await ratingService.list()); }
        catch (err) { toast.error(describeApiError(err, 'Could not load lead ratings.')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!label.trim()) { toast.error('Give the rating a name.'); return; }
        if (min == null || min < 0) { toast.error('Enter a minimum score.'); return; }
        if (max != null && max < min) { toast.error('Maximum score must not be below the minimum.'); return; }
        setBusy(true);
        try {
            await ratingService.create({ label: label.trim(), min_score: min, max_score: max, color_token: tone });
            setLabel(''); setMin(0); setMax(null); setTone('neutral');
            toast.success('Rating added');
            await load();
        } catch (err) { toast.error(describeApiError(err, 'Could not add the rating.')); }
        finally { setBusy(false); }
    };

    const toggle = async (row: RatingCategory, is_active: boolean) => {
        setBusy(true);
        try {
            await ratingService.update(row.id, { is_active });
            setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active } : r)));
        } catch (err) { toast.error(describeApiError(err, 'Could not update the rating.')); }
        finally { setBusy(false); }
    };

    const remove = async (row: RatingCategory) => {
        if (!await confirm({ title: 'Delete?', message: `Delete the rating "${row.label}"?`, intent: 'danger', confirmLabel: 'Delete' })) return;
        setBusy(true);
        try {
            await ratingService.remove(row.id);
            setRows((rs) => rs.filter((r) => r.id !== row.id));
            toast.success('Rating deleted');
        } catch (err) { toast.error(describeApiError(err, 'Could not delete the rating.')); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-nb-4" data-testid="lead-rating-tab">
            {confirmDialog}
            <Card title="Lead rating">
                <p className="text-xs text-fg-muted mb-nb-3">Leads get the rating whose score band they fall in, unless someone sets one by hand.</p>
                {canWrite && (
                    <div className="flex flex-wrap items-end gap-nb-3 mb-nb-4">
                        <TextField name="rating-label" label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
                        <NumberInput name="rating-min" label="From score" min={0} value={min} onChange={(v) => setMin(v)} />
                        <NumberInput name="rating-max" label="To score (blank = no cap)" min={0} value={max} onChange={(v) => setMax(v)} />
                        <Select name="rating-tone" label="Colour" value={tone} options={TONE_OPTIONS} onChange={(e) => setTone(e.target.value as ColorToken)} />
                        <Button type="button" variant="primary" onClick={add} disabled={busy}><Plus size={14} /> Add</Button>
                    </div>
                )}
                {loading ? <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading...</span></div> : rows.length === 0 ? (
                    <p className="text-sm text-fg-muted" data-testid="lead-rating-empty">No ratings yet.</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map((r) => (
                            <li key={r.id} className="flex items-center gap-nb-3 py-nb-2" data-testid={`rating-${r.id}`}>
                                <Badge tone={(r.color_token as ColorToken) ?? 'neutral'}>{r.label}</Badge>
                                <span className="flex-1 text-xs text-fg-muted">{r.min_score} to {r.max_score ?? 'no cap'}</span>
                                <Checkbox name={`rating-${r.id}-active`} label="Active" checked={r.is_active !== false} disabled={!canWrite || busy} onChange={(e) => toggle(r, e.target.checked)} />
                                {canWrite && <IconButton label={`Delete ${r.label}`} variant="danger" icon={<Trash2 size={14} />} onClick={() => remove(r)} />}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            <RatingMilestonesCard canWrite={canWrite} categories={rows} />
        </div>
    );
};

export default LeadRatingSettingsTab;
