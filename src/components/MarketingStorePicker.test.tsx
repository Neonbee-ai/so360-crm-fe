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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDailystoreStores.mockResolvedValue([
    { id: 's1', name: 'Store 1', store_code: 'S1', status: 'active' },
    { id: 's2', name: 'Store 2' },
  ]);
});

describe('MarketingStorePicker', () => {
  it('shows loading state', () => {
    mockGetDailystoreStores.mockReturnValue(new Promise(() => {}));
    render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
    expect(screen.getByText('Loading stores...')).toBeInTheDocument();
  });

  it('renders stores after loading', async () => {
    render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Store 1/)).toBeInTheDocument();
    });
  });

  it('calls onChange when selection changes', async () => {
    const onChange = vi.fn();
    render(<MarketingStorePicker storeId="s1" onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByText(/Store 1/)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's2' } });
    expect(onChange).toHaveBeenCalledWith('s2');
  });

  it('auto-selects first store when storeId is empty', async () => {
    const onChange = vi.fn();
    render(<MarketingStorePicker storeId="" onChange={onChange} />);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('s1');
    });
  });

  it('shows error when fetch fails', async () => {
    mockGetDailystoreStores.mockRejectedValue(new Error('Network error'));
    render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/network error|failed/i)).toBeInTheDocument();
    });
  });

  it('shows no stores message', async () => {
    mockGetDailystoreStores.mockResolvedValue([]);
    render(<MarketingStorePicker storeId="" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('No stores found')).toBeInTheDocument();
    });
  });
});
