import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetSubscribers = vi.fn();
const mockAddSubscriber = vi.fn();
const mockUnsubscribe = vi.fn();
const mockDeleteSubscriber = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getNewsletterSubscribers: (...a: any[]) => mockGetSubscribers(...a),
    addNewsletterSubscriber: (...a: any[]) => mockAddSubscriber(...a),
    unsubscribeNewsletter: (...a: any[]) => mockUnsubscribe(...a),
    deleteNewsletterSubscriber: (...a: any[]) => mockDeleteSubscriber(...a),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => (
    <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}>
      <option value="">Select</option>
      <option value="store-1">Store 1</option>
    </select>
  ),
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

import MarketingNewsletterPage from './MarketingNewsletterPage';

const makeSubscribers = () => [
  { id: 's1', email: 'alice@example.com', source: 'Web', subscribed_at: '2026-01-01', unsubscribed_at: null },
  { id: 's2', email: 'bob@example.com', source: 'Manual', subscribed_at: '2026-01-05', unsubscribed_at: '2026-02-01' },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetSubscribers.mockResolvedValue(makeSubscribers());
  mockAddSubscriber.mockResolvedValue({});
  mockUnsubscribe.mockResolvedValue({});
  mockDeleteSubscriber.mockResolvedValue({});
});

describe('MarketingNewsletterPage', () => {
  describe('Given no store is selected', () => {
    it('When rendered / Then shows empty subscriber list', () => {
      render(<MarketingNewsletterPage />);
      expect(screen.getByText(/No subscribers found/)).toBeInTheDocument();
    });

    it('When rendered / Then add button is disabled without store and email', () => {
      render(<MarketingNewsletterPage />);
      const addBtns = screen.getAllByText(/Add Subscriber/);
      const btn = addBtns.find(el => el.closest('button')?.disabled);
      expect(btn?.closest('button')).toBeDisabled();
    });
  });

  describe('Given a store is selected', () => {
    it('When store is picked / Then loads subscribers from API', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockGetSubscribers).toHaveBeenCalledWith('store-1'));
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    it('When subscribers load / Then active subscriber shows Active badge', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument());
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('When subscribers load / Then unsubscribed subscriber shows Unsubscribed badge', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('bob@example.com')).toBeInTheDocument());
      expect(screen.getByText('Unsubscribed')).toBeInTheDocument();
    });

    it('When search is typed / Then filters subscribers by email', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Search email...');
      await userEvent.type(searchInput, 'alice');
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });

    it('When subscriber count renders / Then shows correct filtered count', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument());
      expect(screen.getByText(/Subscriber List \(2\)/)).toBeInTheDocument();
    });
  });

  describe('Given add subscriber flow', () => {
    it('When email entered and add clicked / Then calls API and shows success', async () => {
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockGetSubscribers).toHaveBeenCalled());
      const emailInput = screen.getByPlaceholderText('customer@example.com');
      await userEvent.type(emailInput, 'new@example.com');
      const addBtns = screen.getAllByText(/Add Subscriber/);
      const btn = addBtns.find(el => el.closest('button') && !el.closest('button')?.disabled)?.closest('button');
      fireEvent.click(btn!);
      await waitFor(() => expect(mockAddSubscriber).toHaveBeenCalledWith('store-1', { email: 'new@example.com' }));
      expect(mockShowSuccess).toHaveBeenCalledWith('Subscriber added successfully');
    });

    it('When add fails / Then shows error toast', async () => {
      mockAddSubscriber.mockRejectedValue(new Error('Duplicate email'));
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockGetSubscribers).toHaveBeenCalled());
      const emailInput = screen.getByPlaceholderText('customer@example.com');
      await userEvent.type(emailInput, 'new@example.com');
      const addBtns2 = screen.getAllByText(/Add Subscriber/);
      const btn2 = addBtns2.find(el => el.closest('button') && !el.closest('button')?.disabled)?.closest('button');
      fireEvent.click(btn2!);
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Duplicate email'));
    });
  });

  describe('Given subscriber load fails', () => {
    it('When API errors / Then shows error toast', async () => {
      mockGetSubscribers.mockRejectedValue(new Error('Network failure'));
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Network failure'));
    });
  });

  describe('Given loading state', () => {
    it('When subscribers are loading / Then shows loading indicator', async () => {
      mockGetSubscribers.mockReturnValue(new Promise(() => {}));
      render(<MarketingNewsletterPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/Fetching audience/)).toBeInTheDocument());
    });
  });
});
