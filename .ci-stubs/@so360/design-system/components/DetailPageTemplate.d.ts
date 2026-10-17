import React from 'react';
import { type CombPageProps } from './usePageComb';
import type { BreadcrumbItem } from './Breadcrumbs';
import { MenuItem } from './Menu';
import { type PageHeaderAction, type PageHeaderMetaItem } from './PageHeader';
import type { TrailItem } from './PageTrail';
import { TabItem } from './Tabs';
export interface DetailPageTemplateProps extends CombPageProps {
    /** Ancestors of this page (`Root › A`, nearest last); renders `[←] Root › A` above the title. See PageHeader. */
    trail?: TrailItem[];
    /** @deprecated Use `trail`. */
    breadcrumbs?: BreadcrumbItem[];
    /** @deprecated Use `trail` (back goes to the last trail item). */
    onBack?: () => void;
    /** @deprecated Accessible name of the legacy `onBack` action. */
    backLabel?: string;
    title: string;
    /** Record count chip next to the title. */
    count?: number | string;
    /** Status badge next to the title. */
    status?: React.ReactNode;
    /** Line under the title (owner, updated-at, ...). */
    meta?: React.ReactNode;
    /** Quiet single meta row under the title (deadline, owner avatars, tags). See PageHeader. */
    metaItems?: PageHeaderMetaItem[];
    /** Secondary actions that collapse into "More" as the header narrows (replaces secondaryActions). */
    collapsibleActions?: PageHeaderAction[];
    /** Legacy free-form actions slot (rendered right). Prefer the three props below. */
    actions?: React.ReactNode;
    /** The single filled primary action, rightmost. */
    primaryAction?: React.ReactNode;
    /** Up to 2 outlined secondary actions before the primary. */
    secondaryActions?: React.ReactNode[];
    /** Overflow "..." items; destructive actions belong here. */
    overflowActions?: MenuItem[];
    /** Tabs rendered directly under the header. */
    tabs?: TabItem[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    /** Shows skeleton blocks in place of the body. */
    loading?: boolean;
    /** Main column (8/12 from 1024px). */
    children?: React.ReactNode;
    /** Right rail (4/12 from 1024px); stacks below the main column under 1024px. */
    sidePanel?: React.ReactNode;
    className?: string;
}
/**
 * Record detail page: trail row (`[←] Root › A`), header (title, count, status, meta, actions), tabs, then main 8/12 + right rail 4/12.
 *
 * @example
 * <DetailPageTemplate title="INV-204" status={<Badge>Paid</Badge>} primaryAction={<Button>Edit</Button>}
 *   overflowActions={[{ label: 'Delete', danger: true, onSelect }]}
 *   tabs={[{ id: 'overview', label: 'Overview' }, { id: 'activity', label: 'Activity' }]}
 *   activeTab={tab} onTabChange={setTab} sidePanel={<Timeline />}>...</DetailPageTemplate>
 */
export declare const DetailPageTemplate: React.FC<DetailPageTemplateProps>;
