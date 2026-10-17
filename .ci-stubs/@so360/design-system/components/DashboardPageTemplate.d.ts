import React from 'react';
import { type CombPageProps } from './usePageComb';
import { Breadcrumb } from './PageHeader';
import type { TrailItem } from './PageTrail';
export interface DashboardPageTemplateProps extends CombPageProps {
    title: string;
    description?: string;
    /** Ancestors of this page (`Root › A`, nearest last); renders `[←] Root › A` above the title. See PageHeader. */
    trail?: TrailItem[];
    /** @deprecated Use `trail`. */
    breadcrumbs?: Breadcrumb[];
    meta?: React.ReactNode;
    /** Toolbar filters (date range, org, ...), left of the toolbar row under the header. */
    filters?: React.ReactNode;
    /** Right side of the toolbar row (store picker, view toggle, ...). */
    toolbarEnd?: React.ReactNode;
    /** Up to 2 outlined secondary header buttons, placed left of the primary. */
    secondaryActions?: React.ReactNode;
    primaryAction?: React.ReactNode;
    /** KPI cards. Each child is a grid cell: 4 columns, 2 below 1024px, 1 below 600px; equal height. */
    kpis?: React.ReactNode;
    /** Main region (8/12 from 1024px). */
    primary?: React.ReactNode;
    /** Side region (4/12 from 1024px). */
    secondary?: React.ReactNode;
    /** Full-width region (12/12). */
    bottom?: React.ReactNode;
    /** Extra content appended after the bottom slot. */
    children?: React.ReactNode;
    className?: string;
}
/**
 * Dashboard: header (filters in the right slot), KPI row, primary 8/12 + secondary 4/12, bottom 12/12.
 *
 * @example
 * <DashboardPageTemplate title="Sales" filters={<DateRangePicker />} kpis={[<KpiCard/>, <KpiCard/>]}
 *   primary={<RevenueChart />} secondary={<TopDeals />} bottom={<DataTable ... />} />
 */
export declare const DashboardPageTemplate: React.FC<DashboardPageTemplateProps>;
