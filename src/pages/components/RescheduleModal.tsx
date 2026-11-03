import React, { useState } from 'react';
import { Button, DatePicker, TimePicker } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';
import { splitStoredDueDate, composeDueDate } from '../../utils/datetime';

interface RescheduleModalProps {
    currentDate: string;
    onClose: () => void;
    /** Receives the API-ready due date: a bare calendar day, or a zone-stamped instant. */
    onConfirm: (newDate: string) => void;
}

/**
 * Rescheduling used to move only the calendar day, so a task pushed from
 * "20 Aug 2:30 PM" to the 22nd silently lost its time and reappeared at
 * midnight. Both halves of the due date are editable here for that reason —
 * and, as in TaskModal, the time may be cleared back to a plain date.
 */
export const RescheduleModal: React.FC<RescheduleModalProps> = ({
    currentDate,
    onClose,
    onConfirm
}) => {
    const initial = splitStoredDueDate(currentDate);
    const [newDate, setNewDate] = useState(initial.date);
    const [newTime, setNewTime] = useState(initial.time);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(composeDueDate(newDate, newTime));
    };

    return (
        <Modal isOpen onClose={onClose} title="Reschedule Task" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <DatePicker
                    name="reschedule-date"
                    label="New Due Date"
                    value={newDate}
                    onChange={(v: string) => setNewDate(v)}
                    required
                />
                <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                        <TimePicker
                            name="reschedule-time"
                            label="New Due Time (optional)"
                            value={newTime}
                            onChange={(v: string) => setNewTime(v)}
                        />
                    </div>
                    {newTime && (
                        <Button type="button" variant="secondary" onClick={() => setNewTime('')}>
                            Clear
                        </Button>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        Reschedule
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
