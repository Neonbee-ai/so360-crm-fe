import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Data Layer Class B on Add Partner (core.partner, create.section slot),
 * behind submodule:data_layer:custom_fields. Save path: Class B values ride the
 * native POST /partners payload as `custom_fields`; legacy settings-defined
 * fields stay in `meta_data`.
 */

const dl = vi.hoisted(() => ({
    flag: false,
    regs: [] as any[],
    fields: [] as any[],
    layouts: {} as Record<string, any>,
}));

function ProbeSection(props: any) {
    return (
        <div data-testid={`section-${props.registration.id}`} data-entity={props.datasetCode} data-mode={props.mode} data-save-mode={props.saveMode}>
            <button type="button" onClick={() => props.onValuesChange({ ...props.values, region: 'south' })}>fill-region</button>
        </div>
    );
}

const mockPartnerCreate = vi.fn();

vi.mock('../services/crmService', () => ({
    partnersApi: { getAll: vi.fn().mockResolvedValue([]), create: (...a: any[]) => mockPartnerCreate(...a) },
    settingsApi: {
        customFields: { getAll: vi.fn().mockResolvedValue([]) },
        partnerTypes: { getAll: vi.fn().mockResolvedValue([{ value: 'referral', label: 'Referral' }]) },
    },
    crmService: { getUsers: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        effectiveFlagsLoaded: true,
        isAdmin: false,
        isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    }),
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
    useDatasetSchema: () => ({ fields: dl.fields }),
    useSlotRenderers: (code: string, slot: string) =>
        dl.regs
            .filter((r: any) => r.dataset_code === code && r.slot === slot)
            .map((r: any) => ({ registration: r, Renderer: ProbeSection, key: r.id })),
    registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
    getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

vi.mock('@so360/formatters', () => ({
    useFormatters: () => ({ formatCurrency: (v: number) => `$${v}` }),
}));

vi.mock('../utils/phoneValidation', () => ({ validatePhone: () => null }));

vi.mock('../components/common/Table', () => ({ Table: () => <div data-testid="table" /> }));

import PartnersPage from './PartnersPage';

const SECTION = { id: 'cs1', dataset_code: 'core.partner', slot: 'create.section', renderer: 'custom_fields' };

const openModal = async () => {
    render(<PartnersPage />);
    fireEvent.click(await screen.findByRole('button', { name: /add partner/i }));
    await waitFor(() => expect(document.getElementById('create-partner-form')).not.toBeNull());
};

const fillNative = async () => {
    fireEvent.change(screen.getByPlaceholderText('Dhanooj'), { target: { value: 'Dhanooj' } });
    fireEvent.change(screen.getByPlaceholderText('B S'), { target: { value: 'Kumar' } });
    const typeSelect = document.querySelector('#create-partner-form select[required]') as HTMLSelectElement;
    await waitFor(() => expect(typeSelect.querySelector('option[value="referral"]')).not.toBeNull());
    fireEvent.change(typeSelect, { target: { value: 'referral' } });
};

const submit = () => fireEvent.submit(document.getElementById('create-partner-form')!);

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    dl.flag = false;
    dl.regs = [SECTION];
    dl.fields = [{ field_key: 'region', label: 'Region', field_type: 'text', required: false }];
    dl.layouts = {};
    mockPartnerCreate.mockResolvedValue({ id: 'p-new' });
});

describe('Feature: Class B custom fields on Add Partner', () => {
    it('Given the flag is off / When a partner is created / Then no section renders and custom_fields is not sent', async () => {
        await openModal();
        expect(screen.queryByTestId('section-cs1')).toBeNull();
        await fillNative();
        submit();
        await waitFor(() => expect(mockPartnerCreate).toHaveBeenCalled());
        expect('custom_fields' in mockPartnerCreate.mock.calls[0][0]).toBe(false);
    });

    it('Given the flag is on / When the modal opens / Then the create.section renders for core.partner in create mode with native save', async () => {
        dl.flag = true;
        await openModal();
        const section = await screen.findByTestId('section-cs1');
        expect(section.getAttribute('data-entity')).toBe('core.partner');
        expect(section.getAttribute('data-mode')).toBe('create');
        expect(section.getAttribute('data-save-mode')).toBe('native');
    });

    it('Given Class B values were entered / When the partner is created / Then they are sent as custom_fields in the native create payload', async () => {
        dl.flag = true;
        await openModal();
        await fillNative();
        fireEvent.click(await screen.findByText('fill-region'));
        submit();
        await waitFor(() => expect(mockPartnerCreate).toHaveBeenCalled());
        const payload = mockPartnerCreate.mock.calls[0][0];
        expect(payload.custom_fields).toEqual({ region: 'south' });
        expect(payload.meta_data).toBeUndefined();
    });

    it('Given a required Class B field is empty / When the partner is submitted / Then the create is blocked with a message naming the field', async () => {
        dl.flag = true;
        dl.fields = [{ field_key: 'region', label: 'Region', field_type: 'text', required: true }];
        await openModal();
        await fillNative();
        submit();
        expect(await screen.findByText('Please fill in: Region')).toBeTruthy();
        expect(mockPartnerCreate).not.toHaveBeenCalled();
    });

    it('Given a hidden create.section registration / When the flag is on / Then it is not rendered', async () => {
        dl.flag = true;
        dl.regs = [{ ...SECTION, visibility_profile: 'hidden' }];
        await openModal();
        expect(screen.queryByTestId('section-cs1')).toBeNull();
    });
});
