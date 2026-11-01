import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Deal } from '../../types/crm';
import { Button, Textarea } from '@so360/design-system';
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
                <div className="p-3 bg-bg border border-line rounded-lg">
                    <p className="text-sm text-fg-subtle">
                        Moving <span className="text-fg font-bold">{deal.name}</span> to the <span className="text-primary font-bold">{newStage}</span> stage.
                    </p>
                </div>

                {isSpecialStage && (
                    <Textarea
                        name="stage-transition-reason"
                        label={`Reason for ${newStage}`}
                        required
                        value={reason}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                        placeholder={`Please provide a brief reason for marking this deal as ${newStage}...`}
                        rows={4}
                    />
                )}

                {!isSpecialStage && (
                    <p className="text-sm text-fg-muted italic">
                        Confirm the stage change for this opportunity.
                    </p>
                )}

                <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant={newStage === 'Lost' ? 'danger' : 'primary'} className="flex-1">
                        Confirm Transition
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
