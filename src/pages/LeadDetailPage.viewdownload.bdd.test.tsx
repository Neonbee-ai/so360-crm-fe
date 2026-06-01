import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ── service mocks ────────────────────────────────────────────────────────────
const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();
const mockGetPartners = vi.fn();

vi.mock('../services/crmService', () => ({
    crmService: {
        getLeadById: (...a: any[]) => mockGetLeadById(...a),
        getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
        getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
        getSettings: (...a: any[]) => mockGetSettings(...a),
        getUsers: (...a: any[]) => mockGetUsers(...a),
        getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
        getPartners: (...a: any[]) => mockGetPartners(...a),
        uploadDocument: vi.fn().mockResolvedValue({}),
        deleteDocument: vi.fn().mockResolvedValue(undefined),
        createNote: vi.fn().mockResolvedValue({}),
        deleteNote: vi.fn().mockResolvedValue(undefined),
        updateLead: vi.fn().mockResolvedValue({}),
        deleteLead: vi.fn().mockResolvedValue(undefined),
        getDocumentsByLeadId: vi.fn().mockResolvedValue([]),
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
        formatPhone: (p: string) => p,
    }),
}));

vi.mock('../components/common/Toast', () => ({
    ToastContainer: () => null,
    useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/CreateDealModal', () => ({ default: () => null }));
vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({ LeadJourneyStepper: () => null }));
vi.mock('../components/common/PartnerSearchDropdown', () => ({
    PartnerSearchDropdown: () => null,
}));

import LeadDetailPage from './LeadDetailPage';

// ── fixtures ─────────────────────────────────────────────────────────────────
const DOC_URL = 'https://cdn.example.com/proposal.pdf';

const makeDoc = (overrides: Partial<any> = {}) => ({
    id: 'doc-1',
    name: 'proposal.pdf',
    size: 2097152,
    type: 'application/pdf',
    url: DOC_URL,
    uploaded_at: '2026-06-01T00:00:00Z',
    uploaded_by: { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
});

const makeLead = (docs: any[] = [makeDoc()]) => ({
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

const defaultServiceMocks = (docs: any[] = [makeDoc()]) => {
    mockGetLeadById.mockResolvedValue(makeLead(docs));
    mockGetDealsByLeadId.mockResolvedValue([]);
    mockGetTasksByLeadId.mockResolvedValue([]);
    mockGetSettings.mockResolvedValue({ lead_custom_fields: [], lead_scoring: [], lead_stages: [] });
    mockGetUsers.mockResolvedValue([]);
    mockGetActivitiesByLeadId.mockResolvedValue([]);
    mockGetPartners.mockResolvedValue([]);
};

async function renderAndOpenDocumentsTab() {
    render(<LeadDetailPage />);
    await waitFor(() => expect(screen.queryByText(/Loading lead workspace/i)).not.toBeInTheDocument());
    const docsTab = screen.getByRole('button', { name: /Documents/i });
    await act(async () => { fireEvent.click(docsTab); });
    return docsTab;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('LeadDetailPage — document View & Download actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        defaultServiceMocks();
    });

    describe('Given a lead has uploaded documents', () => {
        it('When the Documents tab is rendered / Then a View link is present for each document', async () => {
            await renderAndOpenDocumentsTab();
            const viewLinks = screen.getAllByTitle('View');
            expect(viewLinks.length).toBe(1);
        });

        it('When the Documents tab is rendered / Then the View link opens the document URL in a new tab', async () => {
            await renderAndOpenDocumentsTab();
            const viewLink = screen.getByTitle('View');
            expect(viewLink.tagName).toBe('A');
            expect(viewLink).toHaveAttribute('href', DOC_URL);
            expect(viewLink).toHaveAttribute('target', '_blank');
            expect(viewLink).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('When the Documents tab is rendered / Then a Download link is present for each document', async () => {
            await renderAndOpenDocumentsTab();
            const downloadLinks = screen.getAllByTitle('Download');
            expect(downloadLinks.length).toBe(1);
        });

        it('When the Documents tab is rendered / Then the Download link uses the document URL', async () => {
            await renderAndOpenDocumentsTab();
            const downloadLink = screen.getByTitle('Download');
            expect(downloadLink.tagName).toBe('A');
            expect(downloadLink).toHaveAttribute('href', DOC_URL);
        });

        it('When the Documents tab is rendered / Then the Download link carries the document filename', async () => {
            await renderAndOpenDocumentsTab();
            const downloadLink = screen.getByTitle('Download');
            expect(downloadLink).toHaveAttribute('download', 'proposal.pdf');
        });

        it('When the Documents tab is rendered / Then the Download link does NOT open a new tab (inline download)', async () => {
            await renderAndOpenDocumentsTab();
            const downloadLink = screen.getByTitle('Download');
            expect(downloadLink).not.toHaveAttribute('target', '_blank');
        });
    });

    describe('Given a lead has multiple uploaded documents', () => {
        it('When the Documents tab is rendered / Then each document has its own View and Download links', async () => {
            const docs = [
                makeDoc({ id: 'doc-1', name: 'contract.pdf', url: 'https://cdn.example.com/contract.pdf' }),
                makeDoc({ id: 'doc-2', name: 'invoice.xlsx', url: 'https://cdn.example.com/invoice.xlsx' }),
            ];
            defaultServiceMocks(docs);
            await renderAndOpenDocumentsTab();

            const viewLinks = screen.getAllByTitle('View');
            const downloadLinks = screen.getAllByTitle('Download');
            expect(viewLinks.length).toBe(2);
            expect(downloadLinks.length).toBe(2);
        });

        it('When the Documents tab is rendered / Then each View link points to its own document URL', async () => {
            const docs = [
                makeDoc({ id: 'doc-1', name: 'a.pdf', url: 'https://cdn.example.com/a.pdf' }),
                makeDoc({ id: 'doc-2', name: 'b.pdf', url: 'https://cdn.example.com/b.pdf' }),
            ];
            defaultServiceMocks(docs);
            await renderAndOpenDocumentsTab();

            const viewLinks = screen.getAllByTitle('View') as HTMLAnchorElement[];
            const hrefs = viewLinks.map(l => l.href);
            expect(hrefs).toContain('https://cdn.example.com/a.pdf');
            expect(hrefs).toContain('https://cdn.example.com/b.pdf');
        });

        it('When the Documents tab is rendered / Then each Download link points to its own document URL', async () => {
            const docs = [
                makeDoc({ id: 'doc-1', name: 'a.pdf', url: 'https://cdn.example.com/a.pdf' }),
                makeDoc({ id: 'doc-2', name: 'b.pdf', url: 'https://cdn.example.com/b.pdf' }),
            ];
            defaultServiceMocks(docs);
            await renderAndOpenDocumentsTab();

            const downloadLinks = screen.getAllByTitle('Download') as HTMLAnchorElement[];
            const hrefs = downloadLinks.map(l => l.href);
            expect(hrefs).toContain('https://cdn.example.com/a.pdf');
            expect(hrefs).toContain('https://cdn.example.com/b.pdf');
        });
    });

    describe('Given a lead has no documents', () => {
        it('When the Documents tab is rendered / Then no View or Download links are shown', async () => {
            defaultServiceMocks([]);
            await renderAndOpenDocumentsTab();

            expect(screen.queryByTitle('View')).not.toBeInTheDocument();
            expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
            expect(screen.getByText(/No documents attached/i)).toBeInTheDocument();
        });
    });
});
