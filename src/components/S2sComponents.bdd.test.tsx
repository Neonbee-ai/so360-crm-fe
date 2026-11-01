import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const grouped = vi.fn();
const list = vi.fn();
const renderDoc = vi.fn();
vi.mock('../services/coreS2sService', () => ({
  QUOTE_DOC_TYPE: 'sales_quote',
  contactFeed: { grouped: (...a: any[]) => grouped(...a) },
  priceLists: { list: (...a: any[]) => list(...a) },
  documentLayouts: { render: (...a: any[]) => renderDoc(...a) },
}));

import { ContactFeedPanel } from './ContactFeedPanel';
import { PriceListSelect } from './PriceListSelect';
import { QuotePreviewModal } from './QuotePreviewModal';

beforeEach(() => vi.clearAllMocks());

describe('Given the Contact 360 panel', () => {
  describe('When the customer has linked records', () => {
    it('Then each group shows its label, count and items', async () => {
      grouped.mockResolvedValue({ total: 1, groups: { sales_order: { count: 1, items: [{ id: 'abcdef123456', rel: 'placed_by' }, { id: 'zz', }] } } });
      render(<ContactFeedPanel entityType="lead" entityId="l1" />);
      await waitFor(() => screen.getByText('Sales order'));
      expect(grouped).toHaveBeenCalledWith('lead', 'l1');
      expect(screen.getByText(/placed by · abcdef12/)).toBeInTheDocument();
    });
  });
  describe('When there is nothing linked', () => {
    it('Then the empty state is shown', async () => {
      grouped.mockResolvedValue({ total: 0, groups: {} });
      render(<ContactFeedPanel entityType="lead" entityId="l1" />);
      await waitFor(() => screen.getByText('No linked activity yet'));
    });
  });
});

describe('Given the price list select', () => {
  describe('When lists load and one is chosen', () => {
    it('Then onChange receives the id', async () => {
      list.mockResolvedValue([{ id: 'p1', name: 'Gold' }]);
      const onChange = vi.fn();
      render(<PriceListSelect value="" onChange={onChange} customerId="c1" />);
      await waitFor(() => expect(list).toHaveBeenCalledWith('c1'));
      await waitFor(() => screen.getByText('Gold'));
      fireEvent.change(screen.getByLabelText('Price list'), { target: { value: 'p1' } });
      expect(onChange).toHaveBeenCalledWith('p1');
    });
  });
});

describe('Given the quote preview modal', () => {
  describe('When Core renders HTML', () => {
    it('Then it is shown in a fully sandboxed iframe', async () => {
      renderDoc.mockResolvedValue('<p>Quote</p>');
      render(<QuotePreviewModal isOpen onClose={vi.fn()} document={{ number: 'Q1' }} />);
      const frame = await waitFor(() => screen.getByTitle('Quote preview', { selector: 'iframe' }));
      expect(frame.getAttribute('sandbox')).toBe('');
      expect(renderDoc).toHaveBeenCalledWith('sales_quote', { number: 'Q1' });
    });
  });
  describe('When rendering fails', () => {
    it('Then the unavailable empty state is shown', async () => {
      renderDoc.mockResolvedValue(null);
      render(<QuotePreviewModal isOpen onClose={vi.fn()} document={{}} />);
      await waitFor(() => screen.getByText('Preview unavailable'));
    });
  });
  describe('When closed', () => {
    it('Then nothing is rendered', () => {
      render(<QuotePreviewModal isOpen={false} onClose={vi.fn()} document={{}} />);
      expect(renderDoc).not.toHaveBeenCalled();
    });
  });
});
