import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
            <div className="bg-surface border border-line rounded-nb-lg w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-fg">Reschedule Task</h3>
                    <button onClick={onClose} className="text-fg-subtle hover:text-fg">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="reschedule-date" className="text-xs font-bold text-fg-subtle">New Due Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={16} />
                            <input
                                id="reschedule-date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-10 pr-4 py-3 outline-none focus:border-primary"
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="reschedule-time" className="text-xs font-bold text-fg-subtle">
                            New Due Time <span className=" text-fg-muted">(optional)</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={16} />
                                <input
                                    id="reschedule-time"
                                    type="time"
                                    value={newTime}
                                    onChange={(e) => setNewTime(e.target.value)}
                                    className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-10 pr-4 py-3 outline-none focus:border-primary"
                                />
                            </div>
                            {newTime && (
                                <button
                                    type="button"
                                    onClick={() => setNewTime('')}
                                    className="px-3 py-3 rounded-nb-lg border border-line text-xs font-bold text-fg-subtle hover:text-fg"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-fg-subtle hover:text-fg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-nb-lg font-bold"
                        >
                            Reschedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
