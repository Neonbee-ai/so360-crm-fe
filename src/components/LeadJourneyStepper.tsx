import React from 'react';
import { CheckCircle, Circle, XCircle } from 'lucide-react';

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

    const currentIndex = FORWARD_STATES.indexOf(normalized as any);

    return (
        <div className="flex items-center gap-0 max-w-full min-w-0 overflow-x-auto pb-1">
            {FORWARD_STATES.map((state, index) => {
                const isCompleted = currentIndex > index;
                const isCurrent = currentIndex === index;
                const isLast = index === FORWARD_STATES.length - 1;
                const isTerminalConverted = isLast && (isCompleted || isCurrent);

                return (
                    <React.Fragment key={state}>
                        <div className="flex flex-col items-center shrink-0">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
 isCompleted ? (isTerminalConverted ? 'bg-success text-primary-fg' : 'bg-info text-primary-fg') :
 isCurrent ? (state === 'converted' ? 'bg-success/20 border-2 border-success text-success' : 'bg-info/20 border-2 border-info text-info') :
 'bg-fg-muted/10 border border-line-strong text-fg-subtle'
 }`}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <span className={`text-xs mt-2 text-center min-w-16 px-1 whitespace-nowrap ${
 isCompleted || isCurrent ? (state === 'converted' ? 'text-success' : 'text-info') : 'text-fg-subtle'
 }`}>
                                {STATE_LABELS[state]}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`flex-1 h-0.5 min-w-4 ${
 isCompleted ? 'bg-info' : 'bg-fg-muted/40'
 }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default LeadJourneyStepper;
