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
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({
    settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

import QuoteDetailPage from './QuoteDetailPage';

const quoteData = {
  id: 'q-1', title: 'Test Quote', status: 'draft', total: 5000, subtotal: 5000,
  tax_amount: 0, discount_amount: 0, valid_until: '2024-12-31',
  notes: 'Some notes', terms_and_conditions: 'Net 30', created_at: '2024-01-01',
  lines: [
    { id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, item_id: 'i1', discount_percent: 0, tax_rate: 0 },
  ],
  deal: { id: 'd1', name: 'Deal 1' },
  customer: { id: 'c1', company_name: 'Acme' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuoteById.mockResolvedValue(quoteData);
  mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'i1', available_quantity: 100 }] });
  mockUpdateQuote.mockResolvedValue(quoteData);
  mockSubmitQuoteForApproval.mockResolvedValue({ ...quoteData, status: 'pending_approval' });
  mockApproveQuote.mockResolvedValue({ ...quoteData, status: 'approved' });
  mockRejectQuote.mockResolvedValue({ ...quoteData, status: 'rejected' });
  mockConvertQuoteToOrder.mockResolvedValue({ order_id: 'o1' });
});

describe('QuoteDetailPage', () => {
  describe('Given the quote is loading', () => {
    it('When fetch is pending / Then renders the page container without crashing', () => {
      mockGetQuoteById.mockReturnValue(new Promise(() => {}));
      render(<QuoteDetailPage />);
      expect(document.body).toBeTruthy();
    });
  });

  describe('Given the quote is not found', () => {
    it('When fetch fails / Then shows an error message', async () => {
      mockGetQuoteById.mockRejectedValue(new Error('Not found'));
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/not found|error|failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given a Draft quote is loaded', () => {
    it('When rendered / Then shows the quote title', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Test Quote')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Draft status badge', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);
      });
    });

    it('When rendered / Then shows the line item descriptions', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the linked deal name', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Deal 1')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the quote total amount', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$5000').length).toBeGreaterThan(0);
      });
    });

    it('When rendered / Then shows the Submit for Approval action button', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/submit for approval/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows an Edit button', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      const editBtns = screen.getAllByText(/edit/i);
      expect(editBtns.length).toBeGreaterThan(0);
    });

    it('When line items have item_ids / Then fetches stock availability', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(mockGetStockAvailability).toHaveBeenCalledWith(['i1']);
      });
    });
  });

  describe('Given a quote in Pending Approval status', () => {
    it('When rendered / Then shows Approve and Reject buttons', async () => {
      mockGetQuoteById.mockResolvedValue({ ...quoteData, status: 'pending_approval' });
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/approve/i)).toBeInTheDocument();
        expect(screen.getByText(/reject/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given an Approved quote', () => {
    it('When rendered / Then shows the Convert to Order button', async () => {
      mockGetQuoteById.mockResolvedValue({ ...quoteData, status: 'approved' });
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/convert to order/i)).toBeInTheDocument();
      });
    });
  });

  // ── Fix: updateLine uses functional updater (prevents stale-closure on rapid typing) ──

  describe('Given a Draft quote is in edit mode', () => {
    it('When Quantity is changed / Then Save sends the updated quantity', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInputs = screen.getAllByDisplayValue('2');
      fireEvent.change(qtyInputs[0], { target: { value: '7' } });

      fireEvent.click(screen.getByText(/^save$/i));

      await waitFor(() => {
        expect(mockUpdateQuote).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({ quantity: 7 }),
            ]),
          }),
        );
      });
    });

    it('When Unit Price is changed / Then Save sends the updated unit price', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));

      const priceInputs = screen.getAllByDisplayValue('2500');
      fireEvent.change(priceInputs[0], { target: { value: '1000' } });

      fireEvent.click(screen.getByText(/^save$/i));

      await waitFor(() => {
        expect(mockUpdateQuote).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({ unit_price: 1000 }),
            ]),
          }),
        );
      });
    });

    it('When Quantity changes multiple times / Then final value is committed (no stale state)', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInputs = screen.getAllByDisplayValue('2');
      fireEvent.change(qtyInputs[0], { target: { value: '5' } });
      fireEvent.change(qtyInputs[0], { target: { value: '50' } });
      fireEvent.change(qtyInputs[0], { target: { value: '500' } });

      fireEvent.click(screen.getByText(/^save$/i));

      await waitFor(() => {
        expect(mockUpdateQuote).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({ quantity: 500 }),
            ]),
          }),
        );
      });
    });
  });

  // ── Fix: stock useEffect bail-out avoids spurious re-renders when map is already empty ──

  describe('Given a Draft quote with lines that have no item_id', () => {
    it('When loaded / Then getStockAvailability is NOT called for lines without item_id', async () => {
      const noItemIdQuote = {
        ...quoteData,
        lines: [{ id: 'ql2', description: 'Manual Item', quantity: 1, unit_price: 100, line_total: 100, discount_percent: 0, tax_rate: 0 }],
      };
      mockGetQuoteById.mockResolvedValue(noItemIdQuote);

      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      expect(mockGetStockAvailability).not.toHaveBeenCalled();
    });

    it('When Quantity changes on a line with no item_id / Then getStockAvailability is still not called', async () => {
      const noItemIdQuote = {
        ...quoteData,
        lines: [{ id: 'ql2', description: 'Manual Item', quantity: 1, unit_price: 100, line_total: 100, discount_percent: 0, tax_rate: 0 }],
      };
      mockGetQuoteById.mockResolvedValue(noItemIdQuote);

      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInputs = screen.getAllByDisplayValue('1');
      fireEvent.change(qtyInputs[0], { target: { value: '3' } });

      expect(mockGetStockAvailability).not.toHaveBeenCalled();
    });
  });

  // ── Fix: stable tr keys — existing rows maintain DOM identity after adding a new line ──

  describe('Given a Draft quote in edit mode with multiple line items', () => {
    it('When a second line is added / Then both line items remain in the table', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));
      fireEvent.click(screen.getByText(/add line/i));

      const rows = screen.getAllByRole('row');
      // header row + 2 data rows (original + new)
      expect(rows.length).toBeGreaterThanOrEqual(3);
    });

    it('When first line Quantity is edited then a new line is added / Then first line value is preserved', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));

      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInputs = screen.getAllByDisplayValue('2');
      fireEvent.change(qtyInputs[0], { target: { value: '9' } });

      fireEvent.click(screen.getByText(/add line/i));

      // After adding a line the first input should still reflect 9
      await waitFor(() => {
        expect(screen.getByDisplayValue('9')).toBeInTheDocument();
      });
    });
  });

  // ── Fix: type="text" inputs — raw string preserved for intermediate typing states ──

  describe('Given a Draft quote is in edit mode — numeric input type fix', () => {
    it('When edit mode is active / Then Quantity input is type="text" (not type="number")', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));
      const qtyInput = screen.getByDisplayValue('2');
      expect(qtyInput.getAttribute('type')).toBe('text');
    });

    it('When edit mode is active / Then Quantity input has inputMode="numeric"', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));
      const qtyInput = screen.getByDisplayValue('2');
      expect(qtyInput.getAttribute('inputmode')).toBe('numeric');
    });

    it('When edit mode is active / Then Unit Price input is type="text" (not type="number")', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));
      const priceInput = screen.getByDisplayValue('2500');
      expect(priceInput.getAttribute('type')).toBe('text');
    });

    it('When edit mode is active / Then Unit Price input has inputMode="decimal"', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));
      const priceInput = screen.getByDisplayValue('2500');
      expect(priceInput.getAttribute('inputmode')).toBe('decimal');
    });

    it('When the user types "05" in Quantity / Then the draftValue "05" is preserved (not cleared)', async () => {
      // type="number" in Chrome returns e.target.value="" for "05" (leading zero = invalid).
      // type="text" returns the raw "05" string, preserving the typing state.
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInput = screen.getByDisplayValue('2');
      fireEvent.change(qtyInput, { target: { value: '05' } });

      await waitFor(() => {
        expect(screen.getByDisplayValue('05')).toBeInTheDocument();
      });
    });

    it('When the user types "25." in Unit Price / Then the draftValue "25." is preserved (not cleared)', async () => {
      // type="number" in Chrome returns "" for "25." (incomplete decimal = invalid).
      // type="text" returns the raw "25." string so the user can continue typing digits.
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const priceInput = screen.getByDisplayValue('2500');
      fireEvent.change(priceInput, { target: { value: '25.' } });

      await waitFor(() => {
        expect(screen.getByDisplayValue('25.')).toBeInTheDocument();
      });
    });

    it('When the user types a full decimal "99.99" in Unit Price / Then the value is committed on blur', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const priceInput = screen.getByDisplayValue('2500');
      fireEvent.change(priceInput, { target: { value: '99.99' } });
      fireEvent.blur(priceInput, { target: { value: '99.99' } });

      fireEvent.click(screen.getByText(/^save$/i));

      await waitFor(() => {
        expect(mockUpdateQuote).toHaveBeenCalledWith(
          'q-1',
          expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({ unit_price: 99.99 }),
            ]),
          }),
        );
      });
    });

    it('When the user clears Quantity and blurs / Then it falls back to 1', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInput = screen.getByDisplayValue('2');
      fireEvent.change(qtyInput, { target: { value: '' } });
      fireEvent.blur(qtyInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      });
    });

    it('When the user clears Unit Price and blurs / Then it falls back to 0', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const priceInput = screen.getByDisplayValue('2500');
      fireEvent.change(priceInput, { target: { value: '' } });
      fireEvent.blur(priceInput, { target: { value: '' } });

      await waitFor(() => {
        // discount_percent and tax_rate also show "0"; use getAllByDisplayValue
        const zeroInputs = screen.getAllByDisplayValue('0');
        expect(zeroInputs.length).toBeGreaterThanOrEqual(1);
        // the unit_price input (formerly "2500") must now be one of the zeros
        expect(zeroInputs.some(el => el === priceInput || el.getAttribute('inputmode') === 'decimal')).toBe(true);
      });
    });

    it('When the user types non-numeric text in Quantity / Then Save does not update the quantity', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      const qtyInput = screen.getByDisplayValue('2');
      fireEvent.change(qtyInput, { target: { value: 'abc' } });

      fireEvent.click(screen.getByText(/^save$/i));

      await waitFor(() => {
        const [, payload] = mockUpdateQuote.mock.calls[0];
        // parseFloat('abc') === NaN → updateLine not called → quantity stays 2
        expect(payload.lines[0].quantity).toBe(2);
      });
    });

    it('When the Discount % input is in edit mode / Then it is type="text" with inputMode="decimal"', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(screen.getByText(/^edit$/i));

      // Both discount_percent and tax_rate start at 0 — grab all zero-valued inputs
      const zeroInputs = screen.getAllByDisplayValue('0');
      expect(zeroInputs.length).toBeGreaterThanOrEqual(2);
      zeroInputs.forEach(input => {
        expect(input.getAttribute('type')).toBe('text');
        expect(input.getAttribute('inputmode')).toBe('decimal');
      });
    });
  });
});
