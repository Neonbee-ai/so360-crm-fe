import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Data Layer Class B list columns on the Partners list (core.partner),
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

describe('Feature: Data Layer columns on the Partners list', () => {
    it('Given the flag is off, When the list renders, Then no Class B column appears and no layout is registered', async () => {
        render(<PartnersPage />);
        await waitFor(() => expect(screen.getByTestId('row-p1')).toBeInTheDocument());
        expect(screen.queryByText('Region')).toBeNull();
        expect(screen.queryByText('south')).toBeNull();
        expect(dl.layouts['core.partner']).toBeUndefined();
    });

    it('Given the flag is on, When the list renders, Then visible Class B columns show values from custom_fields', async () => {
        dl.flag = true;
        render(<PartnersPage />);
        await waitFor(() => expect(screen.getByText('south')).toBeInTheDocument());
        expect(screen.getByText('Region')).toBeInTheDocument();
        expect(screen.getByText('Memo')).toBeInTheDocument();
        expect(screen.getByText('m1')).toBeInTheDocument();
        expect(dl.layouts['core.partner']).toBeDefined();
    });

    it('Given a hidden-visibility field, When the flag is on, Then its column is not rendered', async () => {
        dl.flag = true;
        render(<PartnersPage />);
        await waitFor(() => expect(screen.getByText('south')).toBeInTheDocument());
        expect(screen.queryByText('Secret')).toBeNull();
    });

    it('Given an indexed field, When its header is clicked, Then rows sort by the Class B value', async () => {
        dl.flag = true;
        render(<PartnersPage />);
        await waitFor(() => expect(screen.getByText('south')).toBeInTheDocument());
        const header = screen.getByText('Region');
        expect(header.closest('button')).not.toBeNull();
        fireEvent.click(header);
        const north = screen.getByText('north');
        const south = screen.getByText('south');
        expect(north.compareDocumentPosition(south) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('Given a non-indexed field, When the list renders, Then its header is display-only', async () => {
        dl.flag = true;
        render(<PartnersPage />);
        await waitFor(() => expect(screen.getByText('Memo')).toBeInTheDocument());
        expect(screen.getByText('Memo').closest('button')).toBeNull();
    });
});
