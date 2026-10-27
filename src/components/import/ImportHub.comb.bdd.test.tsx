import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const CLIENTS_CSV = 'Name,Email,Phone\nAli,ali@x.com,\nSara,,+971500000000';
const toMap = async () => {
    choose('Existing clients');
    pick(csv(CLIENTS_CSV));
    await screen.findAllByTestId('import-mapping-row');
};

beforeEach(() => {
    vi.clearAllMocks();
    h.perms = new Set(['categories.create', 'items.import', 'employees.import']);
    h.loaded = true;
    h.importClients.mockResolvedValue({ created: 2, updated: 0, skipped: 0, problems: [] });
    h.listCategories.mockResolvedValue([]);
});

describe('Feature ImportHub uses Comb Buttons', () => {
  describe('Scenario option buttons render', () => {
    it('Given full permissions When opened Then 5 options are Comb secondary buttons with label, hint and chevron icon', () => {
        renderHub();
        const hub = screen.getByTestId('import-hub');
        const opts = within(hub).getAllByRole('button');
        expect(opts).toHaveLength(5);
        opts.forEach((o) => {
            expect(o).toHaveAttribute('data-comb', 'button');
            expect(o).toHaveAttribute('data-variant', 'secondary');
            expect(o).toHaveAttribute('type', 'button');
            expect(o.querySelector('svg')).not.toBeNull();
        });
        expect(opts[0]).toHaveTextContent('Leads & contacts');
        expect(opts[0]).toHaveTextContent('CSV or Excel');
        expect(opts[4]).toHaveTextContent('Opens People Connect import');
    });

    it('Given no permissions When opened Then only 2 option buttons exist', () => {
        h.perms = new Set();
        renderHub();
        expect(within(screen.getByTestId('import-hub')).getAllByRole('button')).toHaveLength(2);
    });

    it.each([
        ['categories.create', 'Projects & towers'],
        ['items.import', 'Units'],
        ['employees.import', 'Agents'],
    ])('Given only permission %s When opened Then %s appears and the others do not', (perm, label) => {
        h.perms = new Set([perm]);
        renderHub();
        expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
        expect(within(screen.getByTestId('import-hub')).getAllByRole('button')).toHaveLength(3);
    });

    it('Given permissions not loaded When opened Then gated buttons are absent', () => {
        h.loaded = false;
        renderHub();
        expect(within(screen.getByTestId('import-hub')).getAllByRole('button')).toHaveLength(2);
    });

    it('Given the option buttons When tabbed Then focus follows DOM order', async () => {
        const user = userEvent.setup();
        renderHub();
        const opts = within(screen.getByTestId('import-hub')).getAllByRole('button');
        opts[0].focus();
        await user.tab();
        expect(opts[1]).toHaveFocus();
    });
  });

  describe('Scenario option interaction', () => {
    it('Given Existing clients When clicked Then the record flow opens', () => {
        renderHub();
        choose('Existing clients');
        expect(screen.getByTestId('record-import-clients')).toBeInTheDocument();
    });

    it('Given a focused option When Enter is pressed Then it activates', async () => {
        const user = userEvent.setup();
        renderHub();
        screen.getByRole('button', { name: /Existing clients/ }).focus();
        await user.keyboard('{Enter}');
        expect(screen.getByTestId('record-import-clients')).toBeInTheDocument();
    });

    it('Given a focused option When Space is pressed Then it activates', async () => {
        const user = userEvent.setup();
        renderHub();
        screen.getByRole('button', { name: /Projects & towers/ }).focus();
        await user.keyboard(' ');
        expect(screen.getByTestId('record-import-projects')).toBeInTheDocument();
    });

    it('Given Agents When clicked Then it closes and navigates to People Connect', () => {
        const { onClose } = renderHub();
        choose('Agents');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(h.navigate).toHaveBeenCalledWith('/people/import-export?tab=import');
    });

    it('Given Leads When clicked Then the lead wizard opens in place of the hub', () => {
        renderHub();
        choose('Leads & contacts');
        expect(screen.getByTestId('leads-wizard')).toBeInTheDocument();
    });

    it('Given a closed hub When rendered Then no option buttons show', () => {
        render(<ImportHub isOpen={false} onClose={vi.fn()} onImported={vi.fn()} />);
        expect(screen.queryByTestId('import-hub')).toBeNull();
    });
  });

  describe('Scenario flow buttons render', () => {
    it('Given the Upload step When shown Then "All import types" is a Comb secondary Button and enabled', () => {
        renderHub();
        choose('Existing clients');
        const back = screen.getByRole('button', { name: /All import types/ });
        expect(back).toHaveAttribute('data-comb', 'button');
        expect(back).toHaveAttribute('data-variant', 'secondary');
        expect(back).toBeEnabled();
    });

    it('Given the Map step When shown Then Choose another file is secondary and Next is a default Comb Button', async () => {
        renderHub();
        await toMap();
        expect(screen.getByRole('button', { name: 'Choose another file' })).toHaveAttribute('data-variant', 'secondary');
        const next = screen.getByRole('button', { name: 'Next' });
        expect(next).toHaveAttribute('data-comb', 'button');
        expect(next).not.toHaveAttribute('data-variant', 'secondary');
        expect(next).toBeEnabled();
    });

    it('Given the Review step When shown Then Back is secondary and Import n clients is enabled', async () => {
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await screen.findByTestId('import-ready');
        expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('data-variant', 'secondary');
        expect(screen.getByRole('button', { name: 'Import 2 clients' })).toBeEnabled();
    });

    it('Given the Done step When shown Then Import another file is secondary and Done closes the hub', async () => {
        const { onClose } = renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
        await screen.findByTestId('import-result');
        expect(screen.getByRole('button', { name: 'Import another file' })).toHaveAttribute('data-variant', 'secondary');
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Scenario flow navigation', () => {
    it('Given the Upload step When All import types is clicked Then the hub list returns', () => {
        renderHub();
        choose('Existing clients');
        fireEvent.click(screen.getByRole('button', { name: /All import types/ }));
        expect(screen.getByTestId('import-hub')).toBeInTheDocument();
    });

    it('Given the Map step When Choose another file is clicked Then Upload returns', async () => {
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
        expect(screen.getByLabelText('Import file')).toBeInTheDocument();
    });

    it('Given the Review step When Back is clicked Then Map returns', async () => {
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await screen.findByTestId('import-ready');
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getAllByTestId('import-mapping-row').length).toBeGreaterThan(0);
    });

    it('Given the Done step When Import another file is clicked Then Upload returns', async () => {
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
        await screen.findByTestId('import-result');
        fireEvent.click(screen.getByRole('button', { name: 'Import another file' }));
        expect(screen.getByLabelText('Import file')).toBeInTheDocument();
    });
  });

  describe('Scenario disabled and busy', () => {
    it('Given no ready rows When on Review Then Import button is disabled and does not call the API', async () => {
        renderHub();
        choose('Units');
        pick(csv('Project,Tower,Unit No\nPalm,T,1'));
        await screen.findAllByTestId('import-mapping-row');
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        const btn = await screen.findByRole('button', { name: 'Import 0 units' });
        expect(btn).toBeDisabled();
        fireEvent.click(btn);
        expect(h.importUnits).not.toHaveBeenCalled();
    });

    it('Given a pending import When running Then Back, Import and the modal are disabled or inert', async () => {
        let finish: (v: unknown) => void = () => undefined;
        h.importClients.mockReturnValue(new Promise((r) => { finish = r; }));
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled());
        expect(screen.getByRole('button', { name: /Import 2 clients/ })).toBeDisabled();
        await act(async () => { finish({ created: 2, updated: 0, skipped: 0, problems: [] }); });
        await screen.findByTestId('import-result');
        expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
    });
  });

  describe('Scenario error paths', () => {
    it('Given the import API rejects When Import is clicked Then error shows and buttons re-enable', async () => {
        h.importClients.mockRejectedValue(new Error('server said no'));
        renderHub();
        await toMap();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Import 2 clients' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('server said no');
        expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Import 2 clients' })).toBeEnabled();
    });

    it('Given unmapped required field When Next is clicked Then the Map step stays and Next remains enabled', async () => {
        renderHub();
        await toMap();
        fireEvent.change(screen.getByLabelText('Field for Name'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Map a column to Name.');
        expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });
  });
});
