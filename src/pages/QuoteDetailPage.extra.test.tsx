/**
 * Extra coverage tests for QuoteDetailPage — targeting the editing workflow,
 * line-item management, modal flows (reject/convert), and error branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetQuoteById = vi.fn();
const mockUpdateQuote = vi.fn();
const mockSubmitQuoteForApproval = vi.fn();
const mockApproveQuote = vi.fn();
const mockRejectQuote = vi.fn();
const mockConvertQuoteToOrder = vi.fn();
const mockGetStockAvailability = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    updateQuote: (...a: any[]) => mockUpdateQuote(...a),
    submitQuoteForApproval: (...a: any[]) => mockSubmitQuoteForApproval(...a),
    approveQuote: (...a: any[]) => mockApproveQuote(...a),
    rejectQuote: (...a: any[]) => mockRejectQuote(...a),
    convertQuoteToOrder: (...a: any[]) => mockConvertQuoteToOrder(...a),
    getStockAvailability: (...a: any[]) => mockGetStockAvailability(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'q-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

import QuoteDetailPage from './QuoteDetailPage';

const draftQuote = {
  id: 'q-1', title: 'Test Quote', status: 'draft' as const,
  quote_number: 'Q-0001',
  grand_total: 5000, subtotal: 5000, tax_amount: 0, discount_amount: 0,
  valid_until: '2024-12-31', notes: 'Initial notes',
  terms_and_conditions: 'Net 30', created_at: '2024-01-01',
  lines: [
    { id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, item_id: 'i1', discount_percent: 0, tax_rate: 0 },
  ],
  deal: { id: 'd1', name: 'Deal 1', company_name: 'Acme Corp' },
  deal_id: 'd1',
  customer_name: 'Acme Corp',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuoteById.mockResolvedValue(draftQuote);
  mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'i1', available_quantity: 100 }] });
  mockUpdateQuote.mockResolvedValue(draftQuote);
  mockSubmitQuoteForApproval.mockResolvedValue({ ...draftQuote, status: 'pending_approval' });
  mockApproveQuote.mockResolvedValue({ ...draftQuote, status: 'approved' });
  mockRejectQuote.mockResolvedValue({ ...draftQuote, status: 'rejected' });
  mockConvertQuoteToOrder.mockResolvedValue({ order_id: 'o1' });
});

describe('Given QuoteDetailPage — editing workflow', () => {
  it('When action / Then shows title input when edit mode entered', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Test Quote')).toBeInTheDocument();
  });

  it('When action / Then shows valid until date input in edit mode', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
  });

  it('When action / Then shows notes textarea in edit mode', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Initial notes')).toBeInTheDocument();
  });

  it('When action / Then shows terms textarea in edit mode', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Net 30')).toBeInTheDocument();
  });

  it('When action / Then save button calls updateQuote API', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockUpdateQuote).toHaveBeenCalledWith('q-1', expect.objectContaining({ title: 'Test Quote' }));
    });
  });

  it('When action / Then cancel button exits edit mode without calling API', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    // Edit button contains an icon + text — use getAllByText to get the "Edit" text node
    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]);
    // Now in edit mode — Cancel button appears
    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockUpdateQuote).not.toHaveBeenCalled();
    // Edit button should be back
    await waitFor(() => expect(screen.getAllByText('Edit').length).toBeGreaterThan(0));
  });

  it('When action / Then Add Line button adds a new empty row in edit mode', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getByText('Edit'));
    const beforeCount = screen.getAllByPlaceholderText('Item description...').length;
    fireEvent.click(screen.getByText('Add Line'));
    const afterCount = screen.getAllByPlaceholderText('Item description...').length;
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('When action / Then quantity field is editable in edit mode', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    fireEvent.click(screen.getAllByText('Edit')[0]);
    await waitFor(() => {
      const qtyInputs = screen.getAllByDisplayValue('2');
      expect(qtyInputs.length).toBeGreaterThan(0);
    });
  });
});

describe('Given QuoteDetailPage — quote number display', () => {
  it('When action / Then shows quote number in header', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Q-0001')).toBeInTheDocument();
    });
  });
});

describe('Given QuoteDetailPage — reject modal', () => {
  it('When action / Then shows reject modal when Reject button is clicked on pending_approval', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'pending_approval' });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText(/reject/i));
    // Click the reject button (not the modal button)
    const rejectBtn = screen.getAllByText(/reject/i).find(el => el.tagName !== 'TEXTAREA');
    if (rejectBtn) fireEvent.click(rejectBtn);
    await waitFor(() => {
      expect(screen.getByText(/reason for rejection/i)).toBeInTheDocument();
    });
  });

  it('When action / Then cancel closes reject modal', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'pending_approval' });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText(/reject/i));
    const rejectBtn = screen.getAllByText(/reject/i).find(el => el.tagName !== 'TEXTAREA');
    if (rejectBtn) fireEvent.click(rejectBtn);
    await waitFor(() => screen.getByText(/reason for rejection/i));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText(/reason for rejection/i)).not.toBeInTheDocument();
    });
  });
});

describe('Given QuoteDetailPage — convert modal', () => {
  it('When action / Then shows convert modal when Convert to Order clicked on approved quote', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'approved' });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText(/convert to order/i));
    fireEvent.click(screen.getByText(/convert to order/i));
    await waitFor(() => {
      expect(screen.getByText(/convert to sales order/i)).toBeInTheDocument();
    });
  });

  it('When action / Then clicking Convert to Order in modal calls API', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'approved' });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText(/convert to order/i));
    fireEvent.click(screen.getByText(/convert to order/i));
    await waitFor(() => screen.getByText(/convert to sales order/i));
    // Find the confirm button inside modal
    const confirmBtn = screen.getAllByText(/convert to order/i)[1];
    if (confirmBtn) fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockConvertQuoteToOrder).toHaveBeenCalledWith('q-1');
    });
  });
});

describe('Given QuoteDetailPage — approve action', () => {
  it('When action / Then clicking Approve calls approveQuote and updates status', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'pending_approval' });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText(/approve/i));
    fireEvent.click(screen.getByText(/approve/i));
    await waitFor(() => {
      expect(mockApproveQuote).toHaveBeenCalledWith('q-1');
    });
  });
});

describe('Given QuoteDetailPage — totals section', () => {
  it('When action / Then shows subtotal, discount, tax and grand total', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    // "Total" appears in the table header and totals section — at least one should exist
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
  });
});

describe('Given QuoteDetailPage — no lines state', () => {
  it('When action / Then shows "No line items added yet" when lines are empty', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, lines: [] });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/no line items added yet/i)).toBeInTheDocument();
    });
  });

  it('When action / Then submit for approval button is disabled when there are no lines', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, lines: [] });
    render(<QuoteDetailPage />);
    await waitFor(() => screen.getByText('Test Quote'));
    const submitBtn = screen.queryByText(/submit for approval/i);
    // button should not exist since canSubmit = false (lines.length === 0)
    expect(submitBtn).not.toBeInTheDocument();
  });
});

describe('Given QuoteDetailPage — rejection reason display', () => {
  it('When action / Then shows rejection reason section when quote is rejected', async () => {
    mockGetQuoteById.mockResolvedValue({ ...draftQuote, status: 'rejected', rejection_reason: 'Price too high' });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Price too high')).toBeInTheDocument();
    });
  });
});

describe('Given QuoteDetailPage — error state', () => {
  it('When action / Then shows not found state when API throws', async () => {
    mockGetQuoteById.mockRejectedValue(new Error('Network error'));
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/quote not found/i)).toBeInTheDocument();
    });
  });
});

describe('Given QuoteDetailPage — stock indicators', () => {
  it('When action / Then shows OOS badge when stock is zero', async () => {
    mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'i1', available_quantity: 0 }] });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('OOS')).toBeInTheDocument();
    });
  });

  it('When action / Then shows low stock badge when stock less than quantity', async () => {
    mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'i1', available_quantity: 1 }] });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 avail/)).toBeInTheDocument();
    });
  });

  it('When action / Then shows sufficient stock badge when stock exceeds quantity', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/100 avail/)).toBeInTheDocument();
    });
  });
});
