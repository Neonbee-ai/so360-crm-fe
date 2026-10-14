import React, { useEffect, useState } from 'react';
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

    const selectCls = 'bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500';

    return (
        <div className="flex items-center gap-2 flex-wrap mb-3" data-testid="unit-booking-controls">
            <select
                aria-label="Project"
                value={projectId}
                onChange={e => onProjectChange(e.target.value)}
                className={`${selectCls} flex-1 min-w-[8rem]`}
            >
                <option value="">All projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer">
                <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={e => onOnlyAvailableChange(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-blue-500"
                />
                Only available
            </label>
            <select
                aria-label="Hold for"
                value={holdHours}
                onChange={e => onHoldHoursChange(Number(e.target.value))}
                className={selectCls}
            >
                {HOLD_HOUR_OPTIONS.map(h => <option key={h} value={h}>Hold {holdHoursLabel(h)}</option>)}
            </select>
        </div>
    );
}
