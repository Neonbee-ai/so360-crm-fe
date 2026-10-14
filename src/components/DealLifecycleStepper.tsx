import React from 'react';
import { CheckCircle, Circle, XCircle } from 'lucide-react';

export interface DealLifecycleStage {
    id: string;
    name: string;
    type?: string;
}

interface DealLifecycleStepperProps {
    stages: DealLifecycleStage[];
    currentStageId?: string;
    /** Fallback for callers that only have the legacy flow-state string, kept for back-compat. */
    currentState?: string;
}

const isWonType = (stage?: DealLifecycleStage) => stage?.type === 'WON' || stage?.name === 'Won';
const isLostType = (stage?: DealLifecycleStage) => stage?.type === 'LOST' || stage?.name === 'Lost';

export const DealLifecycleStepper: React.FC<DealLifecycleStepperProps> = ({ stages, currentStageId, currentState }) => {
    const openStages = stages.filter(s => !isWonType(s) && !isLostType(s));
    const wonStage = stages.find(isWonType);
    // Won is always the terminal step of the forward pipeline; open stages come before it.
    const forwardStages = wonStage ? [...openStages, wonStage] : openStages;

    const resolvedId = currentStageId
        || stages.find(s => s.name.toLowerCase() === currentState?.toLowerCase())?.id;
    const currentStage = stages.find(s => s.id === resolvedId);

    if (isLostType(currentStage) || currentState?.toLowerCase() === 'lost') {
        return (
            <div className="flex items-center gap-3 p-4 bg-danger/10 rounded-lg border border-danger/20">
                <XCircle className="w-5 h-5 text-danger" />
                <span className="text-danger font-medium">Deal Lost</span>
            </div>
        );
    }

    if (forwardStages.length === 0) {
        return (
            <div className="flex items-center gap-3 p-4 bg-fg-muted/10 rounded-lg border border-line">
                <span className="text-fg-subtle text-sm">No pipeline stages configured</span>
            </div>
        );
    }

    const currentIndex = forwardStages.findIndex(s => s.id === resolvedId);

    return (
        <div className="flex items-center gap-0">
            {forwardStages.map((stage, index) => {
                const isCompleted = currentIndex > index;
                const isCurrent = currentIndex === index;
                const isLast = index === forwardStages.length - 1;
                const isTerminalWon = isLast && (isCompleted || isCurrent) && isWonType(stage);

                return (
                    <React.Fragment key={stage.id}>
                        <div className="flex flex-col items-center">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                                isCompleted ? (isTerminalWon ? 'bg-success text-white' : 'bg-info text-white') :
                                isCurrent ? (isWonType(stage) ? 'bg-success/20 border-2 border-success text-success' : 'bg-info/20 border-2 border-info text-info') :
                                'bg-fg-muted/10 border border-line-strong text-fg-subtle'
                            }`}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <span className={`text-xs mt-2 text-center w-16 truncate ${
                                isCompleted || isCurrent ? (isWonType(stage) ? 'text-success' : 'text-info') : 'text-fg-subtle'
                            }`} title={stage.name}>
                                {stage.name}
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

export default DealLifecycleStepper;
