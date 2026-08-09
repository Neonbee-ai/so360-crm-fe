import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ── service mocks ────────────────────────────────────────────────────────────
const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();
const mockGetActivitiesByLeadIdPaginated = vi.fn();
const mockGetPartners = vi.fn();
const mockGetDocumentsByLeadId = vi.fn();
const mockUploadDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockGetDocumentDownloadUrl = vi.fn();

vi.mock('../services/crmService', () => ({
    crmService: {
        getLeadById: (...a: any[]) => mockGetLeadById(...a),
        getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
        getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
        getSettings: (...a: any[]) => mockGetSettings(...a),
        getUsers: (...a: any[]) => mockGetUsers(...a),
        getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
        getActivitiesByLeadIdPaginated: (...a: any[]) => mockGetActivitiesByLeadIdPaginated(...a),
        getPartners: (...a: any[]) => mockGetPartners(...a),
        getDocumentsByLeadId: (...a: any[]) => mockGetDocumentsByLeadId(...a),
        gridColumns: {
            get: () => Promise.resolve(null),
            save: () => Promise.resolve({}),
            reset: () => Promise.resolve({}),
        },
        uploadDocument: (...a: any[]) => mockUploadDocument(...a),
        deleteDocument: (...a: any[]) => mockDeleteDocument(...a),
        getDocumentDownloadUrl: (...a: any[]) => mockGetDocumentDownloadUrl(...a),
        createNote: vi.fn().mockResolvedValue({}),
        deleteNote: vi.fn().mockResolvedValue(undefined),
        updateLead: vi.fn().mockResolvedValue({}),
        deleteLead: vi.fn().mockResolvedValue(undefined),
        getLeadScoringResult: vi.fn().mockResolvedValue(null),
    },
    activitiesApi: { create: vi.fn().mockResolvedValue({}) },
    settingsApi: { sourceTypes: { getAll: vi.fn().mockResolvedValue([]) } },
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ id: 'lead-test-id' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null, pathname: '/crm/leads/lead-test-id' }),
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
    useShell: () => ({
        user: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
        tenant: { id: 'tenant-1' },
        org: { id: 'org-1', name: 'Test Org' },
        isModuleEnabled: () => false,
    }),
    useCurrentEntity: () => ({ setCurrentEntity: vi.fn() }),
    useActivity: () => ({ recordActivity: vi.fn() }),
    useShellBridge: vi.fn(() => ({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        isFeatureHidden: () => false,
    })),
    useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
    useQuota: () => ({
        quotas: [], isLoading: false, error: null,
        isExceeded: () => false, getQuota: () => null,
        getPercentage: () => 0, refresh: async () => {},
    }),
    QuotaGate: ({ children }: any) => <>{children}</>,
}));

// Shared event bus — exercise publish() directly so we can assert cross-MFE notify
const mockPublish = vi.fn();
vi.mock('@so360/event-bus', () => ({
    eventBus: { publish: (...a: any[]) => mockPublish(...a), subscribe: () => () => {}, clear: () => {} },
}));

vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `$${v}`,
        formatDate: (d: string) => d,
        formatDateTime: (d: string) => d,
        formatPhone: (p: string) => p,
    }),
    useCRMCurrencySymbol: () => '$',
}));

vi.mock('./components/CreateDealModal', () => ({ default: () => null }));
vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({ LeadJourneyStepper: () => null }));
vi.mock('../components/common/PartnerSearchDropdown', () => ({ PartnerSearchDropdown: () => null }));

import LeadDetailPage from './LeadDetailPage';

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeDmsDoc = (overrides: Partial<any> = {}) => ({
    id: 'doc-dms-1',
    name: 'dms-contract.pdf',
    size: 4096,
    type: 'application/pdf',
    url: '', // DMS docs have no direct url
    dmsDocumentId: 'dms-abc',
    uploaded_at: '2026-06-01T00:00:00Z',
    uploaded_by: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
});

const makeLead = (docs: any[]) => ({
    id: 'lead-test-id',
    company_name: 'Acme Corp',
    contact_name: 'John Doe',
    email: 'john@acme.com',
    phone: '+1234567890',
    status: 'New',
    backend_status: 'new',
    value: 5000,
    source: 'Website',
    notes: [],
    documents: docs,
    deals: [],
    tasks: [],
    activities: [],
    custom_fields: {},
    contact_email: 'john@acme.com',
    owner: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
    creator: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
});

const defaultServiceMocks = (docs: any[]) => {
    mockGetLeadById.mockResolvedValue(makeLead(docs));
    mockGetDocumentsByLeadId.mockResolvedValue(docs);
    mockGetDealsByLeadId.mockResolvedValue([]);
    mockGetTasksByLeadId.mockResolvedValue([]);
    mockGetSettings.mockResolvedValue({ lead_custom_fields: [], lead_scoring: [], lead_stages: [] });
    mockGetUsers.mockResolvedValue([]);
    mockGetActivitiesByLeadId.mockResolvedValue([]);
    mockGetActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
    mockGetPartners.mockResolvedValue([]);
};

async function renderAndOpenDocumentsTab() {
    render(<LeadDetailPage />);
    await waitFor(() => expect(screen.queryByText(/Loading lead workspace/i)).not.toBeInTheDocument());
    const docsTab = screen.getByRole('button', { name: /Documents/i });
    await act(async () => { fireEvent.click(docsTab); });
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('LeadDetailPage — DMS-backed documents', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocumentDownloadUrl.mockResolvedValue('https://signed.example.com/lead-doc');
        openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        openSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    describe('Given a lead has a DMS-backed document', () => {
        beforeEach(() => defaultServiceMocks([makeDmsDoc()]));

        it('When rendered / Then the View action is a button (not an anchor) for DMS docs', async () => {
            await renderAndOpenDocumentsTab();
            expect(screen.getByTitle('View').tagName).toBe('BUTTON');
        });

        it('When the View button is clicked / Then it resolves the download url via getDocumentDownloadUrl', async () => {
            await renderAndOpenDocumentsTab();
            await act(async () => { fireEvent.click(screen.getByTitle('View')); });
            await waitFor(() => expect(mockGetDocumentDownloadUrl).toHaveBeenCalledWith('doc-dms-1'));
        });

        it('When the View button is clicked / Then window.open is called with the resolved url', async () => {
            await renderAndOpenDocumentsTab();
            await act(async () => { fireEvent.click(screen.getByTitle('View')); });
            await waitFor(() =>
                expect(openSpy).toHaveBeenCalledWith('https://signed.example.com/lead-doc', '_blank', 'noopener,noreferrer')
            );
        });

        it('When the Download button is clicked / Then it fetches the resolved DMS url', async () => {
            const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
            // @ts-ignore
            const origCreate = URL.createObjectURL; const origRevoke = URL.revokeObjectURL;
            URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
            URL.revokeObjectURL = vi.fn();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) }));

            await renderAndOpenDocumentsTab();
            await act(async () => { fireEvent.click(screen.getByTitle('Download')); });

            await waitFor(() => expect(mockGetDocumentDownloadUrl).toHaveBeenCalledWith('doc-dms-1'));
            await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('https://signed.example.com/lead-doc'));

            // @ts-ignore
            URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke;
        });
    });

    describe('Given a legacy document (no dmsDocumentId)', () => {
        beforeEach(() => defaultServiceMocks([makeDmsDoc({ id: 'legacy-1', dmsDocumentId: undefined, url: 'https://cdn.example.com/legacy.pdf' })]));

        it('When rendered / Then the View action remains an anchor to the stored url', async () => {
            await renderAndOpenDocumentsTab();
            const view = screen.getByTitle('View');
            expect(view.tagName).toBe('A');
            expect(view).toHaveAttribute('href', 'https://cdn.example.com/legacy.pdf');
        });

        it('When the View anchor is used / Then getDocumentDownloadUrl is NOT called', async () => {
            await renderAndOpenDocumentsTab();
            expect(mockGetDocumentDownloadUrl).not.toHaveBeenCalled();
        });
    });

    describe('Given a successful upload', () => {
        beforeEach(() => {
            defaultServiceMocks([]);
            mockUploadDocument.mockResolvedValue(makeDmsDoc({ id: 'doc-new' }));
        });

        it('When a file is uploaded / Then documents:changed is published for the lead', async () => {
            await renderAndOpenDocumentsTab();
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'new.pdf', { type: 'application/pdf' })] } });
            });
            await waitFor(() => expect(mockUploadDocument).toHaveBeenCalled());
            expect(mockPublish).toHaveBeenCalledWith('documents:changed', {
                source: 'crm', entity_type: 'crm:lead', entity_id: 'lead-test-id',
            });
        });
    });

    describe('Given a document is deleted', () => {
        beforeEach(() => {
            defaultServiceMocks([makeDmsDoc()]);
            mockDeleteDocument.mockResolvedValue(undefined);
            vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
        });

        it('When the Delete button is confirmed / Then documents:changed is published for the lead', async () => {
            await renderAndOpenDocumentsTab();
            await act(async () => { fireEvent.click(screen.getByTitle('Delete')); });
            await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('lead-test-id', 'doc-dms-1'));
            expect(mockPublish).toHaveBeenCalledWith('documents:changed', {
                source: 'crm', entity_type: 'crm:lead', entity_id: 'lead-test-id',
            });
        });
    });
});
