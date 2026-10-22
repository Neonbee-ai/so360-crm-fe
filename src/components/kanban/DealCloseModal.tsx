import React, { useEffect, useState } from 'react';
import { Button, Checkbox, NumberInput, Select, TextField, Textarea } from '@so360/design-system';
import { Modal } from '../common/Modal';
import { Deal } from '../../types/crm';
import { LoseDealBody, LossReason, WinDealBody, lossReasonsService } from '../../services/salesConfigService';
import { useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';

export const LOSS_REASONS_FLAG = 'submodule:crm:loss_reasons';

interface Props {
    isOpen: boolean;
    kind: 'won' | 'lost';
    deal: Deal | null;
    stageName: string;
    busy?: boolean;
    onClose: () => void;
    onWin: (body: WinDealBody) => void;
    onLose: (body: LoseDealBody) => void;
}

/**
 * Closing a deal from the board. Won runs the win flow (reason, final value,
 * optional project); Lost asks for a reason from the org's configured list
 * (free text when the org has none), plus the competitor when that reason
 * asks for one.
 */
export const DealCloseModal = ({ isOpen, kind, deal, stageName, busy, onClose, onWin, onLose }: Props) => {
    const reasonsEnabled = useCrmFeatureFlag(LOSS_REASONS_FLAG);
    const [reasons, setReasons] = useState<LossReason[]>([]);
    const [reasonId, setReasonId] = useState('');
    const [freeText, setFreeText] = useState('');
    const [competitor, setCompetitor] = useState('');
    const [feedback, setFeedback] = useState('');
    const [wonReason, setWonReason] = useState('');
    const [finalValue, setFinalValue] = useState<number | null>(null);
    const [createProject, setCreateProject] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setReasonId(''); setFreeText(''); setCompetitor(''); setFeedback('');
        setWonReason(''); setFinalValue(deal?.value ?? null); setCreateProject(false); setError(null);
    }, [isOpen, deal?.id]);

    useEffect(() => {
        if (!isOpen || kind !== 'lost' || !reasonsEnabled) { setReasons([]); return; }
        let cancelled = false;
        lossReasonsService.list()
            .then((rows) => { if (!cancelled) setReasons(rows.filter((r) => r.is_active !== false)); })
            .catch(() => { if (!cancelled) setReasons([]); });
        return () => { cancelled = true; };
    }, [isOpen, kind, reasonsEnabled]);

    if (!deal) return null;

    const picked = reasons.find((r) => r.id === reasonId);
    const useList = reasons.length > 0;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (kind === 'won') {
            onWin({
                ...(wonReason.trim() && { won_reason: wonReason.trim() }),
                ...(finalValue != null && { final_value: finalValue }),
                ...(createProject && { create_project: true }),
            });
            return;
        }
        if (useList) {
            if (!picked) { setError('Choose a lost reason.'); return; }
            if (picked.requires_competitor && !competitor.trim()) { setError('Name the competitor.'); return; }
            onLose({
                lost_reason_id: picked.id,
                ...(competitor.trim() && { competitor: competitor.trim() }),
                ...(feedback.trim() && { feedback: feedback.trim() }),
            });
            return;
        }
        if (!freeText.trim()) { setError('Give a reason for losing this deal.'); return; }
        onLose({
            lost_reason: freeText.trim(),
            ...(competitor.trim() && { competitor: competitor.trim() }),
            ...(feedback.trim() && { feedback: feedback.trim() }),
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={kind === 'won' ? `Close deal as ${stageName}` : `Mark deal as ${stageName}`} data-testid="deal-close-modal">
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-fg-subtle">
                    {kind === 'won' ? 'Winning' : 'Closing'} <span className="text-fg font-bold">{deal.name}</span>.
                </p>

                {kind === 'won' && (
                    <>
                        <NumberInput
                            name="deal-final-value"
                            label="Final value"
                            min={0}
                            value={finalValue}
                            onChange={(v) => setFinalValue(v)}
                        />
                        <Textarea
                            name="deal-won-reason"
                            label="Why did we win? (optional)"
                            rows={3}
                            value={wonReason}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWonReason(e.target.value)}
                        />
                        <Checkbox
                            name="deal-create-project"
                            label="Create a project for this deal"
                            checked={createProject}
                            onChange={(e) => setCreateProject(e.target.checked)}
                        />
                    </>
                )}

                {kind === 'lost' && (
                    <>
                        {useList ? (
                            <Select
                                name="deal-lost-reason"
                                label="Lost reason"
                                required
                                value={reasonId}
                                options={[{ value: '', label: 'Select a reason' }, ...reasons.map((r) => ({ value: r.id, label: r.label }))]}
                                onChange={(e) => setReasonId(e.target.value)}
                            />
                        ) : (
                            <Textarea
                                name="deal-lost-reason-text"
                                label="Lost reason"
                                required
                                rows={3}
                                value={freeText}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFreeText(e.target.value)}
                            />
                        )}
                        <TextField
                            name="deal-lost-competitor"
                            label={picked?.requires_competitor ? 'Competitor' : 'Competitor (optional)'}
                            required={!!picked?.requires_competitor}
                            value={competitor}
                            onChange={(e) => setCompetitor(e.target.value)}
                        />
                        <Textarea
                            name="deal-lost-feedback"
                            label="Feedback (optional)"
                            rows={3}
                            value={feedback}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
                        />
                    </>
                )}

                {error && <p role="alert" className="text-xs font-bold text-danger">{error}</p>}

                <div className="pt-2 flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant={kind === 'lost' ? 'danger' : 'primary'} className="flex-1" disabled={busy}>
                        {kind === 'won' ? 'Mark as won' : 'Mark as lost'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
