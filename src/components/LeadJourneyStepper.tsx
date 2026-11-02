import React from 'react';
import { XCircle } from 'lucide-react';
import { Stepper } from '@so360/design-system';

const FORWARD_STATES = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted'] as const;

const STATE_LABELS: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposal_sent: 'Proposal Sent',
    negotiation: 'Negotiation',
    converted: 'Converted',
    lost: 'Lost',
};

interface LeadJourneyStepperProps {
    currentState: string;
}

export const LeadJourneyStepper: React.FC<LeadJourneyStepperProps> = ({ currentState }) => {
    const normalized = currentState?.toLowerCase().replace(/\s+/g, '_') || 'new';
    const isLost = normalized === 'lost';
    const isConverted = normalized === 'converted';

    if (isLost) {
        return (
            <div className="flex items-center gap-3 p-4 bg-danger/10 rounded-nb border border-danger/20">
                <XCircle className="w-5 h-5 text-danger" />
                <span className="text-fg font-medium">Lead Lost</span>
            </div>
        );
    }

    const currentIndex = Math.max(FORWARD_STATES.indexOf(normalized as (typeof FORWARD_STATES)[number]), 0);

    // DS Stepper: steps share the width and collapse to circles + current label on narrow containers,
    // so the lead page never scrolls sideways on phones.
    return (
        <div className="min-w-0 max-w-full">
            <Stepper
                name="lead_journey"
                steps={FORWARD_STATES.map((state) => ({ label: STATE_LABELS[state] }))}
                current={isConverted ? FORWARD_STATES.length - 1 : currentIndex}
            />
        </div>
    );
};

export default LeadJourneyStepper;
