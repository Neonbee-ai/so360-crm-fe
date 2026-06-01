import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PartnerSearchDropdown } from './PartnerSearchDropdown';

const mockPartners = [
    { id: 'p1', company_name: 'Acme Corp', contact_name: 'John Doe' },
    { id: 'p2', company_name: 'Beta LLC', contact_name: 'Jane Smith' },
    { id: 'p3', company_name: 'Gamma Inc', contact_name: undefined },
];

describe('PartnerSearchDropdown', () => {
    describe('Given no partner is selected', () => {
        it('When rendered / Then shows placeholder text', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} placeholder="Search partner..." />);
            expect(screen.getByText('Search partner...')).toBeInTheDocument();
        });

        it('When rendered / Then does not show dropdown list', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            expect(screen.queryByTestId('partner-dropdown-list')).not.toBeInTheDocument();
        });
    });

    describe('Given a partner is selected', () => {
        it('When rendered / Then shows the selected partner company name', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="p1" onChange={vi.fn()} />);
            expect(screen.getByText('Acme Corp (John Doe)')).toBeInTheDocument();
        });

        it('When rendered / Then shows clear button', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="p1" onChange={vi.fn()} />);
            expect(screen.getByTestId('partner-clear-btn')).toBeInTheDocument();
        });

        it('When clear button is clicked / Then calls onChange with empty string', () => {
            const onChange = vi.fn();
            render(<PartnerSearchDropdown partners={mockPartners} value="p1" onChange={onChange} />);
            fireEvent.click(screen.getByTestId('partner-clear-btn'));
            expect(onChange).toHaveBeenCalledWith('');
        });
    });

    describe('Given user opens the dropdown', () => {
        it('When combobox is clicked / Then shows the partner list', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => {
                expect(screen.getByTestId('partner-dropdown-list')).toBeInTheDocument();
            });
        });

        it('When dropdown opens / Then shows all partners', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => {
                expect(screen.getByText('Acme Corp')).toBeInTheDocument();
                expect(screen.getByText('Beta LLC')).toBeInTheDocument();
                expect(screen.getByText('Gamma Inc')).toBeInTheDocument();
            });
        });

        it('When dropdown opens / Then shows None option', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => {
                expect(screen.getByText('— None —')).toBeInTheDocument();
            });
        });
    });

    describe('Given user types in the search input', () => {
        it('When typing a query / Then filters partners by company name', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => screen.getByTestId('partner-search-input'));
            fireEvent.change(screen.getByTestId('partner-search-input'), { target: { value: 'Acme' } });
            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            expect(screen.queryByText('Beta LLC')).not.toBeInTheDocument();
        });

        it('When typing a query / Then filters partners by contact name', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => screen.getByTestId('partner-search-input'));
            fireEvent.change(screen.getByTestId('partner-search-input'), { target: { value: 'Jane' } });
            expect(screen.getByText('Beta LLC')).toBeInTheDocument();
            expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
        });

        it('When no partners match / Then shows no partners found message', async () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => screen.getByTestId('partner-search-input'));
            fireEvent.change(screen.getByTestId('partner-search-input'), { target: { value: 'zzznomatch' } });
            expect(screen.getByText(/no partners found/i)).toBeInTheDocument();
        });
    });

    describe('Given user selects a partner', () => {
        it('When a partner option is clicked / Then calls onChange with partner id', async () => {
            const onChange = vi.fn();
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={onChange} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => screen.getByTestId('partner-option-p2'));
            fireEvent.click(screen.getByTestId('partner-option-p2'));
            expect(onChange).toHaveBeenCalledWith('p2');
        });

        it('When None option is clicked / Then calls onChange with empty string', async () => {
            const onChange = vi.fn();
            render(<PartnerSearchDropdown partners={mockPartners} value="p1" onChange={onChange} />);
            fireEvent.click(screen.getByRole('combobox'));
            await waitFor(() => screen.getByText('— None —'));
            fireEvent.click(screen.getByText('— None —'));
            expect(onChange).toHaveBeenCalledWith('');
        });
    });

    describe('Given the dropdown is disabled', () => {
        it('When rendered as disabled / Then has disabled styling', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="" onChange={vi.fn()} disabled={true} />);
            expect(screen.getByRole('combobox').className).toContain('opacity-50');
        });
    });

    describe('Given a partner without a contact name', () => {
        it('When selected / Then shows only company name without parentheses', () => {
            render(<PartnerSearchDropdown partners={mockPartners} value="p3" onChange={vi.fn()} />);
            expect(screen.getByText('Gamma Inc')).toBeInTheDocument();
            expect(screen.queryByText(/Gamma Inc \(/)).not.toBeInTheDocument();
        });
    });
});
