import React from 'react';
import { Lock, Clock } from 'lucide-react';
import { describeReservation } from './unitBooking';

const TONE: Record<string, string> = {
    held: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    sold: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    muted: 'bg-slate-700/60 text-slate-400 border-slate-600/60',
};

interface Props {
    status?: string | null;
    expiresAt?: string | null;
}

/** Hold / sold chip for a unit on a lead or deal product line. Renders nothing without a reservation. */
export function ReservationChip({ status, expiresAt }: Props) {
    const view = describeReservation(status, expiresAt);
    if (!view) return null;
    const Icon = view.tone === 'sold' ? Lock : Clock;
    return (
        <span
            data-testid="reservation-chip"
            title={expiresAt ? `Hold expires ${new Date(expiresAt).toLocaleString()}` : undefined}
            className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${TONE[view.tone]}`}
        >
            <Icon size={9} /> {view.label}
        </span>
    );
}
