import React from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

/**
 * Neonbee Data Layer (Class B) — CRM side contract.
 * The Shell owns renderers + the slot registry; CRM only declares layouts,
 * places slots, and hands renderers entity + record + version context.
 */

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
const dl = vi.hoisted(() => ({
    flag: true,
    isAdmin: false,
    fields: [] as any[],
    regs: [] as any[],
    layouts: {} as Record<string, any>,
    slotCalls: [] as any[],
}));

const api = vi.hoisted(() => ({
    leads: { update: vi.fn() },
    deals: { update: vi.fn() },
    partners: { update: vi.fn() },
}));

vi.mock('../services/crmService', () => ({
    leadsApi: api.leads,
    dealsApi: api.deals,
    partnersApi: api.partners,
}));

function Probe(props: any) {
    return (
        <div
            data-testid={`probe-${props.slot}-${props.registration.id}`}
            data-entity={props.datasetCode}
            data-record-id={props.recordId}
            data-version={String(props.version)}
            data-save-mode={props.saveMode}
            data-mode={props.mode ?? ''}
        />
    );
}

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        effectiveFlagsLoaded: true,
        isAdmin: dl.isAdmin,
        isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    }),
    useDatasetSchema: () => ({ fields: dl.fields }),
    useSlotRenderers: (code: string, slot: string, opts: any) => {
        dl.slotCalls.push({ code, slot, opts });
        return dl.regs
            .filter((r) => r.dataset_code === code && r.slot === slot)
            .map((r) => ({ registration: r, Renderer: r.renderer === 'missing' ? null : Probe, key: r.id }));
    },
    registerRecordLayout: (def: any) => {
        dl.layouts[def.entity] = def;
        return () => { delete dl.layouts[def.entity]; };
    },
    getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

import {
    resolveDataLayerApi, ensureCrmRecordLayouts, isDlVisible, useCrmDataLayer, useCrmSlot,
    useCrmCustomColumns, CrmSlotRegion, CrmRecordScope, CrmCreateSection, useCrmInjectedTabs,
    missingRequiredCustomFields, formatCustomFieldValue, isDataLayerAvailable, DATA_LAYER_CUSTOM_FIELDS_FLAG,
} from './crmDataLayer';
import { saveClassBCustomFields, currentClassBValues, recordVersion, wireVersion, isVersionConflict } from './classBSave';

beforeEach(() => {
    dl.flag = true;
    dl.isAdmin = false;
    dl.fields = [];
    dl.regs = [];
    dl.layouts = {};
    dl.slotCalls = [];
    api.leads.update.mockReset();
    api.deals.update.mockReset();
    api.partners.update.mockReset();
});

const reg = (over: any) => ({ id: 'r1', dataset_code: 'crm.lead', slot: 'detail.section', renderer: 'custom_fields', ...over });
const ctx = { recordId: 'lead-1', record: { id: 'lead-1', custom_fields: {} }, version: 7, canEdit: true };

describe('Given the flag key', () => {
    test('When read / Then it is the spec flag submodule:data_layer:custom_fields', () => {
        expect(DATA_LAYER_CUSTOM_FIELDS_FLAG).toBe('submodule:data_layer:custom_fields');
    });
});

describe('Given capability detection of the shell-context dataLayer API', () => {
    test('When the Shell exposes the API / Then it is available', () => {
        expect(isDataLayerAvailable()).toBe(true);
    });
    test('When an older Shell lacks the exports / Then the API resolves to null', () => {
        expect(resolveDataLayerApi({ useShellBridge: () => ({}) })).toBeNull();
        expect(resolveDataLayerApi(null)).toBeNull();
    });
    test('When an export exists but is not a function / Then the API resolves to null', () => {
        expect(resolveDataLayerApi({ useSlotRenderers: 1, registerRecordLayout: vi.fn(), getRecordLayout: vi.fn(), useDatasetSchema: vi.fn() })).toBeNull();
    });
});

describe('Given the CRM record layouts', () => {
    test('When ensured / Then crm.lead, crm.deal and core.partner are each registered with a History tab', () => {
        expect(ensureCrmRecordLayouts()).toBe(true);
        for (const entity of ['crm.lead', 'crm.deal', 'core.partner']) {
            const def = dl.layouts[entity];
            expect(def.entity).toBe(entity);
            expect(def.regions).toMatchObject({ main: true, sidebar: true, tabs: true, actions: true });
            expect(def.tabOrder).toContain('history');
            expect(def.slots).toEqual(expect.arrayContaining(['detail.section', 'detail.sidebar', 'detail.tab', 'create.section', 'list.column']));
        }
    });
    test('When ensured twice / Then an existing registration is not replaced', () => {
        dl.layouts['crm.lead'] = { entity: 'crm.lead', marker: 'shell-owned' };
        ensureCrmRecordLayouts();
        expect(dl.layouts['crm.lead'].marker).toBe('shell-owned');
    });
    test('When the API is unavailable / Then nothing is registered', () => {
        expect(ensureCrmRecordLayouts(null)).toBe(false);
    });
    test('When useCrmDataLayer mounts with the flag on / Then layouts are registered', () => {
        renderHook(() => useCrmDataLayer('crm.deal'));
        expect(dl.layouts['crm.deal']).toBeTruthy();
    });
    test('When useCrmDataLayer mounts with the flag off / Then no layout is registered', () => {
        dl.flag = false;
        renderHook(() => useCrmDataLayer('crm.deal'));
        expect(dl.layouts['crm.deal']).toBeUndefined();
    });
});

describe('Given visibility_profile rules', () => {
    test('When profile values vary / Then they mirror the Shell rule', () => {
        expect(isDlVisible(undefined, 'internal', false)).toBe(true);
        expect(isDlVisible('all', 'internal', false)).toBe(true);
        expect(isDlVisible('hidden', 'admin', true)).toBe(false);
        expect(isDlVisible('admin', 'internal', false)).toBe(false);
        expect(isDlVisible('admin', 'admin', true)).toBe(true);
        expect(isDlVisible('internal', 'internal', false)).toBe(true);
        expect(isDlVisible('portal', 'internal', false)).toBe(false);
        expect(isDlVisible('portal', 'portal', false)).toBe(true);
    });
    test('When a registration is hidden / Then useCrmSlot drops it even if the Shell returned it', () => {
        dl.regs = [reg({ id: 'a' }), reg({ id: 'b', visibility_profile: 'hidden' })];
        const { result } = renderHook(() => useCrmSlot(useCrmDataLayer('crm.lead'), 'detail.section'));
        expect(result.current.map((r) => r.key)).toEqual(['a']);
    });
    test('When a user is not admin / Then admin-only registrations are dropped and profile=internal is sent', () => {
        dl.regs = [reg({ id: 'a', visibility_profile: 'admin' })];
        const { result } = renderHook(() => useCrmSlot(useCrmDataLayer('crm.lead'), 'detail.section'));
        expect(result.current).toEqual([]);
        expect(dl.slotCalls.at(-1).opts).toEqual({ profile: 'internal', isAdmin: false });
    });
    test('When the user is an admin / Then admin-only registrations show and profile=admin is sent', () => {
        dl.isAdmin = true;
        dl.regs = [reg({ id: 'a', visibility_profile: 'admin' })];
        const { result } = renderHook(() => useCrmSlot(useCrmDataLayer('crm.lead'), 'detail.section'));
        expect(result.current.map((r) => r.key)).toEqual(['a']);
        expect(dl.slotCalls.at(-1).opts).toEqual({ profile: 'admin', isAdmin: true });
    });
    test('When a registration has no Renderer / Then it is skipped', () => {
        dl.regs = [reg({ id: 'a', renderer: 'missing' })];
        const { result } = renderHook(() => useCrmSlot(useCrmDataLayer('crm.lead'), 'detail.section'));
        expect(result.current).toEqual([]);
    });
    test('When hidden schema fields exist / Then they are excluded from the entity fields', () => {
        dl.fields = [{ field_key: 'a', label: 'A', field_type: 'text' }, { field_key: 'h', label: 'H', field_type: 'text', visibility_profile: 'hidden' }];
        const { result } = renderHook(() => useCrmDataLayer('crm.lead'));
        expect(result.current.fields.map((f) => f.field_key)).toEqual(['a']);
    });
});

describe('Given CrmSlotRegion', () => {
    function Host({ slot = 'detail.section' as any }) {
        const state = useCrmDataLayer('crm.lead');
        return <CrmSlotRegion dl={state} slot={slot} region="main" ctx={ctx} />;
    }
    test('When the flag is off / Then it renders nothing', () => {
        dl.flag = false;
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When the flag is on but nothing is registered / Then it renders nothing', () => {
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When a renderer is registered / Then it receives entity, record id and version with native save mode', () => {
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        const region = container.querySelector('[data-dl-slot="detail.section"]')!;
        expect(region.getAttribute('data-dl-entity')).toBe('crm.lead');
        expect(region.getAttribute('data-dl-record-id')).toBe('lead-1');
        expect(region.getAttribute('data-region')).toBe('main');
        const probe = screen.getByTestId('probe-detail.section-r1');
        expect(probe.getAttribute('data-entity')).toBe('crm.lead');
        expect(probe.getAttribute('data-record-id')).toBe('lead-1');
        expect(probe.getAttribute('data-version')).toBe('7');
        expect(probe.getAttribute('data-save-mode')).toBe('native');
    });
    test('When registrations belong to another entity / Then they are not rendered', () => {
        dl.regs = [reg({ dataset_code: 'crm.deal' })];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
});

describe('Given CrmRecordScope', () => {
    function Host() {
        const state = useCrmDataLayer('crm.lead');
        return <CrmRecordScope dl={state} recordId="lead-1"><p>native</p></CrmRecordScope>;
    }
    test('When disabled / Then children render with no wrapper', () => {
        dl.flag = false;
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('<p>native</p>');
    });
    test('When enabled without any detail registration / Then children render with no wrapper', () => {
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('<p>native</p>');
    });
    test('When enabled with a registration / Then the page is marked with the entity layout', () => {
        dl.regs = [reg({ slot: 'detail.sidebar' })];
        const { container } = render(<Host />);
        const scope = container.querySelector('[data-record-layout="crm.lead"]')!;
        expect(scope.getAttribute('data-record-id')).toBe('lead-1');
        expect(scope.textContent).toBe('native');
    });
});

describe('Given detail.tab registrations', () => {
    test('When resolved / Then each becomes a dl:-prefixed injected tab rendering the Shell renderer', () => {
        dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'History' })];
        const { result } = renderHook(() => useCrmInjectedTabs(useCrmDataLayer('crm.lead'), ctx));
        expect(result.current.map((t) => [t.id, t.label])).toEqual([['dl:hist', 'History']]);
        render(<>{result.current[0].render()}</>);
        expect(screen.getByTestId('probe-detail.tab-hist').getAttribute('data-record-id')).toBe('lead-1');
    });
    test('When the flag is off / Then there are no injected tabs', () => {
        dl.flag = false;
        dl.regs = [reg({ id: 'hist', slot: 'detail.tab' })];
        const { result } = renderHook(() => useCrmInjectedTabs(useCrmDataLayer('crm.lead'), ctx));
        expect(result.current).toEqual([]);
    });
});

describe('Given CrmCreateSection in a native form', () => {
    function Host({ mode = 'create' as 'create' | 'edit' }) {
        const state = useCrmDataLayer('crm.deal');
        return <CrmCreateSection dl={state} mode={mode} values={{}} onValuesChange={() => {}} />;
    }
    test('When the flag is off / Then no inputs are injected', () => {
        dl.flag = false;
        dl.regs = [reg({ dataset_code: 'crm.deal', slot: 'create.section' })];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When a create.section renderer exists / Then it renders in create mode with native save', () => {
        dl.regs = [reg({ dataset_code: 'crm.deal', slot: 'create.section' })];
        render(<Host />);
        const probe = screen.getByTestId('probe-create.section-r1');
        expect(probe.getAttribute('data-mode')).toBe('create');
        expect(probe.getAttribute('data-entity')).toBe('crm.deal');
        expect(probe.getAttribute('data-save-mode')).toBe('native');
    });
    test('When required custom fields are empty / Then they are reported as missing', () => {
        dl.fields = [
            { field_key: 'vin', label: 'VIN', field_type: 'text', required: true },
            { field_key: 'km', label: 'KM', field_type: 'number', required: true },
            { field_key: 'opt', label: 'Opt', field_type: 'text' },
        ];
        const { result } = renderHook(() => useCrmDataLayer('crm.deal'));
        expect(missingRequiredCustomFields(result.current, { vin: '  ', km: 12 })).toEqual(['vin']);
    });
    test('When the data layer is disabled / Then nothing is reported missing', () => {
        dl.flag = false;
        dl.fields = [{ field_key: 'vin', label: 'VIN', field_type: 'text', required: true }];
        const { result } = renderHook(() => useCrmDataLayer('crm.deal'));
        expect(missingRequiredCustomFields(result.current, {})).toEqual([]);
    });
});

describe('Given list custom-field columns', () => {
    beforeEach(() => {
        dl.fields = [
            { field_key: 'plate', label: 'Plate', field_type: 'text', indexed: true, sort_order: 2 },
            { field_key: 'colour', label: 'Colour', field_type: 'text', sort_order: 1 },
            { field_key: 'secret', label: 'Secret', field_type: 'text', indexed: true, visibility_profile: 'hidden' },
        ];
    });
    test('When the flag is on / Then visible fields become columns in sort order', () => {
        const { result } = renderHook(() => useCrmCustomColumns(useCrmDataLayer('crm.lead')));
        expect(result.current.map((c) => c.key)).toEqual(['colour', 'plate']);
    });
    test('When a field is indexed / Then it is filterable and sortable; otherwise display-only', () => {
        const { result } = renderHook(() => useCrmCustomColumns(useCrmDataLayer('crm.lead')));
        const byKey = Object.fromEntries(result.current.map((c) => [c.key, c]));
        expect(byKey.plate).toMatchObject({ filterable: true, sortable: true });
        expect(byKey.colour).toMatchObject({ filterable: false, sortable: false });
    });
    test('When the flag is off / Then there are no custom columns', () => {
        dl.flag = false;
        const { result } = renderHook(() => useCrmCustomColumns(useCrmDataLayer('crm.lead')));
        expect(result.current).toEqual([]);
    });
    test('When values are formatted / Then they are display strings', () => {
        expect(formatCustomFieldValue(null)).toBe('—');
        expect(formatCustomFieldValue(true)).toBe('Yes');
        expect(formatCustomFieldValue(['a', 2])).toBe('a, 2');
        expect(formatCustomFieldValue({ label: 'Red' })).toBe('Red');
        expect(formatCustomFieldValue(42)).toBe('42');
    });
});

describe('Given the Class B native save path', () => {
    const httpError = (status: number, body: any) => Object.assign(new Error(body?.message ?? `HTTP ${status}`), { status, body });

    test('When a lead saves / Then only the changed Class B keys are PATCHed as custom_fields via leadsApi', async () => {
        api.leads.update.mockResolvedValue({ id: 'lead-1', custom_fields: { legacy: 1 }, class_b_custom_fields: { a: 1, b: 2 }, custom_fields_version: 2 });
        const lead = { id: 'lead-1', custom_fields: { legacy: 1 }, class_b_custom_fields: { a: 1 }, custom_fields_version: 1 };
        const res = await saveClassBCustomFields('crm.lead', 'lead-1', lead, { b: 2 });
        expect(api.leads.update).toHaveBeenCalledWith('lead-1', { custom_fields: { b: 2 }, version: 1 });
        expect(res.ok).toBe(true);
        expect(res.record?.custom_fields).toEqual({ a: 1, b: 2 });
    });
    test('When a deal saves / Then only the changed keys are PATCHed via dealsApi (backend merges)', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1', custom_fields: { x: 1, y: 2 } });
        await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: { x: 1 } }, { y: 2 });
        expect(api.deals.update).toHaveBeenCalledWith('d1', { custom_fields: { y: 2 } });
    });
    test('When a partner saves / Then it PATCHes via partnersApi', async () => {
        api.partners.update.mockResolvedValue({ id: 'p1', custom_fields: { z: 3 } });
        await saveClassBCustomFields('core.partner', 'p1', null, { z: 3 });
        expect(api.partners.update).toHaveBeenCalledWith('p1', { custom_fields: { z: 3 } });
    });
    test('When the row carries custom_fields_version / Then it is sent as version in the PATCH body', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1', custom_fields: { y: 2 }, custom_fields_version: 5 });
        await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: {}, custom_fields_version: 4, updated_at: 't' }, { y: 2 });
        expect(api.deals.update).toHaveBeenCalledWith('d1', { custom_fields: { y: 2 }, version: 4 });
    });
    test('When an explicit version is passed / Then it wins over the row version', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1', custom_fields: { y: 2 } });
        await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: {}, custom_fields_version: 4 }, { y: 2 }, 7);
        expect(api.deals.update).toHaveBeenCalledWith('d1', { custom_fields: { y: 2 }, version: 7 });
    });
    test('When only updated_at is available / Then no version is sent', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1', custom_fields: { y: 2 } });
        await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: {}, updated_at: '2026-09-30T09:00:00Z' }, { y: 2 });
        expect(api.deals.update).toHaveBeenCalledWith('d1', { custom_fields: { y: 2 } });
    });
    test('When a value is cleared / Then null is sent so the backend deletes the key', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1' });
        const res = await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: { x: 1, y: 2 } }, { y: null });
        expect(api.deals.update).toHaveBeenCalledWith('d1', { custom_fields: { y: null } });
        expect(res.record?.custom_fields).toEqual({ x: 1 });
    });
    test('When the save succeeds / Then the returned record carries the new custom_fields_version', async () => {
        api.deals.update.mockResolvedValue({ id: 'd1', custom_fields: { y: 2 }, custom_fields_version: 9 });
        const res = await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: {}, custom_fields_version: 8 }, { y: 2 });
        expect(res).toMatchObject({ ok: true, record: { custom_fields: { y: 2 }, custom_fields_version: 9 } });
    });
    test('When the backend answers 409 DATASET_VERSION_CONFLICT / Then the result is a conflict, not a thrown error', async () => {
        api.deals.update.mockRejectedValue(httpError(409, { code: 'DATASET_VERSION_CONFLICT', message: 'Record changed' }));
        const res = await saveClassBCustomFields('crm.deal', 'd1', { custom_fields: {}, custom_fields_version: 3 }, { y: 2 });
        expect(res).toMatchObject({ ok: false, conflict: true });
    });
    test('When the backend answers 400 DATASET_FIELD_UNKNOWN / Then its message is returned verbatim', async () => {
        api.deals.update.mockRejectedValue(httpError(400, { code: 'DATASET_FIELD_UNKNOWN', message: 'Unknown custom field "colour"' }));
        const res = await saveClassBCustomFields('crm.deal', 'd1', {}, { colour: 'red' });
        expect(res).toEqual({ ok: false, error: 'Unknown custom field "colour"' });
    });
    test('When a validation error carries a message array / Then the messages are joined', async () => {
        api.deals.update.mockRejectedValue(httpError(400, { code: 'DATASET_FIELD_INVALID', message: ['a is required', 'b too long'] }));
        const res = await saveClassBCustomFields('crm.deal', 'd1', {}, { a: '' });
        expect(res).toEqual({ ok: false, error: 'a is required; b too long' });
    });
    test('When the native API fails / Then the result is not ok with the error message', async () => {
        api.deals.update.mockRejectedValue(new Error('boom'));
        const res = await saveClassBCustomFields('crm.deal', 'd1', {}, { y: 2 });
        expect(res).toEqual({ ok: false, error: 'boom' });
    });
    test('When reading current values / Then leads use class_b_custom_fields and others custom_fields', () => {
        expect(currentClassBValues('crm.lead', { custom_fields: { legacy: 1 } })).toEqual({});
        expect(currentClassBValues('crm.deal', { custom_fields: { a: 1 } })).toEqual({ a: 1 });
        expect(currentClassBValues('core.partner', { custom_fields: [1] })).toEqual({});
    });
    test('When deriving the version / Then custom_fields_version wins over updated_at', () => {
        expect(recordVersion({ custom_fields_version: 3, updated_at: 't' })).toBe(3);
        expect(recordVersion({ updated_at: 't' })).toBe('t');
        expect(recordVersion(null)).toBeNull();
    });
    test('When deriving the wire version / Then only integers (or digit strings) are sent', () => {
        expect(wireVersion(4)).toBe(4);
        expect(wireVersion('4')).toBe(4);
        expect(wireVersion('2026-09-30T09:00:00Z')).toBeUndefined();
        expect(wireVersion(null)).toBeUndefined();
    });
    test('When classifying errors / Then 409 or the conflict code is a version conflict', () => {
        expect(isVersionConflict({ status: 409 })).toBe(true);
        expect(isVersionConflict({ body: { code: 'DATASET_VERSION_CONFLICT' } })).toBe(true);
        expect(isVersionConflict({ status: 400, body: { code: 'DATASET_FIELD_UNKNOWN' } })).toBe(false);
    });
});
