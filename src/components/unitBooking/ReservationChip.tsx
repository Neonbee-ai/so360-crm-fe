import React from 'react';
import { Lock, Clock } from 'lucide-react';
import { Badge, type BadgeTone } from '@so360/design-system';
import { describeReservation } from './unitBooking';

const TONE: Record<string, BadgeTone> = {
    held: 'warning',
    sold: 'success',
    muted: 'neutral',
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
        <Badge
            data-testid="reservation-chip"
            title={expiresAt ? `Hold expires ${new Date(expiresAt).toLocaleString()}` : undefined}
            size="sm"
            tone={TONE[view.tone] ?? 'neutral'}
            className="flex-shrink-0"
        >
            <Icon size={9} /> {view.label}
        </Badge>
    );
}
