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
            expect(screen.getByRole('option', { name: 'Budget (custom)' })).toBeInTheDocument();
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
