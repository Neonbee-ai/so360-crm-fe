import React, { useEffect, useState } from 'react';
import { Card } from '@so360/design-system';
import { ratingService, RatingHistoryEntry } from '../../services/salesConfigService';
import { MILESTONE_LABELS } from '../../pages/components/settings/RatingMilestonesCard';
import { useCRMFormatters } from '../../utils/formatters';

interface Props {
    leadId: string;
    categories: Array<{ id: string; label: string }>;
    /** Changes when the lead's rating changes, so the history reloads. */
    ratingId?: string | null;
}

/** Who/what/when behind each rating change on the lead. Hidden when there is none. */
export const describeRatingChange = (e: RatingHistoryEntry, labelOf: (id: string | null) => string): string => {
    const to = labelOf(e.to_category_id);
    if (e.source === 'manual') return `Rating set by hand to ${to}`;
    if (e.source === 'cleared') return `Manual rating cleared, now ${to}`;
    if (e.source === 'milestone') return `${e.milestone ? MILESTONE_LABELS[e.milestone] : 'Milestone'}: rating moved to ${to}`;
    return `Score changed the rating to ${to}`;
};

const LeadRatingHistory: React.FC<Props> = ({ leadId, categories, ratingId }) => {
    const formatters = useCRMFormatters();
    const [rows, setRows] = useState<RatingHistoryEntry[]>([]);

    useEffect(() => {
        let live = true;
        ratingService.history(leadId).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
        return () => { live = false; };
    }, [leadId, ratingId]);

    if (rows.length === 0) return null;
    const labelOf = (id: string | null) => (id ? categories.find((c) => c.id === id)?.label ?? 'Unknown' : 'no rating');

    return (
        <Card title="Rating history">
            <ul className="divide-y divide-line" data-testid="lead-rating-history">
                {rows.map((e) => (
                    <li key={e.id} className="flex items-center gap-nb-3 py-nb-2">
                        <span className="flex-1 text-sm">{describeRatingChange(e, labelOf)}{e.note ? ` (${e.note})` : ''}</span>
                        <span className="text-xs text-fg-muted">{formatters.formatDateTime(e.created_at)}</span>
                    </li>
                ))}
            </ul>
        </Card>
    );
};

export default LeadRatingHistory;
