import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({ preview: vi.fn(), import: vi.fn() }));
vi.mock('../../services/leadImportService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/leadImportService')>();
    return { ...actual, leadImportService: svc };
});

import ImportLeadsWizard from './ImportLeadsWizard';

const csv = () => new File(['Name,Email\nA,a@x.com'], 'leads.csv', { type: 'text/csv' });

const PREVIEW = {
    headers: ['Name', 'Email', 'Budget'],
    sample_rows: [
        { Name: 'Asha Rao', Email: 'asha@x.com', Budget: '2M' },
        { Name: 'Omar Ali', Email: 'omar@x.com', Budget: '1M' },
    ],
    total_rows: 42,
    suggested_mapping: { Name: 'contact_name', Email: 'email', Budget: null },
    available_fields: [
        { key: 'first_name', label: 'First name' },
        { key: 'contact_name', label: 'Full name' },
        { key: 'email', label: 'Email' },
        { key: 'custom:cf-1', label: 'Budget', custom: true },
    ],
};

const pick = (file: File) => fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } });

const renderWizard = () => {
    const onClose = vi.fn();
    const onImported = vi.fn();
    render(<ImportLeadsWizard isOpen onClose={onClose} onImported={onImported} />);
    return { onClose, onImported };
};

const toMapStep = async () => {
    pick(csv());
    await screen.findAllByTestId('import-mapping-row');
};

beforeEach(() => {
    vi.clearAllMocks();
    svc.preview.mockResolvedValue(PREVIEW);
    svc.import.mockResolvedValue({ total_rows: 42, created: 40, updated: 0, skipped: 1, errors: [{ row: 7, message: 'Needs an email or phone' }] });
});

describe('Given the lead import wizard', () => {
    describe('When a non-spreadsheet file is chosen', () => {
        it('Then it is refused before any upload', async () => {
            renderWizard();
            pick(new File(['x'], 'leads.pdf'));
            expect(await screen.findByRole('alert')).toHaveTextContent(/only \.csv and \.xlsx/i);
            expect(svc.preview).not.toHaveBeenCalled();
        });
    });

    describe('When the preview request fails with an explained error', () => {
        it('Then the backend message shows and the user stays on Upload', async () => {
            svc.preview.mockRejectedValueOnce(new Error('The file has more than 5000 rows'));
            renderWizard();
            pick(csv());
            expect(await screen.findByRole('alert')).toHaveTextContent('The file has more than 5000 rows');
            expect(screen.getByLabelText('Import file')).toBeInTheDocument();
        });
    });

    describe('When a CSV is chosen', () => {
        it('Then each column gets a field picker pre-filled from the suggested mapping', async () => {
            renderWizard();
            await toMapStep();
            expect(svc.preview).toHaveBeenCalledTimes(1);
            expect(screen.getByText(/42 rows in/)).toBeInTheDocument();
            expect(screen.getByLabelText('Field for Name')).toHaveValue('contact_name');
            expect(screen.getByLabelText('Field for Email')).toHaveValue('email');
            expect(screen.getByLabelText('Field for Budget')).toHaveValue('');
            expect(within(screen.getByLabelText('Field for Budget')).getByRole('option', { name: 'Budget (custom)' })).toBeInTheDocument();
        });
    });

    describe('When the name column is unmapped and Next is pressed', () => {
        it('Then the wizard explains and stays on Map', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Name'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.getByRole('alert')).toHaveTextContent(/first name or full name/i);
            expect(screen.queryByRole('table', { name: 'Import preview' })).not.toBeInTheDocument();
        });
    });

    describe('When two columns are mapped to the same field', () => {
        it('Then the wizard refuses to continue', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Budget'), { target: { value: 'email' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.getByRole('alert')).toHaveTextContent(/only one column/i);
        });
    });

    describe('When the mapping is confirmed', () => {
        it('Then Review shows sample rows under the mapped field labels only, with Skip as the default policy', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Budget'), { target: { value: 'custom:cf-1' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            const table = screen.getByRole('table', { name: 'Import preview' });
            const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
            expect(headers).toEqual(['Full name', 'Email', 'Budget']);
            expect(within(table).getByText('Asha Rao')).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /skip/i })).toBeChecked();
        });
    });

    describe('When the import runs with the Update policy', () => {
        it('Then the same file, mapping and policy are sent, results and row errors show, and the list refreshes', async () => {
            const { onImported } = renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('radio', { name: /update/i }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            await screen.findByTestId('import-result');
            const [sentFile, sentMapping, sentPolicy] = svc.import.mock.calls[0];
            expect(sentFile.name).toBe('leads.csv');
            expect(sentMapping).toEqual({ Name: 'contact_name', Email: 'email', Budget: null });
            expect(sentPolicy).toBe('update');
            const result = screen.getByTestId('import-result');
            expect(within(result).getByText('40')).toBeInTheDocument();
            expect(within(result).getByText('Row 7: Needs an email or phone')).toBeInTheDocument();
            expect(onImported).toHaveBeenCalledTimes(1);
        });
    });

    describe('When nothing was created or updated', () => {
        it('Then the lead list is not refreshed', async () => {
            svc.import.mockResolvedValueOnce({ total_rows: 2, created: 0, updated: 0, skipped: 2, errors: [] });
            const { onImported } = renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            await screen.findByTestId('import-result');
            expect(onImported).not.toHaveBeenCalled();
        });
    });

    describe('When the import request fails', () => {
        it('Then the error shows on Review so the user can retry', async () => {
            svc.import.mockRejectedValueOnce(new Error('Upload failed: 502'));
            renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent('The import failed.');
            expect(screen.getByRole('button', { name: /import 42 leads/i })).toBeEnabled();
        });
    });

    describe('When Done is pressed after an import', () => {
        it('Then the wizard closes', async () => {
            const { onClose } = renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            await screen.findByTestId('import-result');
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
        });
    });
});

const closeX = () => {
    const icon = screen.getByTestId('icon-X');
    fireEvent.click(icon.closest('button') as HTMLButtonElement);
};

describe('Given the wizard is closed', () => {
    it('Then nothing is rendered', () => {
        render(<ImportLeadsWizard isOpen={false} onClose={vi.fn()} onImported={vi.fn()} />);
        expect(screen.queryByTestId('import-leads-wizard')).not.toBeInTheDocument();
    });
});

describe('Given the upload step', () => {
    describe('When the picker is dismissed with no file', () => {
        it('Then it asks for a file and never uploads', async () => {
            renderWizard();
            fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [] } });
            expect(await screen.findByRole('alert')).toHaveTextContent('Choose a .csv or .xlsx file.');
            expect(svc.preview).not.toHaveBeenCalled();
        });
    });

    describe('When the preview fails with an unexplained error', () => {
        it('Then the generic fallback shows', async () => {
            svc.preview.mockRejectedValueOnce(new Error(''));
            renderWizard();
            pick(csv());
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the file.');
        });
    });

    describe('When the file is being read', () => {
        it('Then the drop zone says "Reading file…", the input is disabled and closing is ignored', async () => {
            let resolvePreview: (v: unknown) => void = () => {};
            svc.preview.mockReturnValueOnce(new Promise(r => { resolvePreview = r; }));
            const { onClose } = renderWizard();
            expect(screen.getByText('Choose a .csv or .xlsx file')).toBeInTheDocument();
            expect(screen.getByTestId('icon-UploadCloud')).toBeInTheDocument();
            pick(csv());
            expect(await screen.findByText('Reading file…')).toBeInTheDocument();
            expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
            expect(screen.getByLabelText('Import file')).toBeDisabled();
            closeX();
            expect(onClose).not.toHaveBeenCalled();
            resolvePreview(PREVIEW);
            await screen.findAllByTestId('import-mapping-row');
        });
    });

    describe('When the modal X is pressed while idle', () => {
        it('Then the wizard closes', () => {
            const { onClose } = renderWizard();
            closeX();
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('When the step indicator renders', () => {
        it('Then only the current step is marked and earlier steps are highlighted', async () => {
            renderWizard();
            const steps = () => within(screen.getByRole('list', { name: 'Import steps' })).getAllByRole('listitem');
            expect(steps()[0]).toHaveAttribute('aria-current', 'step');
            expect(steps()[1]).not.toHaveAttribute('aria-current');
            expect(steps()[1].className).toMatch(/text-slate-500/);
            await toMapStep();
            expect(steps()[1]).toHaveAttribute('aria-current', 'step');
            expect(steps()[0].className).toMatch(/text-blue-400/);
        });
    });
});

describe('Given the map step', () => {
    describe('When the file has a single row', () => {
        it('Then the copy is singular on Map and Review', async () => {
            svc.preview.mockResolvedValueOnce({ ...PREVIEW, total_rows: 1 });
            renderWizard();
            await toMapStep();
            expect(screen.getByText(/1 row in/)).toBeInTheDocument();
            expect(screen.queryByText(/1 rows in/)).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.getByRole('button', { name: 'Import 1 lead' })).toBeInTheDocument();
        });
    });

    describe('When there are no sample rows', () => {
        it('Then the column hints are blank and Review has an empty body', async () => {
            svc.preview.mockResolvedValueOnce({ ...PREVIEW, sample_rows: [] });
            renderWizard();
            await toMapStep();
            const rows = screen.getAllByTestId('import-mapping-row');
            expect(rows[0].querySelectorAll('p')[1].textContent).toBe('');
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            const table = screen.getByRole('table', { name: 'Import preview' });
            expect(within(table).queryAllByRole('cell')).toHaveLength(0);
            expect(screen.getByText(/Showing 0 of 42 rows/)).toBeInTheDocument();
        });
    });

    describe('When a sample row lacks a mapped column', () => {
        it('Then that cell is blank', async () => {
            svc.preview.mockResolvedValueOnce({ ...PREVIEW, sample_rows: [{ Name: 'Asha Rao' }] });
            renderWizard();
            await toMapStep();
            expect(screen.getAllByTestId('import-mapping-row')[1].querySelectorAll('p')[1].textContent).toBe('');
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            const cells = within(screen.getByRole('table', { name: 'Import preview' })).getAllByRole('cell');
            expect(cells.map(c => c.textContent)).toEqual(['Asha Rao', '']);
        });
    });

    describe('When the suggested mapping names a field the picker does not list', () => {
        it('Then Review falls back to the raw field key', async () => {
            svc.preview.mockResolvedValueOnce({ ...PREVIEW, suggested_mapping: { Name: 'contact_name', Email: 'legacy_email', Budget: null } });
            renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            const headers = within(screen.getByRole('table', { name: 'Import preview' })).getAllByRole('columnheader').map(h => h.textContent);
            expect(headers).toEqual(['Full name', 'legacy_email']);
        });
    });

    describe('When a column is set back to "Don\'t import"', () => {
        it('Then it is sent as null', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Email'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            await screen.findByTestId('import-result');
            expect(svc.import.mock.calls[0][1]).toEqual({ Name: 'contact_name', Email: null, Budget: null });
        });
    });

    describe('When "Choose another file" is pressed', () => {
        it('Then the wizard returns to Upload with a clean slate', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
            expect(screen.getByLabelText('Import file')).toBeInTheDocument();
            expect(screen.queryByTestId('import-mapping-row')).not.toBeInTheDocument();
        });
    });

    describe('When a mapping error is fixed and Next is pressed again', () => {
        it('Then the error clears and Review opens', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Name'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.getByRole('alert')).toBeInTheDocument();
            fireEvent.change(screen.getByLabelText('Field for Name'), { target: { value: 'first_name' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(screen.getByRole('table', { name: 'Import preview' })).toBeInTheDocument();
        });
    });
});

describe('Given the review step', () => {
    describe('When Back is pressed', () => {
        it('Then Map shows again with the mapping kept', async () => {
            renderWizard();
            await toMapStep();
            fireEvent.change(screen.getByLabelText('Field for Budget'), { target: { value: 'custom:cf-1' } });
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: 'Back' }));
            expect(screen.getByLabelText('Field for Budget')).toHaveValue('custom:cf-1');
        });
    });

    describe('When the import is in flight', () => {
        it('Then Back and Import are disabled with a spinner, and closing is ignored', async () => {
            let resolveImport: (v: unknown) => void = () => {};
            svc.import.mockReturnValueOnce(new Promise(r => { resolveImport = r; }));
            const { onClose } = renderWizard();
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            const importBtn = screen.getByRole('button', { name: /import 42 leads/i });
            fireEvent.click(importBtn);
            await waitFor(() => expect(importBtn).toBeDisabled());
            expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
            expect(importBtn.querySelector('[data-testid="icon-Loader2"]')).not.toBeNull();
            closeX();
            expect(onClose).not.toHaveBeenCalled();
            resolveImport({ total_rows: 42, created: 1, updated: 0, skipped: 0, errors: [] });
            await screen.findByTestId('import-result');
        });
    });
});

describe('Given the done step', () => {
    const runTo = async (result: unknown) => {
        svc.import.mockResolvedValueOnce(result);
        const handles = renderWizard();
        await toMapStep();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
        return { ...handles, result: await screen.findByTestId('import-result') };
    };

    describe('When counts and errors are missing from the response', () => {
        it('Then counts show 0, no error list shows and the list is not refreshed', async () => {
            const { result, onImported } = await runTo({ total_rows: 42 });
            const values = within(result).getAllByRole('definition').map(d => d.textContent);
            expect(values).toEqual(['0', '0', '0']);
            expect(within(result).queryByRole('list', { name: 'Import errors' })).not.toBeInTheDocument();
            expect(onImported).not.toHaveBeenCalled();
        });
    });

    describe('When only updates happened', () => {
        it('Then the list is refreshed', async () => {
            const { onImported } = await runTo({ total_rows: 42, updated: 3, errors: [] });
            expect(onImported).toHaveBeenCalledTimes(1);
        });
    });

    describe('When exactly one row failed', () => {
        it('Then the error heading is singular', async () => {
            const { result } = await runTo({ total_rows: 42, created: 1, updated: 0, skipped: 0, errors: [{ row: 3, message: 'Bad email' }] });
            expect(within(result).getByText('1 row not imported')).toBeInTheDocument();
        });
    });

    describe('When several rows failed', () => {
        it('Then the error heading is plural', async () => {
            const { result } = await runTo({ total_rows: 42, created: 0, updated: 0, skipped: 0, errors: [{ row: 3, message: 'a' }, { row: 4, message: 'b' }] });
            expect(within(result).getByText('2 rows not imported')).toBeInTheDocument();
        });
    });

    describe('When Done is pressed and the wizard reopens', () => {
        it('Then it starts again at Upload', async () => {
            svc.import.mockResolvedValueOnce({ total_rows: 42, created: 1, updated: 0, skipped: 0, errors: [] });
            const onClose = vi.fn();
            const { rerender } = render(<ImportLeadsWizard isOpen onClose={onClose} onImported={vi.fn()} />);
            await toMapStep();
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            fireEvent.click(screen.getByRole('button', { name: /import 42 leads/i }));
            await screen.findByTestId('import-result');
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            rerender(<ImportLeadsWizard isOpen={false} onClose={onClose} onImported={vi.fn()} />);
            rerender(<ImportLeadsWizard isOpen onClose={onClose} onImported={vi.fn()} />);
            expect(screen.getByLabelText('Import file')).toBeInTheDocument();
            expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
        });
    });
});
