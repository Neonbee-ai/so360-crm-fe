import React from 'react';
import { Badge, Button, Card, EmptyState, Skeleton } from '@so360/design-system';
import { UpNextTask } from '../../types/crm';
import { groupUpNext, UpNextGroupKey, UP_NEXT_DAYS } from '../../utils/upNext';

interface UpNextPanelProps {
    items: UpNextTask[];
    loading: boolean;
    /** Formats an instant as a short time, e.g. "4:05 PM". */
    formatTime: (iso: string) => string;
    /** Formats an instant as a short day, e.g. "Thu 7 Aug". */
    formatDay: (iso: string) => string;
    onOpen: (task: UpNextTask) => void;
}

export function upNextGroupLabel(key: UpNextGroupKey, sample?: UpNextTask, formatDay?: (iso: string) => string): string {
    if (key === 'overdue') return 'Overdue';
    if (key === 0) return 'Today';
    if (key === 1) return 'Tomorrow';
    return sample && formatDay ? formatDay(sample.at) : `In ${key} days`;
}

/**
 * Up Next agenda (Pulse 552552b8): booked calls/meetings and reminders for
 * today and the next week, past-due items first and flagged. Only days with
 * something on them are listed so the panel stays short.
 */
export const UpNextPanel: React.FC<UpNextPanelProps> = ({ items, loading, formatTime, formatDay, onOpen }) => {
    const groups = groupUpNext(items).filter(g => g.items.length > 0);
    return (
        <Card title="Up next" data-testid="tasks-up-next">
            {loading ? (
                <Skeleton />
            ) : groups.length === 0 ? (
                <EmptyState title="Nothing booked" description={`No calls, meetings or reminders in the next ${UP_NEXT_DAYS} days.`} />
            ) : (
                <div className="flex flex-col gap-3">
                    {groups.map(g => (
                        <section key={String(g.key)} data-testid={`up-next-group-${g.key}`} className="flex flex-col gap-1">
                            <h4 className={`text-nb-caption font-semibold ${g.key === 'overdue' ? 'text-danger' : 'text-fg-subtle'}`}>
                                {upNextGroupLabel(g.key, g.items[0], formatDay)} · {g.items.length}
                            </h4>
                            {g.items.map(item => (
                                <Button
                                    key={item.id}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start"
                                    data-testid={`up-next-item-${item.id}`}
                                    onClick={() => onOpen(item)}
                                >
                                    <span className="tabular-nums text-fg-subtle">{formatTime(item.at)}</span>
                                    <span className="truncate text-fg">{item.title}</span>
                                    <Badge size="sm" tone={item.overdue ? 'danger' : item.kind === 'reminder' ? 'warning' : 'info'}>
                                        {item.overdue ? 'Overdue' : item.kind === 'reminder' ? 'Reminder' : item.type === 'MEETING' ? 'Meeting' : 'Call'}
                                    </Badge>
                                </Button>
                            ))}
                        </section>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default UpNextPanel;
