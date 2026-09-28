import React, { useEffect, useState } from 'react';
import { Building2, Check, Loader2, Plus, Share2 } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useCRMFormatters } from '../../utils/formatters';
import {
    matchingUnitsService,
    MatchingEntity,
    MatchingUnit,
    unitShareText,
} from '../../services/matchingUnitsService';

interface Props {
    entity: MatchingEntity;
    id: string;
    /** item_ids already on the record — their Attach button reads "Added". */
    existingItemIds: Set<string>;
    /** Attaches the unit through the host tab's existing add-product path. */
    onAttach: (unit: MatchingUnit) => Promise<void> | void;
}

const scoreTone = (score: number) =>
    score >= 75 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
        : score >= 50 ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
            : 'text-slate-300 bg-slate-800 border-slate-700';

/**
 * Property matching (A9): units that fit the lead's budget / bedrooms /
 * location, best first. Attach = one tap (reuses the tab's add-product call);
 * Share copies a plain-text unit summary to the clipboard. The panel is a
 * suggestion, so a failed or empty lookup renders nothing.
 */
export const MatchingUnitsPanel: React.FC<Props> = ({ entity, id, existingItemIds, onAttach }) => {
    const formatters = useCRMFormatters();
    const [units, setUnits] = useState<MatchingUnit[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [attachingId, setAttachingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoaded(false);
        (async () => {
            try {
                const data = await matchingUnitsService.for(entity, id);
                if (!cancelled) setUnits(data);
            } catch {
                if (!cancelled) setUnits([]);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [entity, id]);

    if (!loaded || units.length === 0) return null;

    const attach = async (unit: MatchingUnit) => {
        setAttachingId(unit.item_id);
        try {
            await onAttach(unit);
        } finally {
            setAttachingId(null);
        }
    };

    const share = async (unit: MatchingUnit) => {
        const text = unitShareText(unit, (n) => formatters.formatCurrency(n));
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Unit details copied');
        } catch {
            toast.error('Could not copy the unit details');
        }
    };

    return (
        <section aria-label="Matching units" data-testid="matching-units-panel" className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Matching units ({units.length})
            </p>
            <ul className="space-y-2">
                {units.map((u) => {
                    const added = existingItemIds.has(u.item_id);
                    const busy = attachingId === u.item_id;
                    const name = u.unit_number ?? u.item_id;
                    return (
                        <li
                            key={u.item_id}
                            data-testid="matching-unit"
                            className="flex items-start gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl"
                        >
                            <Building2 size={16} className="text-blue-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-100">{name}</span>
                                    {(u.project || u.tower) && (
                                        <span className="text-xs text-slate-400 truncate">
                                            {[u.project, u.tower ? `Tower ${u.tower}` : null].filter(Boolean).join(' · ')}
                                        </span>
                                    )}
                                    <span
                                        className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${scoreTone(u.score)}`}
                                        title="Match score"
                                    >
                                        {Math.round(u.score)}% match
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {[
                                        u.bedrooms != null ? `${u.bedrooms} BR` : null,
                                        u.area_sqft != null ? `${u.area_sqft} sq ft` : null,
                                        u.price != null ? formatters.formatCurrency(u.price) : null,
                                    ].filter(Boolean).join(' · ')}
                                </p>
                                {u.reasons?.length > 0 && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{u.reasons.join(' · ')}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    aria-label={`Share ${name}`}
                                    title="Copy unit details"
                                    onClick={() => share(u)}
                                    className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg"
                                >
                                    <Share2 size={14} />
                                </button>
                                <button
                                    type="button"
                                    aria-label={added ? `${name} added` : `Attach ${name}`}
                                    disabled={added || busy}
                                    onClick={() => attach(u)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-500"
                                >
                                    {busy ? <Loader2 size={12} className="animate-spin" /> : added ? <Check size={12} /> : <Plus size={12} />}
                                    {added ? 'Added' : 'Attach'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default MatchingUnitsPanel;
