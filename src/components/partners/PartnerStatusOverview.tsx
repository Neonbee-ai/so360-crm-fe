import React, { useMemo } from 'react';

interface PartnerTypeOption {
    value: string;
    label: string;
}

interface PartnerLike {
    partner_type?: string;
}

interface PartnerStatusOverviewProps {
    partners: PartnerLike[];
    partnerTypes: PartnerTypeOption[];
}

// Stable palette indexed by segment position — partner types are org-configured
// (not a fixed enum like fulfillment shipment statuses), so colors are assigned
// by render order rather than hardcoded per-type.
const PALETTE = [
    { bar: 'bg-blue-500', dot: 'bg-blue-500' },
    { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { bar: 'bg-amber-500', dot: 'bg-amber-500' },
    { bar: 'bg-purple-500', dot: 'bg-purple-500' },
    { bar: 'bg-pink-500', dot: 'bg-pink-500' },
    { bar: 'bg-teal-500', dot: 'bg-teal-500' },
];
const FALLBACK_COLOR = { bar: 'bg-slate-500', dot: 'bg-slate-500' };

/**
 * Replaces the old 4-card Partner KPI grid (Total Partners / Total Deals /
 * Total Deal Value / Royalty Pending) with a segmented distribution bar,
 * mirroring so360-fulfillment-fe's ShipmentStatusBar visual/accessibility
 * pattern (task 52daf7c7).
 */
export const PartnerStatusOverview: React.FC<PartnerStatusOverviewProps> = ({ partners, partnerTypes }) => {
    const total = partners.length;

    const counts = useMemo(() => {
        const map: Record<string, number> = {};
        for (const p of partners) {
            const key = p.partner_type || 'unspecified';
            map[key] = (map[key] || 0) + 1;
        }
        return map;
    }, [partners]);

    if (total === 0) return null;

    // Configured types render first, in Settings order; any partner tagged with
    // a type no longer in Settings (or with no type at all) still gets its own
    // segment so total always equals partners.length.
    const knownKeys = partnerTypes.map(t => t.value).filter(v => counts[v] > 0);
    const unknownKeys = Object.keys(counts).filter(k => !partnerTypes.some(t => t.value === k));
    const orderedKeys = [...knownKeys, ...unknownKeys];

    const labelFor = (key: string) =>
        partnerTypes.find(t => t.value === key)?.label || (key === 'unspecified' ? 'Unspecified' : key);
    const colorFor = (key: string) => PALETTE[orderedKeys.indexOf(key) % PALETTE.length] || FALLBACK_COLOR;

    const segments = orderedKeys.map(key => ({ key, count: counts[key] }));

    return (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 mb-6">
            <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Partner Type Distribution</span>
                <span className="text-xs text-slate-500">{total} partner{total === 1 ? '' : 's'}</span>
            </div>
            <div
                className="h-2 rounded-full bg-slate-800 overflow-hidden flex"
                role="img"
                aria-label={`Partner type distribution across ${total} partners`}
            >
                {segments.map(({ key, count }) => (
                    <div
                        key={key}
                        data-testid={`partner-status-segment-${key}`}
                        className={`h-full ${colorFor(key).bar}`}
                        style={{ width: `${(count / total) * 100}%` }}
                        title={`${labelFor(key)}: ${count}`}
                    />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {segments.map(({ key, count }) => {
                    const pct = Math.round((count / total) * 100);
                    return (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                            <span className={`w-2 h-2 rounded-full ${colorFor(key).dot}`} />
                            <span className="text-slate-400">{labelFor(key)}</span>
                            <span className="text-slate-200 font-medium">{count}</span>
                            <span className="text-slate-600">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PartnerStatusOverview;
