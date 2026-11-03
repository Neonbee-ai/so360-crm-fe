import React from 'react';
import { Select } from '@so360/design-system';

export type StageStatusType = 'OPEN' | 'WON' | 'LOST';

const STATUS_OPTIONS: { value: StageStatusType; label: string }[] = [
    { value: 'OPEN', label: 'Open' },
    { value: 'WON', label: 'Won' },
    { value: 'LOST', label: 'Lost' },
];

interface StageStatusSelectProps {
    value: StageStatusType;
    onChange: (value: StageStatusType) => void;
}

/** Pipeline-stage status picker — the Comb compact (sm) Select. */
export const StageStatusSelect: React.FC<StageStatusSelectProps> = ({ value, onChange }) => (
    <Select
        name="stage-status"
        aria-label="Stage status"
        size="sm"
        data-testid="stage-status-select"
        value={value}
        onValueChange={(v) => onChange(v as StageStatusType)}
        options={STATUS_OPTIONS}
    />
);
