import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { CustomProductBuildRequestModal } from './CustomProductBuildRequestModal';

const mockGetProductCategories = vi.hoisted(() => vi.fn());
vi.mock('../../services/crmService', () => ({
    crmService: { getProductCategories: mockGetProductCategories },
}));

const HIERARCHICAL_CATEGORIES = [
    { id: 'living', name: 'Living', parent_id: null },
    { id: 'seating', name: 'Seating', parent_id: 'living' },
    { id: 'sofas', name: 'Sofas', parent_id: 'seating' },
    { id: 'outdoor', name: 'Outdoor', parent_id: null },
];

describe('Given the Inventory category tree has nested categories (Living > Seating > Sofas)', () => {
    beforeEach(() => {
        mockGetProductCategories.mockReset();
        mockGetProductCategories.mockResolvedValue(HIERARCHICAL_CATEGORIES);
    });

    test('When the New Custom Product modal opens, Then the category dropdown lists every level, indented by depth, parent before children', async () => {
        render(<CustomProductBuildRequestModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

        await waitFor(() => expect(mockGetProductCategories).toHaveBeenCalled());

        const select = await screen.findByRole('combobox') as HTMLSelectElement;
        const optionTexts = Array.from(select.options).map(o => o.textContent);

        expect(optionTexts).toEqual([
            '-- Select Product Category --',
            'Living',
            '— Seating',
            '—— Sofas',
            'Outdoor',
        ]);
    });

    test('When a nested category is selected and the form is submitted, Then onSubmit receives that category\'s id, not just its name', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<CustomProductBuildRequestModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);
        await screen.findByRole('combobox');

        fireEvent.change(screen.getByPlaceholderText(/Bespoke Teak/i), { target: { value: 'Custom Sofa' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sofas' } });
        fireEvent.click(screen.getByRole('button', { name: /Submit Build Request/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ category_id: 'sofas', category_name: 'Sofas' });
    });
});

describe('Given two categories share the same leaf name under different parents (Living/Sofas vs Outdoor-only "Sofas")', () => {
    test('When submitting after selecting the Living > Seating > Sofas option, Then the unique category id for that branch is saved, not a name match', async () => {
        const withDuplicateNames = [
            ...HIERARCHICAL_CATEGORIES,
            { id: 'outdoor-sofas', name: 'Sofas', parent_id: 'outdoor' },
        ];
        mockGetProductCategories.mockReset();
        mockGetProductCategories.mockResolvedValue(withDuplicateNames);
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<CustomProductBuildRequestModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);
        const select = await screen.findByRole('combobox');

        fireEvent.change(screen.getByPlaceholderText(/Bespoke Teak/i), { target: { value: 'Custom Outdoor Sofa' } });
        fireEvent.change(select, { target: { value: 'outdoor-sofas' } });
        fireEvent.click(screen.getByRole('button', { name: /Submit Build Request/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][0].category_id).toBe('outdoor-sofas');
    });
});

describe('Given no Inventory categories are configured for the organization', () => {
    test('When the modal opens, Then it shows the empty-state message instead of a broken dropdown', async () => {
        mockGetProductCategories.mockReset();
        mockGetProductCategories.mockResolvedValue([]);
        render(<CustomProductBuildRequestModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

        expect(await screen.findByText(/No categories found in Inventory/i)).toBeInTheDocument();
    });
});

describe('Given the category field is left unselected', () => {
    test('When the form is submitted, Then a validation error is shown and onSubmit is not called', async () => {
        mockGetProductCategories.mockReset();
        mockGetProductCategories.mockResolvedValue(HIERARCHICAL_CATEGORIES);
        const onSubmit = vi.fn();
        render(<CustomProductBuildRequestModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);
        await screen.findByRole('combobox');

        fireEvent.change(screen.getByPlaceholderText(/Bespoke Teak/i), { target: { value: 'Something' } });
        const form = screen.getByRole('button', { name: /Submit Build Request/i }).closest('form')!;
        fireEvent.submit(form);

        expect(await screen.findByText(/Product category is required/i)).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
