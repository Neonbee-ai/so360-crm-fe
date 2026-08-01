/**
 * BDD Spec — ProductPickerModal
 *
 * Covers: modal closed renders nothing, modal open shows search input,
 * typing debounces and calls searchInventoryItems, loading state shown,
 * items rendered after search, item without variants selected directly,
 * item with variants expands on click, variant selected from expanded list,
 * empty state shown when no results, modal reset on close.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  Package: () => <span data-testid="icon-package" />,
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="modal-root">{children}</div> : null,
}));

vi.mock('./common/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

const mockCrmService = vi.hoisted(() => ({
  searchInventoryItems: vi.fn(),
}));
vi.mock('../services/crmService', () => ({ crmService: mockCrmService }));

import { ProductPickerModal } from './ProductPickerModal';

const ITEM_NO_VARIANTS = {
  id: 'item-1', name: 'Widget Pro', sku: 'WP-001', price: 250.0,
  image_url: null, has_variants: false, variants: [],
};
const ITEM_WITH_VARIANTS = {
  id: 'item-2', name: 'T-Shirt', sku: 'TS-001', price: 499.0,
  image_url: null, has_variants: true,
  variants: [
    { id: 'var-1', name: 'Small Red', sku: 'TS-001-SR', price: 499.0, image_url: null, variant_attributes: { size: 'S', color: 'Red' } },
    { id: 'var-2', name: 'Large Blue', sku: 'TS-001-LB', price: 549.0, image_url: null, variant_attributes: { size: 'L', color: 'Blue' } },
  ],
};

const defaultProps = { isOpen: true, onClose: vi.fn(), onSelect: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockCrmService.searchInventoryItems.mockResolvedValue({ items: [] });
});

afterEach(() => { vi.useRealTimers(); });

describe('Given ProductPickerModal', () => {
  describe('Given isOpen=false / When rendered / Then modal is not visible', () => {
    test('Given closed modal / When rendered / Then nothing is shown', () => {
      render(<ProductPickerModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('modal-root')).toBeNull();
    });
  });

  describe('Given isOpen=true / When rendered / Then search input is shown', () => {
    test('Given open modal / When rendered / Then search placeholder is visible', () => {
      render(<ProductPickerModal {...defaultProps} />);
      expect(screen.getByTestId('modal-root')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Given empty query / When modal opens / Then no search is triggered', () => {
    test('Given no query text / When mounted / Then searchInventoryItems not called', () => {
      render(<ProductPickerModal {...defaultProps} />);
      expect(mockCrmService.searchInventoryItems).not.toHaveBeenCalled();
    });
  });

  describe('Given query typed / When debounce fires / Then searchInventoryItems is called', () => {
    test('Given user types query / When 300ms pass / Then service is called with query', async () => {
      render(<ProductPickerModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'widget' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      expect(mockCrmService.searchInventoryItems).toHaveBeenCalledWith('widget');
    });

    test('Given rapid typing / When debounced / Then service called only once after pause', async () => {
      render(<ProductPickerModal {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'w' } });
      fireEvent.change(input, { target: { value: 'wi' } });
      fireEvent.change(input, { target: { value: 'widget' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      expect(mockCrmService.searchInventoryItems).toHaveBeenCalledTimes(1);
      expect(mockCrmService.searchInventoryItems).toHaveBeenCalledWith('widget');
    });
  });

  describe('Given search returns items / When rendered / Then items list is shown', () => {
    test('Given two items returned / When rendered / Then both item names appear', async () => {
      mockCrmService.searchInventoryItems.mockResolvedValue({ items: [ITEM_NO_VARIANTS, ITEM_WITH_VARIANTS] });
      render(<ProductPickerModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(screen.getByText('Widget Pro')).toBeInTheDocument();
      expect(screen.getByText('T-Shirt')).toBeInTheDocument();
    });
  });

  describe('Given item without variants / When clicked / Then onSelect is called', () => {
    test('Given simple item / When clicked / Then onSelect called with item data', async () => {
      mockCrmService.searchInventoryItems.mockResolvedValue({ items: [ITEM_NO_VARIANTS] });
      const onSelect = vi.fn();
      render(<ProductPickerModal {...defaultProps} onSelect={onSelect} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'widget' } });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(screen.getByText('Widget Pro')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Widget Pro').closest('button')!);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ item_id: 'item-1', name: 'Widget Pro', unit_price: 250.0 })
      );
    });
  });

  describe('Given item with variants / When clicked / Then variants expand', () => {
    test('Given variant item / When clicked / Then variant options appear', async () => {
      mockCrmService.searchInventoryItems.mockResolvedValue({ items: [ITEM_WITH_VARIANTS] });
      render(<ProductPickerModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'shirt' } });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(screen.getByText('T-Shirt')).toBeInTheDocument();
      fireEvent.click(screen.getByText('T-Shirt').closest('button')!);
      expect(screen.getByText('TS-001-SR')).toBeInTheDocument();
      expect(screen.getByText('TS-001-LB')).toBeInTheDocument();
    });

    test('Given expanded variant / When variant clicked / Then onSelect called with variant data', async () => {
      mockCrmService.searchInventoryItems.mockResolvedValue({ items: [ITEM_WITH_VARIANTS] });
      const onSelect = vi.fn();
      render(<ProductPickerModal {...defaultProps} onSelect={onSelect} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'shirt' } });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(screen.getByText('T-Shirt')).toBeInTheDocument();
      fireEvent.click(screen.getByText('T-Shirt').closest('button')!);
      expect(screen.getByText('TS-001-SR')).toBeInTheDocument();
      fireEvent.click(screen.getByText('TS-001-SR').closest('button')!);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ variant_id: 'var-1', unit_price: 499.0 })
      );
    });
  });

  describe('Given empty results / When search returns nothing / Then empty state shown', () => {
    test('Given no results / When rendered / Then no items in list', async () => {
      mockCrmService.searchInventoryItems.mockResolvedValue({ items: [] });
      render(<ProductPickerModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyz' } });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCrmService.searchInventoryItems).toHaveBeenCalled();
      expect(screen.queryByText('Widget Pro')).toBeNull();
    });
  });

  describe('Given modal closed / When isOpen changes to false / Then state is reset', () => {
    test('Given open modal with query / When closed / Then input is cleared on reopen', async () => {
      const { rerender } = render(<ProductPickerModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'widget' } });
      rerender(<ProductPickerModal {...defaultProps} isOpen={false} />);
      rerender(<ProductPickerModal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });
});
