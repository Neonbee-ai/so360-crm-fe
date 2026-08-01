import React from 'react';

export interface SummaryMetricChip {
    key: string;
    label: string;
    count: number;
    active?: boolean;
    onClick?: () => void;
}

interface SummaryMetricChipsProps {
    chips: SummaryMetricChip[];
    className?: string;
}

/**
 * Shared compact summary-metric chip row for CRM operational listing pages
 * (Leads, Customers, ...). Keeps summary styling consistent across modules —
 * large KPI cards are reserved for analytical/executive dashboards.
 */
export const SummaryMetricChips: React.FC<SummaryMetricChipsProps> = ({ chips, className = '' }) => {
    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="summary-metric-chips">
            {chips.map((chip) => (
                <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClick}
                    disabled={!chip.onClick}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        chip.active
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/40'
                            : 'bg-slate-900/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
                    } ${!chip.onClick ? 'cursor-default' : ''}`}
                    data-testid={`summary-metric-chip-${chip.key}`}
                >
                    {chip.count} {chip.label}
                </button>
            ))}
        </div>
    );
};
