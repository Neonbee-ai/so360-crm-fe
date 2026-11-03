import React, { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Card, EmptyState, Badge } from '@so360/design-system';
import { contactFeed, FeedGroups } from '../services/coreS2sService';

interface Props {
    entityType: string;
    entityId: string;
}

const labelOf = (type: string) => type.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** Contact 360: everything linked to this customer, grouped by related entity type. */
export const ContactFeedPanel = ({ entityType, entityId }: Props) => {
    const [feed, setFeed] = useState<FeedGroups | null>(null);

    useEffect(() => {
        let live = true;
        setFeed(null);
        contactFeed.grouped(entityType, entityId).then(f => { if (live) setFeed(f); });
        return () => { live = false; };
    }, [entityType, entityId]);

    const groups = Object.entries(feed?.groups ?? {});

    return (
        <Card title="Activity across modules" data-testid="contact-feed-panel">
            {feed && groups.length === 0 ? (
                <EmptyState icon={Inbox} title="No linked activity yet" />
            ) : (
                <div className="flex flex-col gap-nb-3">
                    {groups.map(([type, g]) => (
                        <section key={type} aria-label={labelOf(type)}>
                            <h4 className="flex items-center gap-nb-2 text-sm font-semibold text-fg">
                                {labelOf(type)} <Badge size="sm" tone="neutral">{g.count}</Badge>
                            </h4>
                            <ul className="divide-y divide-line">
                                {g.items.slice(0, 5).map(i => (
                                    <li key={`${i.id}-${i.rel}`} className="py-nb-1 text-sm text-fg-muted">
                                        {i.rel ? `${i.rel.replace(/_/g, ' ')} · ` : ''}{i.id.slice(0, 8)}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </Card>
    );
};
