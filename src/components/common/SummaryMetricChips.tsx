import { Button, CountUp } from '@so360/design-system';
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
                <Button
                    key={chip.key}
                    type="button"
                    size="sm"
                    variant={chip.active ? 'tonal' : 'secondary'}
                    aria-pressed={chip.active ? true : undefined}
                    onClick={chip.onClick}
                    disabled={!chip.onClick}
                    data-testid={`summary-metric-chip-${chip.key}`}
                >
                    <CountUp value={chip.count} /> {chip.label}
                </Button>
            ))}
        </div>
    );
};
