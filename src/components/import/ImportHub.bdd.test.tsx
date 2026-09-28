import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
    navigate: vi.fn(),
    perms: new Set<string>(),
    loaded: true,
    importClients: vi.fn(),
    importProjects: vi.fn(),
    importUnits: vi.fn(),
    listCategories: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        permissionsLoaded: h.loaded,
        hasPermission: (p: string) => h.perms.has(p),
    }),
}));

vi.mock('../leads/ImportLeadsWizard', () => ({
    ImportLeadsWizard: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="leads-wizard"><button onClick={onClose}>Close leads wizard</button></div>
    ),
}));

vi.mock('../../services/reImportService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/reImportService')>();
    return {
        ...actual,
        importClients: (...a: unknown[]) => h.importClients(...a),
        importProjects: (...a: unknown[]) => h.importProjects(...a),
        importUnits: (...a: unknown[]) => h.importUnits(...a),
        listCategories: (...a: unknown[]) => h.listCategories(...a),
    };
});

import { ImportHub } from './ImportHub';

const renderHub = () => {
    const onClose = vi.fn();
    const onImported = vi.fn();
    render(<ImportHub isOpen onClose={onClose} onImported={onImported} />);
    return { onClose, onImported };
};

const choose = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
const pick = (file: File) => fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } });
const csv = (text: string, name = 'data.csv') => new File([text], name, { type: 'text/csv' });
const closeModal = () => fireEvent.click(screen.getByTestId('icon-X').closest('button') as HTMLElement);

const CLIENTS_CSV = 'Name,Email,Phone\nAli,ali@x.com,\nNobody,,\nSara,,+971500000000';
const UNITS_CSV = 'Project,Tower,Unit No,Bedrooms,Final price\nPalm Vista,Tower A,101,2,1000000\nPalm Vista,Tower Z,102,3,';

const toMap = async (kind: string, text: string) => {
    choose(kind);
    pick(csv(text));
    await screen.findAllByTestId('import-mapping-row');
};

beforeEach(() => {
    vi.clearAllMocks();
    h.perms = new Set(['categories.create', 'items.import', 'employees.import']);
    h.loaded = true;
    h.importClients.mockResolvedValue({ created: 1, updated: 1, skipped: 0, problems: [{ row: 4, message: 'partner create failed' }] });
    h.importProjects.mockResolvedValue({ created: 0, updated: 0, skipped: 2, problems: [] });
    h.importUnits.mockResolvedValue({ created: 1, updated: 0, skipped: 0, problems: [{ row: 0, message: 'Import stopped: quota' }] });
    h.listCategories.mockResolvedValue([
        { id: 'p1', name: 'Palm Vista', parent_id: null },
        { id: 't1', name: 'Tower A', parent_id: 'p1' },
    ]);
});

describe('Given the CRM import hub', () => {
    describe('When the user may create everything', () => {
        it('Then every import type is offered', () => {
            renderHub();
            const hub = screen.getByTestId('import-hub');
            expect(hub).toHaveTextContent('What are you importing?');
            for (const label of ['Leads & contacts', 'Existing clients', 'Projects & towers', 'Units', 'Agents']) {
                expect(within(hub).getByText(label)).toBeInTheDocument();
            }
            expect(screen.getByTestId('icon-ExternalLink')).toBeInTheDocument();
        });
    });

    describe('When permissions are missing or not loaded yet', () => {
        it('Then only leads and clients are offered', () => {
            h.perms = new Set();
            renderHub();
            expect(screen.queryByText('Projects & towers')).toBeNull();
            expect(screen.queryByText('Units')).toBeNull();
            expect(screen.queryByText('Agents')).toBeNull();
            expect(screen.getByText('Existing clients')).toBeInTheDocument();
        });
        it('Then nothing gated shows before permissions load', () => {
            h.loaded = false;
            renderHub();
            expect(screen.queryByText('Units')).toBeNull();
        });
    });

    describe('When Agents is picked', () => {
        it('Then the hub closes and People Connect import opens', () => {
            const { onClose } = renderHub();
            choose('Agents');
            expect(onClose).toHaveBeenCalled();
            expect(h.navigate).toHaveBeenCalledWith('/people/import-export?tab=import');
        });
    });

    describe('When Leads & contacts is picked', () => {
        it('Then the lead wizard replaces the hub and closing it closes the hub', () => {
            const { onClose } = renderHub();
            choose('Leads & contacts');
            expect(screen.getByTestId('leads-wizard')).toBeInTheDocument();
            expect(screen.queryByTestId('import-hub')).toBeNull();
            fireEvent.click(screen.getByText('Close leads wizard'));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('When a record type is picked', () => {
        it('Then its upload step shows a template and can go back to all types', () => {
            renderHub();
            choose('Units');
            const flow = screen.getByTestId('record-import-units');
            expect(flow).toHaveTextContent('Import units');
            expect(within(screen.getByLabelText('Import steps')).getByText(/Upload/)).toHaveAttribute('aria-current', 'step');
            const template = screen.getByText('Template').closest('a') as HTMLAnchorElement;
            expect(template.getAttribute('download')).toBe('units-import-template.csv');
            expect(decodeURIComponent(template.getAttribute('href') as string)).toContain('Project,Tower,Unit number');
            fireEvent.click(screen.getByRole('button', { name: /All import types/ }));
            expect(screen.getByTestId('import-hub')).toBeInTheDocument();
        });

        it('Then a non-CSV file is refused', async () => {
            renderHub();
            choose('Existing clients');
            pick(csv('x', 'clients.xlsx'));
            expect(await screen.findByRole('alert')).toHaveTextContent(/Save the sheet as CSV/);
        });

        it('Then an unreadable CSV shows why', async () => {
            renderHub();
            choose('Existing clients');
            pick(csv('Name,Email\n'));
            expect(await screen.findByRole('alert')).toHaveTextContent('The file has headers but no rows.');
        });
    });

    describe('When existing clients are imported end to end', () => {
        it('Then columns are suggested, bad rows are listed, and the outcome merges both lists', async () => {
            const { onImported, onClose } = renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            expect(screen.getByText(/3 rows in/)).toHaveTextContent('data.csv');
            expect(screen.getByLabelText('Field for Name')).toHaveValue('name');
            expect(screen.getByLabelText('Field for Phone')).toHaveValue('phone');

            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(await screen.findByTestId('import-ready')).toHaveTextContent('2 clients ready to import.');
            expect(within(screen.getByLabelText('Rows with problems')).getByText('Row 3: Add an email or a phone')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Import 2 clients' }));
            const result = await screen.findByTestId('import-result');
            expect(h.importClients).toHaveBeenCalledWith({
                items: [
                    { row: 2, data: { name: 'Ali', email: 'ali@x.com' } },
                    { row: 4, data: { name: 'Sara', phone: '+971500000000' } },
                ],
                problems: [{ row: 3, message: 'Add an email or a phone' }],
            });
            expect(result).toHaveTextContent('Import finished');
            const errors = within(screen.getByLabelText('Import errors'));
            expect(errors.getByText('Row 3: Add an email or a phone')).toBeInTheDocument();
            expect(errors.getByText('Row 4: partner create failed')).toBeInTheDocument();
            expect(result).toHaveTextContent('2 rows not imported');
            expect(onImported).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            expect(onClose).toHaveBeenCalled();
        });

        it('Then a required field left unmapped stops the Map step', async () => {
            renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            fireEvent.change(screen.getByLabelText('Field for Name'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.getByRole('alert')).toHaveTextContent('Map a column to Name.');
            expect(screen.queryByTestId('import-ready')).toBeNull();
        });

        it('Then a failed import keeps the Review step and shows the error', async () => {
            h.importClients.mockRejectedValue(new Error('rows must contain at most 5000 elements'));
            const { onImported } = renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('rows must contain at most 5000 elements');
            expect(screen.getByTestId('import-ready')).toBeInTheDocument();
            expect(onImported).not.toHaveBeenCalled();
        });

        it('Then a failure without a message says the import failed', async () => {
            h.importClients.mockRejectedValue(new Error(''));
            renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('The import failed.');
        });

        it('Then Back returns to Map and Choose another file returns to Upload', async () => {
            renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            await screen.findByTestId('import-ready');
            fireEvent.click(screen.getByRole('button', { name: 'Back' }));
            expect(screen.getAllByTestId('import-mapping-row')).toHaveLength(3);
            fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
            expect(screen.getByLabelText('Import file')).toBeInTheDocument();
        });
    });

    describe('When projects that all exist already are imported', () => {
        it('Then nothing is reported as imported and onImported is not called', async () => {
            const { onImported } = renderHub();
            await toMap('Projects & towers', 'Project,Tower\nPalm Vista,A\nPalm Vista,B');
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(await screen.findByTestId('import-ready')).toHaveTextContent('1 project ready to import.');
            expect(screen.queryByLabelText('Rows with problems')).toBeNull();
            fireEvent.click(screen.getByRole('button', { name: 'Import 1 project' }));
            const result = await screen.findByTestId('import-result');
            expect(h.importProjects).toHaveBeenCalledWith([
                { name: 'Palm Vista', row: 2, metadata: {}, towers: [{ name: 'A', row: 2 }, { name: 'B', row: 3 }] },
            ]);
            expect(within(result).getByText('Already there').nextSibling).toHaveTextContent('2');
            expect(screen.queryByLabelText('Import errors')).toBeNull();
            expect(onImported).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: 'Import another file' }));
            expect(screen.getByLabelText('Import file')).toBeInTheDocument();
        });
    });

    describe('When units are imported', () => {
        it('Then rows are matched to towers and a stop reason shows without a row number', async () => {
            const { onImported } = renderHub();
            await toMap('Units', UNITS_CSV);
            expect(screen.getByLabelText('Field for Unit No')).toHaveValue('unit_number');
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(await screen.findByTestId('import-ready')).toHaveTextContent('1 unit ready to import.');
            expect(screen.getByText('Row 3: Tower "Tower Z" does not exist in Palm Vista')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Import 1 unit' }));
            await screen.findByTestId('import-result');
            expect(h.importUnits.mock.calls[0][0].items).toEqual([{
                row: 2,
                data: { category_id: 't1', unit_number: '101', sku: 'Tower A-101', price: 1000000, attributes: { bedrooms: 2, final_price: 1000000 } },
            }]);
            expect(within(screen.getByLabelText('Import errors')).getByText('Import stopped: quota')).toBeInTheDocument();
            expect(onImported).toHaveBeenCalled();
        });

        it('Then no ready rows keeps the Import button disabled', async () => {
            h.listCategories.mockResolvedValue([]);
            renderHub();
            await toMap('Units', UNITS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(await screen.findByTestId('import-ready')).toHaveTextContent('0 units ready to import.');
            expect(screen.getByRole('button', { name: 'Import 0 units' })).toBeDisabled();
        });

        it('Then a failure loading projects stays on Map with a message', async () => {
            h.listCategories.mockRejectedValue(new Error(''));
            renderHub();
            await toMap('Units', UNITS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the rows.');
            expect(screen.getAllByTestId('import-mapping-row')).toHaveLength(5);
        });
    });

    describe('When the modal is closed', () => {
        it('Then an idle hub closes and reopens on the type list', () => {
            const { onClose } = renderHub();
            choose('Existing clients');
            closeModal();
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('import-hub')).toBeInTheDocument();
        });

        it('Then a busy import cannot be closed', async () => {
            let finish: (v: unknown) => void = () => undefined;
            h.importClients.mockReturnValue(new Promise((r) => { finish = r; }));
            const { onClose } = renderHub();
            await toMap('Existing clients', CLIENTS_CSV);
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled());
            closeModal();
            expect(onClose).not.toHaveBeenCalled();
            finish({ created: 0, updated: 0, skipped: 0, problems: [] });
            await screen.findByTestId('import-result');
        });
    });
});
