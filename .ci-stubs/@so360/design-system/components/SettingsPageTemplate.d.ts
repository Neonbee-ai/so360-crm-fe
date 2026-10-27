import React from 'react';
import { type CombPageProps } from './usePageComb';
import { Breadcrumb } from './PageHeader';
import type { TrailItem } from './PageTrail';
export interface SettingsSection {
    id: string;
    label: string;
}
export interface SettingsPageTemplateProps extends CombPageProps {
    title: string;
    description?: string;
    /** Ancestors of this page (`Root › A`, nearest last); renders `[←] Root › A` above the title. See PageHeader. */
    trail?: TrailItem[];
    /** @deprecated Use `trail`. */
    breadcrumbs?: Breadcrumb[];
    /** @deprecated Use `trail` (back goes to the last trail item). */
    onBack?: () => void;
    primaryAction?: React.ReactNode;
    /** Left nav entries (240px). Below 768px the nav becomes a Select above the content. */
    sections?: SettingsSection[];
    activeSection?: string;
    onSectionChange?: (id: string) => void;
    /** Active section content, usually one or more SettingsCard. */
    children?: React.ReactNode;
    className?: string;
}
/**
 * Settings page: header, 240px section nav + content. Both nav variants are rendered and toggled by CSS
 * (`md:hidden` Select, `hidden md:block` nav) so there is no JS breakpoint logic.
 *
 * @example
 * <SettingsPageTemplate title="Settings" sections={[{ id: 'general', label: 'General' }]}
 *   activeSection={s} onSectionChange={setS}><SettingsCard title="General">...</SettingsCard></SettingsPageTemplate>
 */
export declare const SettingsPageTemplate: React.FC<SettingsPageTemplateProps>;
export interface SettingsCardProps {
    title: string;
    description?: string;
    /** Footer actions, e.g. a Save button (right-aligned). */
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}
/** A settings group on `bg-surface`: title, description, body, optional footer actions. */
export declare const SettingsCard: React.FC<SettingsCardProps>;
