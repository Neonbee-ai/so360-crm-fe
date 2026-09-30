import React, { useEffect, useMemo } from 'react';
import * as ShellContextModule from '@so360/shell-context';
import { useShellBridge } from '@so360/shell-context';

/**
 * Neonbee Dynamic Data Layer — Class B enablement for CRM record pages.
 *
 * CRM owns its pages; the data layer injects Shell-registered renderers
 * (custom_fields, child_collection, …) into named slots. This module only
 * DECLARES layouts and slot placements and passes entity + record + version
 * context. It never renders a custom field itself.
 *
 * Capability detection: `@so360/shell-context` is a Module Federation shared
 * singleton, so at runtime the Shell's copy wins. An older Shell (or a test
 * mock of shell-context) has no dataLayer exports; in that case every helper
 * here degrades to "render nothing" and the native page is untouched.
 */

export const DATA_LAYER_CUSTOM_FIELDS_FLAG = 'submodule:data_layer:custom_fields';

export const CRM_DATA_LAYER_ENTITIES = {
    LEAD: 'crm.lead',
    DEAL: 'crm.deal',
    PARTNER: 'core.partner',
} as const;

export type CrmDataLayerEntity = typeof CRM_DATA_LAYER_ENTITIES[keyof typeof CRM_DATA_LAYER_ENTITIES];

// ── Minimal local mirror of the shell-context dataLayer contract ─────────────
// (kept local so crm-fe type-checks against any shell-context dist, old or new)

export type DlSlotName =
    | 'detail.tab' | 'detail.section' | 'detail.sidebar' | 'detail.actions'
    | 'list.column' | 'list.filter' | 'list.toolbar' | 'list.row_actions'
    | 'create.section' | 'form.footer' | 'search' | 'export' | 'print' | 'settings';

export type DlLayoutRegion = 'header' | 'actions' | 'main' | 'sidebar' | 'tabs' | 'footer';

export interface DlSlotRegistration {
    id?: string;
    dataset_code: string;
    slot: DlSlotName;
    renderer: string;
    label?: string;
    props?: Record<string, unknown>;
    sort_order?: number;
    visibility_profile?: string;
    enabled?: boolean;
}

export interface DlResolvedSlot {
    registration: DlSlotRegistration;
    Renderer: React.ComponentType<any> | null;
    key: string;
}

export interface DlFieldDef {
    field_key: string;
    label: string;
    field_type: string;
    required?: boolean;
    indexed?: boolean;
    visibility_profile?: string;
    sort_order?: number;
    config?: Record<string, unknown>;
}

export interface DlRecordLayoutDefinition {
    entity: string;
    regions?: Partial<Record<DlLayoutRegion, boolean>>;
    slots?: DlSlotName[];
    tabOrder?: string[];
}

export interface DlSaveResult {
    ok: boolean;
    record?: Record<string, unknown>;
    conflict?: boolean;
    current?: Record<string, unknown>;
    error?: string;
}

interface DataLayerApi {
    useSlotRenderers: (code: string, slot: DlSlotName, opts?: { profile?: string; isAdmin?: boolean }) => DlResolvedSlot[];
    registerRecordLayout: (def: DlRecordLayoutDefinition) => () => void;
    getRecordLayout: (entity: string) => DlRecordLayoutDefinition | null;
    useDatasetSchema: (code: string | null | undefined, opts?: Record<string, unknown>) => { fields: DlFieldDef[] };
}

const REQUIRED_EXPORTS = ['useSlotRenderers', 'registerRecordLayout', 'getRecordLayout', 'useDatasetSchema'] as const;

/**
 * Uses the `in` operator (never a property read) so a vi.mock()ed shell-context
 * without these exports does not throw "No export is defined on the mock".
 */
export function resolveDataLayerApi(mod: unknown = ShellContextModule): DataLayerApi | null {
    if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
    for (const key of REQUIRED_EXPORTS) {
        if (!(key in (mod as object))) return null;
    }
    const api = mod as unknown as DataLayerApi;
    for (const key of REQUIRED_EXPORTS) {
        if (typeof (api as any)[key] !== 'function') return null;
    }
    return api;
}

const API: DataLayerApi | null = resolveDataLayerApi();

export function isDataLayerAvailable(): boolean {
    return API !== null;
}

// ── Record layouts (one per Class B entity) ──────────────────────────────────

const DETAIL_SLOTS: DlSlotName[] = ['detail.sidebar', 'detail.section', 'detail.tab', 'detail.actions'];

export const CRM_RECORD_LAYOUTS: Record<CrmDataLayerEntity, DlRecordLayoutDefinition> = {
    'crm.lead': {
        entity: 'crm.lead',
        regions: { header: true, actions: true, main: true, sidebar: true, tabs: true, footer: false },
        slots: [...DETAIL_SLOTS, 'create.section', 'list.column', 'list.filter'],
        tabOrder: ['activity', 'notes', 'tasks', 'documents', 'products', 'feedback', 'calls', 'audit', 'stakeholders', 'emails', 'meetings', 'history'],
    },
    'crm.deal': {
        entity: 'crm.deal',
        regions: { header: true, actions: true, main: true, sidebar: true, tabs: true, footer: false },
        slots: [...DETAIL_SLOTS, 'create.section', 'list.column', 'list.filter'],
        tabOrder: ['activity', 'notes', 'tasks', 'documents', 'products', 'custom', 'calls', 'payment-plan', 'commission', 'history'],
    },
    'core.partner': {
        entity: 'core.partner',
        regions: { header: true, actions: true, main: true, sidebar: true, tabs: true, footer: false },
        slots: [...DETAIL_SLOTS, 'create.section', 'list.column', 'list.filter'],
        tabOrder: ['overview', 'deals', 'commissions', 'history'],
    },
};

/** Idempotent: registers each CRM layout once with the Shell layout registry. */
export function ensureCrmRecordLayouts(api: DataLayerApi | null = API): boolean {
    if (!api) return false;
    (Object.keys(CRM_RECORD_LAYOUTS) as CrmDataLayerEntity[]).forEach((entity) => {
        if (!api.getRecordLayout(entity)) api.registerRecordLayout(CRM_RECORD_LAYOUTS[entity]);
    });
    return true;
}

// ── Visibility (defence in depth: the Shell filters too) ─────────────────────

/** Same rule as shell-context isVisibleForProfile. */
export function isDlVisible(vp: string | undefined, profile: string, isAdmin: boolean): boolean {
    if (!vp || vp === 'all') return true;
    if (vp === 'hidden') return false;
    if (vp === 'admin') return isAdmin || profile === 'admin';
    if (vp === 'internal') return isAdmin || profile === 'internal' || profile === 'admin';
    return profile === vp;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export interface CrmDataLayerState {
    /** flag on AND the running Shell exposes the dataLayer API */
    enabled: boolean;
    entity: CrmDataLayerEntity;
    profile: string;
    isAdmin: boolean;
    /** visible schema fields for the entity (empty when disabled) */
    fields: DlFieldDef[];
}

const EMPTY_FIELDS: DlFieldDef[] = [];

function useFlagOn(): { on: boolean; isAdmin: boolean } {
    const shell = useShellBridge() as any;
    const on = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(DATA_LAYER_CUSTOM_FIELDS_FLAG) ?? false);
    return { on: !!on, isAdmin: shell?.isAdmin === true };
}

const useSchemaFields: (code: string | null) => DlFieldDef[] = API
    ? (code) => API.useDatasetSchema(code)?.fields ?? EMPTY_FIELDS
    : () => EMPTY_FIELDS;

const useResolvedSlots: (code: string, slot: DlSlotName, opts: { profile: string; isAdmin: boolean }) => DlResolvedSlot[] = API
    ? (code, slot, opts) => API.useSlotRenderers(code, slot, opts)
    : () => [];

/**
 * Entry hook per page. Also hydrates the slot registry: the Shell's
 * useDatasetSchema pushes the schema's slot_registrations into the registry.
 */
export function useCrmDataLayer(entity: CrmDataLayerEntity): CrmDataLayerState {
    const { on, isAdmin } = useFlagOn();
    const enabled = on && API !== null;
    // CRM record pages are internal-staff surfaces.
    const profile = isAdmin ? 'admin' : 'internal';
    useEffect(() => {
        if (enabled) ensureCrmRecordLayouts();
    }, [enabled]);
    const rawFields = useSchemaFields(enabled ? entity : null);
    const fields = useMemo(
        () => (enabled ? rawFields.filter((f) => f.field_type !== 'child_list' && isDlVisible(f.visibility_profile, profile, isAdmin)) : EMPTY_FIELDS),
        [enabled, rawFields, profile, isAdmin],
    );
    return { enabled, entity, profile, isAdmin, fields };
}

export function useCrmSlot(dl: CrmDataLayerState, slot: DlSlotName): DlResolvedSlot[] {
    const resolved = useResolvedSlots(dl.entity, slot, { profile: dl.profile, isAdmin: dl.isAdmin });
    return useMemo(
        () => (dl.enabled
            ? resolved.filter((r) => r.Renderer && r.registration.enabled !== false && isDlVisible(r.registration.visibility_profile, dl.profile, dl.isAdmin))
            : []),
        [dl.enabled, dl.profile, dl.isAdmin, resolved],
    );
}

// ── Record context passed to every renderer ──────────────────────────────────

export interface CrmRecordContext {
    recordId: string;
    /** record as the renderer should see it; `custom_fields` = Class B values */
    record: Record<string, unknown> | null;
    /** optimistic-concurrency token (row version, else updated_at) */
    version?: number | string | null;
    /** refetch the host record after a renderer mutated data */
    onChanged?: () => void;
    /** Class B save through the native module API (see classBSave.ts) */
    onSave?: (changed: Record<string, unknown>, version?: number | string | null) => Promise<DlSaveResult>;
    canEdit?: boolean;
}

function rendererProps(dl: CrmDataLayerState, slot: DlSlotName, r: DlResolvedSlot, ctx: CrmRecordContext) {
    return {
        datasetCode: dl.entity,
        slot,
        registration: r.registration,
        recordId: ctx.recordId,
        record: ctx.record,
        version: ctx.version ?? null,
        onChanged: ctx.onChanged,
        onSave: ctx.onSave,
        canEdit: ctx.canEdit ?? false,
        saveMode: 'native' as const,
        profile: dl.profile,
        isAdmin: dl.isAdmin,
        fields: dl.fields,
        ...(r.registration.props ?? {}),
    };
}

/**
 * Marks the page as a data-layer record layout (`data-record-layout`). Pure
 * pass-through — no extra DOM at all — when disabled or when no renderer is
 * registered for any detail slot, so such pages are byte-identical to today.
 */
export function CrmRecordScope({ dl, recordId, children }: { dl: CrmDataLayerState; recordId: string; children: React.ReactNode }) {
    const sidebar = useCrmSlot(dl, 'detail.sidebar');
    const section = useCrmSlot(dl, 'detail.section');
    const tabs = useCrmSlot(dl, 'detail.tab');
    const actions = useCrmSlot(dl, 'detail.actions');
    const hasAny = sidebar.length + section.length + tabs.length + actions.length > 0;
    if (!dl.enabled || !hasAny) return <>{children}</>;
    return (
        <div data-record-layout={dl.entity} data-record-id={recordId} style={{ display: 'contents' }}>
            {children}
        </div>
    );
}

/**
 * Renders every Shell renderer registered for `slot` at a native position.
 * Returns null (no wrapper, no DOM) when nothing resolves.
 */
export function CrmSlotRegion({
    dl, slot, region, ctx, className,
}: { dl: CrmDataLayerState; slot: DlSlotName; region: DlLayoutRegion; ctx: CrmRecordContext; className?: string }) {
    const resolved = useCrmSlot(dl, slot);
    if (resolved.length === 0) return null;
    return (
        <div
            data-region={region}
            data-dl-slot={slot}
            data-dl-entity={dl.entity}
            data-dl-record-id={ctx.recordId}
            className={className}
        >
            {resolved.map((r) => {
                const Renderer = r.Renderer as React.ComponentType<any>;
                return <Renderer key={r.key} {...rendererProps(dl, slot, r, ctx)} />;
            })}
        </div>
    );
}

export interface CrmInjectedTab {
    /** tab id to store in the page's activeTab state (prefixed `dl:`) */
    id: string;
    label: string;
    render: () => React.ReactNode;
}

export const INJECTED_TAB_PREFIX = 'dl:';

/** detail.tab registrations → tabs the page appends to its native tab strip. */
export function useCrmInjectedTabs(dl: CrmDataLayerState, ctx: CrmRecordContext): CrmInjectedTab[] {
    const resolved = useCrmSlot(dl, 'detail.tab');
    return useMemo(() => resolved.map((r) => {
        const Renderer = r.Renderer as React.ComponentType<any>;
        const id = `${INJECTED_TAB_PREFIX}${r.registration.id ?? r.key}`;
        return {
            id,
            label: r.registration.label ?? r.registration.renderer,
            render: () => (
                <div data-region="tabs" data-dl-slot="detail.tab" data-dl-entity={dl.entity} data-dl-record-id={ctx.recordId} data-injected="true">
                    <Renderer {...rendererProps(dl, 'detail.tab', r, ctx)} />
                </div>
            ),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [resolved, dl, ctx.recordId, ctx.record, ctx.version, ctx.onChanged, ctx.onSave, ctx.canEdit]);
}

// ── Create / edit forms (create.section) ─────────────────────────────────────

/**
 * Renders create.section renderers inside a native create/edit form. Values are
 * collected into `values` (Class B `custom_fields`) and the host sends them in
 * its existing native save payload — Class B values are written by the module.
 */
export function CrmCreateSection({
    dl, mode, recordId, values, onValuesChange, className,
}: {
    dl: CrmDataLayerState;
    mode: 'create' | 'edit';
    recordId?: string;
    values: Record<string, unknown>;
    onValuesChange: (next: Record<string, unknown>) => void;
    className?: string;
}) {
    const resolved = useCrmSlot(dl, 'create.section');
    if (resolved.length === 0) return null;
    return (
        <div data-region="main" data-dl-slot="create.section" data-dl-entity={dl.entity} data-dl-mode={mode} className={className}>
            {resolved.map((r) => {
                const Renderer = r.Renderer as React.ComponentType<any>;
                return (
                    <Renderer
                        key={r.key}
                        datasetCode={dl.entity}
                        slot="create.section"
                        registration={r.registration}
                        recordId={recordId}
                        record={recordId ? { id: recordId, custom_fields: values } : null}
                        mode={mode}
                        values={values}
                        onValuesChange={onValuesChange}
                        fields={dl.fields}
                        profile={dl.profile}
                        isAdmin={dl.isAdmin}
                        saveMode="native"
                        {...(r.registration.props ?? {})}
                    />
                );
            })}
        </div>
    );
}

/** Keys of required, visible Class B fields that are empty in `values`. */
export function missingRequiredCustomFields(dl: CrmDataLayerState, values: Record<string, unknown>): string[] {
    if (!dl.enabled) return [];
    return dl.fields
        .filter((f) => f.required)
        .filter((f) => {
            const v = values[f.field_key];
            return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
        })
        .map((f) => f.field_key);
}

// ── List columns (list.column / list.filter) ─────────────────────────────────

export interface CrmCustomColumn {
    key: string;
    label: string;
    fieldType: string;
    /** only indexed fields may drive filter/sort (gateway: DATASET_FIELD_NOT_INDEXED) */
    filterable: boolean;
    sortable: boolean;
}

/** Schema fields → optional grid columns. Non-indexed fields are display-only. */
export function useCrmCustomColumns(dl: CrmDataLayerState): CrmCustomColumn[] {
    return useMemo(() => {
        if (!dl.enabled) return [];
        return [...dl.fields]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((f) => ({
                key: f.field_key,
                label: f.label,
                fieldType: f.field_type,
                filterable: f.indexed === true,
                sortable: f.indexed === true,
            }));
    }, [dl.enabled, dl.fields]);
}

/** Display-only formatting for a Class B value in a grid cell. */
export function formatCustomFieldValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.map((v) => formatCustomFieldValue(v)).join(', ');
    if (typeof value === 'object') {
        const o = value as Record<string, unknown>;
        return String(o.label ?? o.name ?? o.display ?? o.id ?? JSON.stringify(o));
    }
    return String(value);
}
