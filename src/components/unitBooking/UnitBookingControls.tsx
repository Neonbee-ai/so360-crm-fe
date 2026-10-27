import React, { useEffect, useState } from 'react';
import { Select, Checkbox } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import { HOLD_HOUR_OPTIONS, holdHoursLabel } from './unitBooking';

interface Props {
    projectId: string;
    onProjectChange: (id: string) => void;
    onlyAvailable: boolean;
    onOnlyAvailableChange: (v: boolean) => void;
    holdHours: number;
    onHoldHoursChange: (h: number) => void;
}

/**
 * Unit-booking filters for the lead/deal "Add Product" pickers: Project
 * (an Inventory category), "Only available" and the hold duration sent as
 * `hold_hours` when the unit is attached. All three sit on one row so the
 * picker keeps its single-dialog, ≤3-tap flow.
 */
export function UnitBookingControls({
    projectId, onProjectChange, onlyAvailable, onOnlyAvailableChange, holdHours, onHoldHoursChange,
}: Props) {
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const cats = await crmService.getProductCategories();
                if (alive) setProjects(Array.isArray(cats) ? cats : []);
            } catch {
                if (alive) setProjects([]);
            }
        })();
        return () => { alive = false; };
    }, []);

    return (
        <div className="flex items-center gap-2 flex-wrap mb-3" data-testid="unit-booking-controls">
            <div className="flex-1 min-w-[8rem]">
                <Select
                    name="unit-booking-project"
                    aria-label="Project"
                    size="sm"
                    value={projectId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onProjectChange(e.target.value)}
                    options={[{ value: '', label: 'All projects' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
                />
            </div>
            <Checkbox
                name="unit-booking-only-available"
                label="Only available"
                checked={onlyAvailable}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onOnlyAvailableChange(e.target.checked)}
            />
            <Select
                name="unit-booking-hold-for"
                aria-label="Hold for"
                size="sm"
                value={String(holdHours)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onHoldHoursChange(Number(e.target.value))}
                options={HOLD_HOUR_OPTIONS.map(h => ({ value: String(h), label: `Hold ${holdHoursLabel(h)}` }))}
            />
        </div>
    );
}
