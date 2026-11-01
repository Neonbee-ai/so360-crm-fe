import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

const mockGetDealById = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetTasksByDealId = vi.fn();
const mockGetActivitiesByDealId = vi.fn();
const mockGetNotesByDealId = vi.fn();
const mockGetDocumentsByDealId = vi.fn();
const mockGetLeadById = vi.fn();
const mockGetInvoiceStatus = vi.fn();
const mockGetFulfillmentOrderByDeal = vi.fn();
const mockUploadDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockGetDocumentDownloadUrl = vi.fn();

vi.mock('../services/crmService', () => ({
    crmService: {
        getDealById: (...a: any[]) => mockGetDealById(...a),
        getSettings: (...a: any[]) => mockGetSettings(...a),
        getUsers: (...a: any[]) => mockGetUsers(...a),
        getTasksByDealId: (...a: any[]) => mockGetTasksByDealId(...a),
        getActivitiesByDealId: (...a: any[]) => mockGetActivitiesByDealId(...a),
        getNotesByDealId: (...a: any[]) => mockGetNotesByDealId(...a),
        getDocumentsByDealId: (...a: any[]) => mockGetDocumentsByDealId(...a),
        getLeadById: (...a: any[]) => mockGetLeadById(...a),
        getInvoiceStatus: (...a: any[]) => mockGetInvoiceStatus(...a),
        getFulfillmentOrderByDeal: (...a: any[]) => mockGetFulfillmentOrderByDeal(...a),
        uploadDocument: (...a: any[]) => mockUploadDocument(...a),
        deleteDocument: (...a: any[]) => mockDeleteDocument(...a),
        getDocumentDownloadUrl: (...a: any[]) => mockGetDocumentDownloadUrl(...a),
        logActivity: vi.fn().mockResolvedValue({}),
    },
    dealsApi: { update: vi.fn().mockResolvedValue({}) },
    tasksApi: { delete: vi.fn().mockResolvedValue({}) },
    activitiesApi: { update: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) },
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ id: 'deal-1' }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('./components/TaskModal', () => ({ default: () => null }));

const shellCtl = vi.hoisted(() => ({ fulfillment: false }));
vi.mock('@so360/shell-context', () => ({
    useShell: () => ({ isModuleEnabled: (m: string) => m === 'fulfillment' && shellCtl.fulfillment }),
    useActivity: () => ({ recordActivity: async () => {} }),
    useShellBridge: () => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true }),
}));

const mockPublish = vi.fn();
vi.mock('@so360/event-bus', () => ({
    eventBus: { publish: (...a: any[]) => mockPublish(...a), subscribe: () => () => {}, clear: () => {} },
}));

vi.mock('../config/features', () => ({
    FEATURES: { DEAL_INVOICE_REQUEST: true, DEAL_PROJECT_CREATION: true },
}));

vi.mock('../components/DealLifecycleStepper', () => ({
    DealLifecycleStepper: () => null,
}));

vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `$${v}`,
        formatDate: (d: string) => d,
        formatDateTime: (d: string) => d,
        formatPhone: (p: string) => p,
        formatNumber: (n: number) => String(n),
        formatPercent: (n: number) => `${n}%`,
    }),
    useCRMCurrencySymbol: () => '$',
}));

import DealDetailPage from './DealDetailPage';

const owner = { id: 'u1', full_name: 'Test Owner', email: 'owner@test.com', avatar_url: null };

const makeDmsDoc = (overrides: any = {}) => ({
    id: 'doc-dms-1',
    name: 'dms-deal.pdf',
    size: 4096,
    type: 'application/pdf',
    url: '',
    dmsDocumentId: 'dms-deal-abc',
    created_at: '2025-01-15T10:00:00Z',
    uploaded_at: '2025-01-15T10:00:00Z',
    uploaded_by: owner,
    ...overrides,
});

const makeDeal = (docs: any[]) => ({
    id: 'deal-1',
    name: 'Big Deal',
    company_name: 'Acme Corp',
    value: 50000,
    expected_close_date: '2025-06-30',
    stage: 'Qualified',
    stage_id: 'qualified',
    current_flow_state: 'qualified',
    status: 'active',
    owner,
    owner_id: 'u1',
    lead_id: 'lead-1',
    project_id: null,
    invoice_id: null,
    invoice_number: null,
    notes: [],
    activities: [],
    documents: docs,
    custom_fields: {},
    created_at: '2025-01-01T10:00:00Z',
    last_activity_at: '2025-01-20T10:00:00Z',
});

const settings = {
    deal_stages: [{ id: 'qualified', name: 'Qualified' }],
    lead_stages: [], lead_custom_fields: [], deal_custom_fields: [],
    lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
};

const setup = (docs: any[]) => {
    mockGetDealById.mockResolvedValue(makeDeal(docs));
    mockGetSettings.mockResolvedValue(settings);
    mockGetUsers.mockResolvedValue([owner]);
    mockGetTasksByDealId.mockResolvedValue([]);
    mockGetActivitiesByDealId.mockResolvedValue([]);
    mockGetNotesByDealId.mockResolvedValue([]);
    mockGetDocumentsByDealId.mockResolvedValue(docs);
    mockGetLeadById.mockResolvedValue({ id: 'lead-1', contact_name: 'John', company_name: 'Acme' });
    mockGetInvoiceStatus.mockRejectedValue(new Error('no invoice'));
    mockGetFulfillmentOrderByDeal.mockResolvedValue({ id: 'fo-1', status: 'processing' });
};

async function renderAndOpenDocsTab() {
    render(<DealDetailPage />);
    await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
    const docsTab = screen.getByRole('tab', { name: /Docs/i });
    await act(async () => { fireEvent.click(docsTab); });
}


describe('DealDetailPage — fulfillment module gating', () => {
    beforeEach(() => { vi.clearAllMocks(); setup([]); });

    it('Given the org lacks the fulfillment module (Starter) / When the deal page loads / Then it never calls the fulfillment API', async () => {
        shellCtl.fulfillment = false;
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
        expect(mockGetFulfillmentOrderByDeal).not.toHaveBeenCalled();
        expect(screen.queryByText('Fulfillment Tracking')).not.toBeInTheDocument();
    });

    it('Given the org has the fulfillment module / When the deal page loads / Then it fetches the order for the deal', async () => {
        shellCtl.fulfillment = true;
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
        await waitFor(() => expect(mockGetFulfillmentOrderByDeal).toHaveBeenCalledWith('deal-1'));
    });

    it('Given the module is enabled but the API is denied (403) / When the page loads / Then the panel is hidden and the page still renders', async () => {
        shellCtl.fulfillment = true;
        mockGetFulfillmentOrderByDeal.mockRejectedValue(new Error('403'));
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
        await waitFor(() => expect(mockGetFulfillmentOrderByDeal).toHaveBeenCalled());
        expect(screen.queryByText('Fulfillment Tracking')).not.toBeInTheDocument();
    });
});
