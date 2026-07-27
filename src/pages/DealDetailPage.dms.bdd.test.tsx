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

vi.mock('../components/common/Toast', () => ({
    ToastContainer: () => null,
    useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/TaskModal', () => ({ default: () => null }));

vi.mock('@so360/shell-context', () => ({
    useShell: () => ({ isModuleEnabled: () => false }),
    useActivity: () => ({ recordActivity: async () => {} }),
    useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true }),
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
    mockGetFulfillmentOrderByDeal.mockRejectedValue(new Error('none'));
};

async function renderAndOpenDocsTab() {
    render(<DealDetailPage />);
    await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
    const docsTab = screen.getByRole('button', { name: /Docs/i });
    await act(async () => { fireEvent.click(docsTab); });
}

describe('DealDetailPage — DMS-backed documents', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocumentDownloadUrl.mockResolvedValue('https://signed.example.com/deal-doc');
        openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        openSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    describe('Given a deal has a DMS-backed document', () => {
        beforeEach(() => setup([makeDmsDoc()]));

        it('When rendered / Then the Download action is a button (not an anchor) for DMS docs', async () => {
            await renderAndOpenDocsTab();
            expect(screen.getByTitle('Download').tagName).toBe('BUTTON');
        });

        it('When the Download button is clicked / Then it resolves the url and opens it', async () => {
            await renderAndOpenDocsTab();
            await act(async () => { fireEvent.click(screen.getByTitle('Download')); });
            await waitFor(() => expect(mockGetDocumentDownloadUrl).toHaveBeenCalledWith('doc-dms-1'));
            await waitFor(() =>
                expect(openSpy).toHaveBeenCalledWith('https://signed.example.com/deal-doc', '_blank', 'noopener,noreferrer')
            );
        });
    });

    describe('Given a legacy document (no dmsDocumentId)', () => {
        beforeEach(() => setup([makeDmsDoc({ id: 'legacy-1', dmsDocumentId: undefined, url: '/files/legacy.pdf' })]));

        it('When rendered / Then the Download action remains an anchor to the stored url', async () => {
            await renderAndOpenDocsTab();
            const dl = screen.getByTitle('Download');
            expect(dl.tagName).toBe('A');
            expect(dl).toHaveAttribute('href', '/files/legacy.pdf');
            expect(mockGetDocumentDownloadUrl).not.toHaveBeenCalled();
        });
    });

    describe('Given a successful upload', () => {
        beforeEach(() => {
            setup([]);
            mockUploadDocument.mockResolvedValue(makeDmsDoc({ id: 'doc-new' }));
        });

        it('When a file is uploaded / Then documents:changed is published for the deal', async () => {
            await renderAndOpenDocsTab();
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'new.pdf', { type: 'application/pdf' })] } });
            });
            await waitFor(() => expect(mockUploadDocument).toHaveBeenCalled());
            expect(mockPublish).toHaveBeenCalledWith('documents:changed', {
                source: 'crm', entity_type: 'crm:deal', entity_id: 'deal-1',
            });
        });
    });

    describe('Given a document is deleted', () => {
        beforeEach(() => {
            setup([makeDmsDoc()]);
            mockDeleteDocument.mockResolvedValue(undefined);
            vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
        });

        it('When the Delete button is confirmed / Then documents:changed is published for the deal', async () => {
            await renderAndOpenDocsTab();
            // Delete is the second action button in the doc row (no title); locate via the trash button's sibling.
            const downloadBtn = screen.getByTitle('Download');
            const deleteBtn = downloadBtn.parentElement!.querySelectorAll('button')[
                downloadBtn.tagName === 'BUTTON' ? 1 : 0
            ];
            await act(async () => { fireEvent.click(deleteBtn); });
            await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('deal-1', 'doc-dms-1'));
            expect(mockPublish).toHaveBeenCalledWith('documents:changed', {
                source: 'crm', entity_type: 'crm:deal', entity_id: 'deal-1',
            });
        });
    });
});
