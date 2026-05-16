import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetDailystoreStores = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getDailystoreStores: (...a: any[]) => mockGetDailystoreStores(...a),
  },
}));

import { MarketingStorePicker } from './MarketingStorePicker';

const stores = [
  { id: 's1', name: 'Main Street Store', store_code: 'MS1', status: 'active' },
  { id: 's2', name: 'Downtown Store' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDailystoreStores.mockResolvedValue(stores);
});

describe('MarketingStorePicker', () => {
  describe('Given stores are loading', () => {
    it('When fetch is pending / Then shows loading option in select', () => {
      mockGetDailystoreStores.mockReturnValue(new Promise(() => {}));
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      expect(screen.getByText('Loading stores...')).toBeInTheDocument();
    });

    it('When fetch is pending / Then select is disabled', () => {
      mockGetDailystoreStores.mockReturnValue(new Promise(() => {}));
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('Given stores are loaded successfully', () => {
    it('When rendered / Then shows all store names', async () => {
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/main street store/i)).toBeInTheDocument();
        expect(screen.getByText(/downtown store/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows store code in the option text', async () => {
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/MS1/)).toBeInTheDocument();
      });
    });
  });

  describe('Given no storeId is set', () => {
    it('When stores load / Then auto-selects the first store', async () => {
      const onChange = vi.fn();
      render(<MarketingStorePicker storeId="" onChange={onChange} />);
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('s1');
      });
    });
  });

  describe('Given a storeId is already set', () => {
    it('When the user picks a different store / Then calls onChange with the new store id', async () => {
      const onChange = vi.fn();
      render(<MarketingStorePicker storeId="s1" onChange={onChange} />);
      await waitFor(() => screen.getByText(/main street store/i));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 's2' } });
      expect(onChange).toHaveBeenCalledWith('s2');
    });
  });

  describe('Given the store list is empty', () => {
    it('When stores load empty / Then shows no stores message', async () => {
      mockGetDailystoreStores.mockResolvedValue([]);
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('No stores found')).toBeInTheDocument();
      });
    });
  });

  describe('Given the store fetch fails', () => {
    it('When fetch throws an error / Then shows the error message', async () => {
      mockGetDailystoreStores.mockRejectedValue(new Error('Network error'));
      render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });
});
