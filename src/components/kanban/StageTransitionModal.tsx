import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Deal } from '../../types/crm';
import { AlertCircle } from 'lucide-react';
import { useActivity } from '@so360/shell-context';

interface StageTransitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    deal: Deal | null;
    newStage: string;
}

export const StageTransitionModal = ({ isOpen, onClose, onConfirm, deal, newStage }: StageTransitionModalProps) => {
    const [reason, setReason] = useState('');
    const isSpecialStage = newStage === 'Won' || newStage === 'Lost';
    const { recordActivity } = useActivity();

    if (!deal) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(reason);
        recordActivity({ eventType: 'deal.stage_changed', eventCategory: 'crm', description: `Moved deal "${deal.name}" to stage "${newStage}"`, resourceType: 'deal', resourceId: deal.id }).catch(() => {});
        setReason('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSpecialStage ? `Close Deal: ${newStage}` : `Move to ${newStage}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-bg border border-slate-800 rounded-lg">
                    <p className="text-sm text-fg-subtle">
                        Moving <span className="text-fg font-bold">{deal.name}</span> to the <span className="text-blue-400 font-bold">{newStage}</span> stage.
                    </p>
                </div>

                {isSpecialStage && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-fg-subtle flex items-center gap-2">
                            Reason for {newStage} *
                            <AlertCircle size={14} className="text-fg-muted" />
                        </label>
                        <textarea
                            required
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={`Please provide a brief reason for marking this deal as ${newStage}...`}
                            className="w-full bg-bg border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-24"
                        />
                    </div>
                )}

                {!isSpecialStage && (
                    <p className="text-sm text-fg-muted italic">
                        Confirm the stage change for this opportunity.
                    </p>
                )}

                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-800 text-fg-subtle hover:bg-surface-raised transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95 text-sm ${newStage === 'Won' ? 'bg-success hover:bg-success text-white' :
                                newStage === 'Lost' ? 'bg-danger hover:bg-danger text-white' :
                                    'bg-primary hover:bg-primary text-white'
                            }`}
                    >
                        Confirm Transition
                    </button>
                </div>
            </form>
        </Modal>
    );
};
