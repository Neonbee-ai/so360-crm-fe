import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Sort edge cases for Data Layer Class B list columns on the Partners list (core.partner),
 * behind submodule:data_layer:custom_fields. Indexed fields are sortable;
 * non-indexed fields are display-only.
 */

const dl = vi.hoisted(() => ({
    flag: false,
    isAdmin: false,
    fields: [] as any[],
    layouts: {} as Record<string, any>,
}));

const mockPartnersGetAll = vi.fn();
const mockPartnerTypesGetAll = vi.fn();

vi.mock('../services/crmService', () => ({
    partnersApi: { getAll: (...a: any[]) => mockPartnersGetAll(...a), create: vi.fn() },
    settingsApi: {
        customFields: { getAll: vi.fn().mockResolvedValue([]) },
        partnerTypes: { getAll: (...a: any[]) => mockPartnerTypesGetAll(...a) },
    },
    crmService: { getUsers: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        effectiveFlagsLoaded: true,
        isAdmin: dl.isAdmin,
        isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    }),
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
    useDatasetSchema: (code: string | null) => ({ fields: code === 'core.partner' ? dl.fields : [] }),
    useSlotRenderers: () => [],
    registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
    getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

vi.mock('@so360/formatters', () => ({
    useFormatters: () => ({ formatCurrency: (v: number) => `$${v}` }),
}));

vi.mock('../utils/phoneValidation', () => ({ validatePhone: () => null }));

// Table stub renders headers + cells from the real column definitions.
vi.mock('../components/common/Table', () => ({
    Table: (props: any) => (
        <div data-testid="table">
            <div data-testid="headers">
                {props.columns.map((c: any, i: number) => <div key={i} data-testid={`h-${i}`}>{c.header}</div>)}
            </div>
            {props.data.map((p: any) => (
                <div key={p.id} data-testid={`row-${p.id}`}>
                    {props.columns.map((c: any, i: number) => <div key={i}>{c.accessor(p)}</div>)}
                </div>
            ))}
        </div>
    ),
}));

import PartnersPage from './PartnersPage';
import { listViewStorageKey } from '../hooks/useListViewState';

const FIELDS = [
    { field_key: 'region', label: 'Region', field_type: 'text', indexed: true, sort_order: 1 },
    { field_key: 'memo', label: 'Memo', field_type: 'text', indexed: false, sort_order: 2 },
    { field_key: 'secret', label: 'Secret', field_type: 'text', visibility_profile: 'hidden', sort_order: 3 },
];

const PARTNERS = [
    { id: 'p1', contact_name: 'Alpha Agency', partner_type: 'referral', custom_fields: { region: 'south', memo: 'm1', secret: 'x' } },
    { id: 'p2', contact_name: 'Beta Corp', partner_type: 'referral', custom_fields: { region: 'north' } },
];

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    dl.flag = false;
    dl.isAdmin = false;
    dl.fields = FIELDS;
    dl.layouts = {};
    mockPartnersGetAll.mockResolvedValue(PARTNERS);
    mockPartnerTypesGetAll.mockResolvedValue([{ value: 'referral', label: 'Referral' }]);
});


const rowOrder = () => screen.getAllByTestId(/^row-/).map((el) => el.getAttribute('data-testid'));

describe('Feature: Sorting the Partners list with Class B columns', () => {
    describe('Scenario: a persisted sort field that is neither native nor a Class B column', () => {
        it('then the rows keep the order returned by the API', async () => {
            // Given the tab remembered a sort on a field the comparator does not know
            dl.flag = true;
            sessionStorage.setItem(listViewStorageKey('partners.sortField'), JSON.stringify('company_name'));
            sessionStorage.setItem(listViewStorageKey('partners.sortDirection'), JSON.stringify('asc'));
            mockPartnersGetAll.mockResolvedValue([
                { id: 'pz', contact_name: 'Zeta Traders', partner_type: 'referral', company_name: 'B', custom_fields: {} },
                { id: 'pa', contact_name: 'Alpha Agency', partner_type: 'referral', company_name: 'A', custom_fields: {} },
            ]);
            // When the list renders
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('row-pa')).toBeInTheDocument());
            // Then the unknown sort is a no-op (not a contact_name or company_name sort)
            expect(rowOrder()).toEqual(['row-pz', 'row-pa']);
        });
    });

    describe('Scenario: an indexed Class B column holding numbers and text', () => {
        beforeEach(() => {
            dl.flag = true;
            dl.fields = [{ field_key: 'units', label: 'Units', field_type: 'number', indexed: true, sort_order: 1 }];
            mockPartnersGetAll.mockResolvedValue([
                { id: 'p10', contact_name: 'Alpha', partner_type: 'referral', custom_fields: { units: 10 } },
                { id: 'pmany', contact_name: 'Beta', partner_type: 'referral', custom_fields: { units: 'many' } },
                { id: 'p9', contact_name: 'Gamma', partner_type: 'referral', custom_fields: { units: 9 } },
            ]);
        });

        it('then ascending compares two numbers numerically and anything else as display text', async () => {
            // Given the list is loaded
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByText('many')).toBeInTheDocument());
            // When the Units header is clicked once (ascending)
            fireEvent.click(screen.getByText('Units'));
            // Then 9 sorts before 10 numerically, and text sorts after both
            await waitFor(() => expect(rowOrder()).toEqual(['row-p9', 'row-p10', 'row-pmany']));
        });

        it('then descending reverses that order', async () => {
            // Given the list is loaded
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByText('many')).toBeInTheDocument());
            // When the Units header is clicked twice (descending)
            fireEvent.click(screen.getByText('Units'));
            fireEvent.click(screen.getByText('Units'));
            // Then the order is reversed
            await waitFor(() => expect(rowOrder()).toEqual(['row-pmany', 'row-p10', 'row-p9']));
        });
    });
});
