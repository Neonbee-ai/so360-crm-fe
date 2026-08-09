import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ── service mocks ────────────────────────────────────────────────────────────
const mockUploadDocument = vi.fn();
const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();
const mockGetActivitiesByLeadIdPaginated = vi.fn();
const mockGetPartners = vi.fn();
const mockGetDocumentsByLeadId = vi.fn();

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
        uploadDocument: (...a: any[]) => mockUploadDocument(...a),
        deleteDocument: vi.fn().mockResolvedValue(undefined),
        createNote: vi.fn().mockResolvedValue({}),
        deleteNote: vi.fn().mockResolvedValue(undefined),
        updateLead: vi.fn().mockResolvedValue({}),
        deleteLead: vi.fn().mockResolvedValue(undefined),
        getDocumentsByLeadId: (...a: any[]) => mockGetDocumentsByLeadId(...a),
        gridColumns: {
            get: () => Promise.resolve(null),
            save: () => Promise.resolve({}),
            reset: () => Promise.resolve({}),
        },
        getLeadScoringResult: vi.fn().mockResolvedValue(null),
    },
    activitiesApi: {
        create: vi.fn().mockResolvedValue({}),
    },
    settingsApi: {
        sourceTypes: { getAll: vi.fn().mockResolvedValue([]) },
    },
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

vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `$${v}`,
        formatDate: (d: string) => d,
        formatDateTime: (d: string) => d,
        formatPhone: (p: string) => p,
    }),
    useCRMCurrencySymbol: () => '$',
}));

const mockShowError = vi.hoisted(() => vi.fn());
vi.mock('@so360/design-system', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@so360/design-system')>();
    return {
        ...actual,
        toast: { ...actual.toast, error: mockShowError },
    };
});

vi.mock('./components/CreateDealModal', () => ({ default: () => null }));
vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({ LeadJourneyStepper: () => null }));
vi.mock('../components/common/PartnerSearchDropdown', () => ({
    PartnerSearchDropdown: () => null,
}));

import LeadDetailPage from './LeadDetailPage';

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeLead = (docs: any[] = []) => ({
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

const makeAttachment = () => ({
    id: 'doc-new',
    name: 'proposal.pdf',
    size: 2048,
    type: 'application/pdf',
    url: 'https://cdn.example.com/proposal.pdf',
    uploaded_at: '2026-06-01T00:00:00Z',
    uploaded_by: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
    created_at: '2026-06-01T00:00:00Z',
});

const defaultServiceMocks = () => {
    mockGetLeadById.mockResolvedValue(makeLead());
    mockGetDocumentsByLeadId.mockResolvedValue([]);
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
    // Wait for the lead to load (loading spinner disappears)
    await waitFor(() => expect(screen.queryByText(/Loading lead workspace/i)).not.toBeInTheDocument());
    // Click the Documents tab
    const docsTab = screen.getByRole('button', { name: /Documents/i });
    await act(async () => { fireEvent.click(docsTab); });
    return docsTab;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('LeadDetailPage — document upload handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        defaultServiceMocks();
        mockShowError.mockReset();
    });

    describe('Given the Documents tab is active and the user selects a file', () => {
        it('When the upload succeeds / Then the new document appears in the list', async () => {
            mockUploadDocument.mockResolvedValue(makeAttachment());
            await renderAndOpenDocumentsTab();

            expect(screen.getByText(/No documents attached/i)).toBeInTheDocument();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['pdf content'], 'proposal.pdf', { type: 'application/pdf' });
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [file] } });
            });

            await waitFor(() => expect(screen.getByText('proposal.pdf')).toBeInTheDocument());
            expect(screen.queryByText(/No documents attached/i)).not.toBeInTheDocument();
        });

        it('When the upload succeeds / Then the Upload Document button returns to idle state', async () => {
            mockUploadDocument.mockResolvedValue(makeAttachment());
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [file] } });
            });

            await waitFor(() => expect(screen.queryByText(/Uploading/i)).not.toBeInTheDocument());
            expect(screen.getByText(/Upload Document/i)).toBeInTheDocument();
        });

        it('When the upload succeeds / Then no error toast is shown', async () => {
            mockUploadDocument.mockResolvedValue(makeAttachment());
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'x.pdf')] } });
            });

            await waitFor(() => expect(mockUploadDocument).toHaveBeenCalled());
            expect(mockShowError).not.toHaveBeenCalled();
        });
    });

    describe('Given the upload API rejects', () => {
        it('When uploadDocument throws / Then showError is called with the error message', async () => {
            mockUploadDocument.mockRejectedValue(new Error('Tenant not found'));
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'fail.pdf')] } });
            });

            await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Tenant not found'));
        });

        it('When uploadDocument throws a non-Error / Then showError shows generic message', async () => {
            mockUploadDocument.mockRejectedValue('unexpected');
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'fail.pdf')] } });
            });

            await waitFor(() =>
                expect(mockShowError).toHaveBeenCalledWith('Upload failed. Please try again.')
            );
        });

        it('When uploadDocument throws / Then the upload button returns to idle state', async () => {
            mockUploadDocument.mockRejectedValue(new Error('Server error'));
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'fail.pdf')] } });
            });

            await waitFor(() => expect(screen.queryByText(/Uploading/i)).not.toBeInTheDocument());
            expect(screen.getByText(/Upload Document/i)).toBeInTheDocument();
        });

        it('When uploadDocument throws / Then the document list remains empty', async () => {
            mockUploadDocument.mockRejectedValue(new Error('Server error'));
            await renderAndOpenDocumentsTab();

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [new File(['x'], 'fail.pdf')] } });
            });

            await waitFor(() => expect(mockShowError).toHaveBeenCalled());
            expect(screen.getByText(/No documents attached/i)).toBeInTheDocument();
        });
    });
});
