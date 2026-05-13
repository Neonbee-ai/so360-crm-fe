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
    const normalized = currentState?.toLowerCase() || 'new';
    const isLost = normalized === 'lost';
    const isConverted = normalized === 'converted';

    if (isLost) {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-medium">Lead Lost</span>
            </div>
        );
    }

    const currentIndex = FORWARD_STATES.indexOf(normalized as any);

    return (
        <div className="flex items-center gap-0">
            {FORWARD_STATES.map((state, index) => {
                const isCompleted = currentIndex > index;
                const isCurrent = currentIndex === index;
                const isLast = index === FORWARD_STATES.length - 1;
                const isTerminalConverted = isLast && (isCompleted || isCurrent);

                return (
                    <React.Fragment key={state}>
                        <div className="flex flex-col items-center">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                isCompleted ? (isTerminalConverted ? 'bg-emerald-500 text-white' : 'bg-teal-500 text-white') :
                                isCurrent ? (state === 'converted' ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400' : 'bg-teal-500/20 border-2 border-teal-500 text-teal-400') :
                                'bg-slate-800 border border-slate-600 text-slate-600'
                            }`}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <span className={`text-xs mt-2 text-center w-16 ${
                                isCompleted || isCurrent ? (state === 'converted' ? 'text-emerald-400' : 'text-teal-400') : 'text-slate-600'
                            }`}>
                                {STATE_LABELS[state]}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`flex-1 h-0.5 min-w-4 ${
                                isCompleted ? 'bg-teal-500' : 'bg-slate-700'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default LeadJourneyStepper;
