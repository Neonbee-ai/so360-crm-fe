import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast, Card, Button, IconButton, TextField, Select } from '@so360/design-system';
import { ratingService, RatingCategory, RatingMilestone, RatingMilestoneRule, RatingMode } from '../../../services/salesConfigService';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean; categories: RatingCategory[] }

export const MILESTONE_LABELS: Record<RatingMilestone, string> = {
    quote_sent: 'Quote sent',
    customer_replied: 'Customer replied',
    meeting_held: 'Meeting held',
    stage_reached: 'Stage reached',
};
const MILESTONE_OPTIONS = (Object.keys(MILESTONE_LABELS) as RatingMilestone[]).map((m) => ({ value: m, label: MILESTONE_LABELS[m] }));
const MODE_OPTIONS = [
    { value: 'score', label: 'By lead score' },
    { value: 'milestone', label: 'By milestones' },
];

/** Settings -> Lead rating -> how the rating is chosen. Org-wide, generic milestone-to-rating rules. */
const RatingMilestonesCard: React.FC<Props> = ({ canWrite, categories }) => {
    const [mode, setMode] = useState<RatingMode>('score');
    const [rules, setRules] = useState<RatingMilestoneRule[]>([]);
    const [milestone, setMilestone] = useState<RatingMilestone>('quote_sent');
    const [stageKey, setStageKey] = useState('');
    const [ratingId, setRatingId] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const s = await ratingService.getSettings();
            setMode(s.mode ?? 'score');
            setRules(s.rules ?? []);
        } catch (err) { toast.error(describeApiError(err, 'Could not load rating rules.')); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async (nextMode: RatingMode, nextRules: RatingMilestoneRule[]) => {
        setBusy(true);
        try {
            const s = await ratingService.putSettings({ mode: nextMode, rules: nextRules });
            setMode(s.mode ?? nextMode);
            setRules(s.rules ?? nextRules);
            toast.success('Rating rules saved');
        } catch (err) { toast.error(describeApiError(err, 'Could not save rating rules.')); }
        finally { setBusy(false); }
    };

    const add = async () => {
        if (!ratingId) { toast.error('Choose the rating to give.'); return; }
        if (milestone === 'stage_reached' && !stageKey.trim()) { toast.error('Enter the stage.'); return; }
        const key = milestone === 'stage_reached' ? stageKey.trim() : '';
        if (rules.some((r) => r.milestone === milestone && r.stage_key === key)) { toast.error('That milestone already has a rule.'); return; }
        await save(mode, [...rules, { milestone, stage_key: key, rating_category_id: ratingId, is_active: true }]);
        setStageKey(''); setRatingId('');
    };

    const labelOf = (id: string) => categories.find((c) => c.id === id)?.label ?? 'Unknown rating';
    const ratingOptions = [{ value: '', label: 'Choose a rating' }, ...categories.filter((c) => c.is_active !== false).map((c) => ({ value: c.id, label: c.label }))];

    return (
        <Card title="How ratings are chosen">
            <p className="text-xs text-fg-muted mb-nb-3">
                By milestones, a lead is upgraded to the mapped rating when the event happens. It never downgrades, and a rating set by hand always wins.
            </p>
            <div className="mb-nb-4">
                <Select name="rating-mode" label="Mode" value={mode} options={MODE_OPTIONS} disabled={!canWrite || busy}
                    onChange={(e) => save(e.target.value as RatingMode, rules)} />
            </div>
            {mode === 'milestone' && (
                <>
                    {canWrite && (
                        <div className="flex flex-wrap items-end gap-nb-3 mb-nb-4">
                            <Select name="milestone" label="When" value={milestone} options={MILESTONE_OPTIONS} onChange={(e) => setMilestone(e.target.value as RatingMilestone)} />
                            {milestone === 'stage_reached' && <TextField name="milestone-stage" label="Stage" value={stageKey} onChange={(e) => setStageKey(e.target.value)} />}
                            <Select name="milestone-rating" label="Rate as" value={ratingId} options={ratingOptions} onChange={(e) => setRatingId(e.target.value)} />
                            <Button type="button" variant="primary" onClick={add} disabled={busy}><Plus size={14} /> Add rule</Button>
                        </div>
                    )}
                    {rules.length === 0 ? (
                        <p className="text-sm text-fg-muted" data-testid="milestone-rules-empty">No rules yet.</p>
                    ) : (
                        <ul className="divide-y divide-line">
                            {rules.map((r) => (
                                <li key={`${r.milestone}:${r.stage_key}`} className="flex items-center gap-nb-3 py-nb-2" data-testid={`milestone-rule-${r.milestone}${r.stage_key ? `-${r.stage_key}` : ''}`}>
                                    <span className="flex-1 text-sm">
                                        {MILESTONE_LABELS[r.milestone]}{r.stage_key ? `: ${r.stage_key}` : ''} then {labelOf(r.rating_category_id)}
                                    </span>
                                    {canWrite && (
                                        <IconButton label={`Remove ${MILESTONE_LABELS[r.milestone]} rule`} variant="danger" icon={<Trash2 size={14} />} disabled={busy}
                                            onClick={() => save(mode, rules.filter((x) => x !== r))} />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </Card>
    );
};

export default RatingMilestonesCard;
