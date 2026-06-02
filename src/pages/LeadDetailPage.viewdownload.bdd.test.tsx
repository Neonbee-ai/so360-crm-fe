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
        getPartners: (...a: any[]) => mockGetPartners(...a),
        getDocumentsByLeadId: (...a: any[]) => mockGetDocumentsByLeadId(...a),
        uploadDocument: vi.fn().mockResolvedValue({}),
        deleteDocument: vi.fn().mockResolvedValue(undefined),
        createNote: vi.fn().mockResolvedValue({}),
        deleteNote: vi.fn().mockResolvedValue(undefined),
        updateLead: vi.fn().mockResolvedValue({}),
        deleteLead: vi.fn().mockResolvedValue(undefined),
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
    mockGetDocumentsByLeadId.mockResolvedValue(docs);
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

        it('When the Documents tab is rendered / Then a Download button is present for each document', async () => {
            await renderAndOpenDocumentsTab();
            const downloadBtns = screen.getAllByTitle('Download');
            expect(downloadBtns.length).toBe(1);
        });

        it('When the Documents tab is rendered / Then the Download action is a button (not an anchor)', async () => {
            await renderAndOpenDocumentsTab();
            const downloadBtn = screen.getByTitle('Download');
            expect(downloadBtn.tagName).toBe('BUTTON');
        });

        // Download interaction tests: spies are localised to this nested describe
        // so they never leak into the multi-doc or persistence tests below.
        describe('Download button click behaviour', () => {
            // Save the real createElement BEFORE any spy can wrap it, so the
            // mock can delegate non-'a' tags without infinite recursion.
            let origCreateElement: typeof document.createElement;

            beforeEach(() => {
                origCreateElement = document.createElement.bind(document);
            });

            afterEach(() => {
                vi.restoreAllMocks();
                vi.unstubAllGlobals();
            });

            it('When the Download button is clicked / Then fetch is called with the document URL', async () => {
                const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
                vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) }));
                vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
                vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
                const mockAnchor = { href: '', download: '', click: vi.fn() };
                vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) =>
                    tag === 'a' ? (mockAnchor as any) : origCreateElement(tag, opts)
                );

                await renderAndOpenDocumentsTab();
                const downloadBtn = screen.getByTitle('Download');
                await act(async () => { fireEvent.click(downloadBtn); });

                await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(DOC_URL));
            });

            it('When the Download button is clicked / Then the anchor download attribute is set to the filename', async () => {
                const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
                vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) }));
                vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
                vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
                const mockAnchor = { href: '', download: '', click: vi.fn() };
                vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) =>
                    tag === 'a' ? (mockAnchor as any) : origCreateElement(tag, opts)
                );

                await renderAndOpenDocumentsTab();
                const downloadBtn = screen.getByTitle('Download');
                await act(async () => { fireEvent.click(downloadBtn); });

                await waitFor(() => expect(mockAnchor.click).toHaveBeenCalled());
                expect(mockAnchor.download).toBe('proposal.pdf');
            });

            it('When the Download button is clicked / Then the blob URL is revoked after download', async () => {
                const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
                vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(mockBlob) }));
                const blobUrl = 'blob:mock-revoke-test';
                vi.spyOn(URL, 'createObjectURL').mockReturnValue(blobUrl);
                const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
                const mockAnchor = { href: '', download: '', click: vi.fn() };
                vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) =>
                    tag === 'a' ? (mockAnchor as any) : origCreateElement(tag, opts)
                );

                await renderAndOpenDocumentsTab();
                const downloadBtn = screen.getByTitle('Download');
                await act(async () => { fireEvent.click(downloadBtn); });

                await waitFor(() => expect(revokeSpy).toHaveBeenCalledWith(blobUrl));
            });

            it('When the Download fetch fails / Then it falls back to opening the URL in a new tab', async () => {
                vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
                const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

                await renderAndOpenDocumentsTab();
                const downloadBtn = screen.getByTitle('Download');
                await act(async () => { fireEvent.click(downloadBtn); });

                await waitFor(() => expect(openSpy).toHaveBeenCalledWith(DOC_URL, '_blank'));
            });
        });
    });

    describe('Given a lead has multiple uploaded documents', () => {
        it('When the Documents tab is rendered / Then each document has its own View and Download actions', async () => {
            const docs = [
                makeDoc({ id: 'doc-1', name: 'contract.pdf', url: 'https://cdn.example.com/contract.pdf' }),
                makeDoc({ id: 'doc-2', name: 'invoice.xlsx', url: 'https://cdn.example.com/invoice.xlsx' }),
            ];
            defaultServiceMocks(docs);
            await renderAndOpenDocumentsTab();

            expect(screen.getAllByTitle('View').length).toBe(2);
            expect(screen.getAllByTitle('Download').length).toBe(2);
        });

        it('When the Documents tab is rendered / Then each View link points to its own document URL', async () => {
            const docs = [
                makeDoc({ id: 'doc-1', name: 'a.pdf', url: 'https://cdn.example.com/a.pdf' }),
                makeDoc({ id: 'doc-2', name: 'b.pdf', url: 'https://cdn.example.com/b.pdf' }),
            ];
            defaultServiceMocks(docs);
            await renderAndOpenDocumentsTab();

            const hrefs = (screen.getAllByTitle('View') as HTMLAnchorElement[]).map(l => l.href);
            expect(hrefs).toContain('https://cdn.example.com/a.pdf');
            expect(hrefs).toContain('https://cdn.example.com/b.pdf');
        });
    });

    describe('Given a lead has no documents', () => {
        it('When the Documents tab is rendered / Then no View or Download actions are shown', async () => {
            defaultServiceMocks([]);
            await renderAndOpenDocumentsTab();

            expect(screen.queryByTitle('View')).not.toBeInTheDocument();
            expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
            expect(screen.getByText(/No documents attached/i)).toBeInTheDocument();
        });
    });

    describe('Given documents are fetched on page load', () => {
        it('When the page loads / Then getDocumentsByLeadId is called with the lead ID', async () => {
            await renderAndOpenDocumentsTab();
            expect(mockGetDocumentsByLeadId).toHaveBeenCalledWith('lead-test-id');
        });

        it('When getDocumentsByLeadId returns documents / Then they appear in the Documents tab', async () => {
            await renderAndOpenDocumentsTab();
            expect(screen.getByText('proposal.pdf')).toBeInTheDocument();
        });

        it('When getDocumentsByLeadId fails / Then the tab shows empty state gracefully', async () => {
            mockGetDocumentsByLeadId.mockRejectedValue(new Error('Network error'));
            await renderAndOpenDocumentsTab();
            expect(screen.getByText(/No documents attached/i)).toBeInTheDocument();
        });
    });
});
