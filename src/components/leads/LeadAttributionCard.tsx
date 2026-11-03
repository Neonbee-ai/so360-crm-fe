import React from 'react';
import type { Lead } from '../../types/crm';

/**
 * RE §26 — "Source & attribution" card on the lead detail page. Shows the
 * UTM / ad / click-id fields a lead was captured with (API, form, lead-ads
 * webhook or import). Renders nothing when the lead has no attribution.
 * Gated by the caller on `action:crm:leads:utm_attribution`.
 */
export const ATTRIBUTION_ROWS: Array<{ key: keyof Lead; label: string }> = [
    { key: 'utm_source', label: 'UTM source' },
    { key: 'utm_medium', label: 'UTM medium' },
    { key: 'utm_campaign', label: 'UTM campaign' },
    { key: 'utm_term', label: 'UTM term' },
    { key: 'utm_content', label: 'UTM content' },
    { key: 'ad_platform', label: 'Ad platform' },
    { key: 'ad_campaign_id', label: 'Ad campaign ID' },
    { key: 'ad_set_name', label: 'Ad set' },
    { key: 'ad_set_id', label: 'Ad set ID' },
    { key: 'ad_name', label: 'Ad' },
    { key: 'ad_id', label: 'Ad ID' },
    { key: 'landing_page', label: 'Landing page' },
    { key: 'referrer', label: 'Referrer' },
    { key: 'gclid', label: 'Google click ID' },
    { key: 'fbclid', label: 'Meta click ID' },
];

export const attributionEntries = (lead: Partial<Lead> | null | undefined) =>
    ATTRIBUTION_ROWS
        .map((r) => ({ ...r, value: lead?.[r.key] }))
        .filter((r): r is { key: keyof Lead; label: string; value: string } =>
            typeof r.value === 'string' && r.value.trim() !== '');

export const LeadAttributionCard: React.FC<{ lead: Partial<Lead> | null | undefined }> = ({ lead }) => {
    const entries = attributionEntries(lead);
    if (entries.length === 0) return null;
    return (
        <section data-testid="lead-attribution-card" className="bg-surface border border-line rounded-nb-lg p-nb-6">
            <h3 className="text-xs font-semibold text-fg-muted uppercase mb-nb-4">Source &amp; attribution</h3>
            <dl className="space-y-nb-2">
                {entries.map((e) => (
                    <div key={String(e.key)} className="flex items-start justify-between gap-nb-3">
                        <dt className="text-xs font-semibold uppercase text-fg-muted whitespace-nowrap">{e.label}</dt>
                        <dd className="text-xs font-medium text-fg-subtle text-right break-all" data-testid={`attr-${String(e.key)}`}>{e.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
};

export default LeadAttributionCard;
