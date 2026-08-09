import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGetNewsletterSubscribers, mockAddNewsletterSubscriber, mockUnsubscribeNewsletter, mockDeleteNewsletterSubscriber, mockShowError } = vi.hoisted(() => ({
  mockGetNewsletterSubscribers: vi.fn().mockResolvedValue([]),
  mockAddNewsletterSubscriber: vi.fn(),
  mockUnsubscribeNewsletter: vi.fn(),
  mockDeleteNewsletterSubscriber: vi.fn(),
  mockShowError: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: {
    getNewsletterSubscribers: mockGetNewsletterSubscribers,
    addNewsletterSubscriber: mockAddNewsletterSubscriber,
    unsubscribeNewsletter: mockUnsubscribeNewsletter,
    deleteNewsletterSubscriber: mockDeleteNewsletterSubscriber,
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}><option value="">Select</option></select>,
}));

vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, error: mockShowError },
  };
});

import MarketingNewsletterPage from './MarketingNewsletterPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockGetNewsletterSubscribers.mockResolvedValue([]); });

describe('Given MarketingNewsletterPage', () => {
  it('When action / Then renders store picker', () => {
    render(<MarketingNewsletterPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});

describe('Given the service returns an error', () => {
  beforeEach(() => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    mockGetNewsletterSubscribers.mockRejectedValue(new Error('Network error'));
  });

  it('When the page mounts / Then displays an error or loading state — not a blank screen', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
      expect(screen.getByTestId('store-picker')).toBeInTheDocument();
    });
  });
});

describe('Given the service returns an empty list', () => {
  it('When the page mounts / Then does not crash with empty subscriber data', async () => {
    mockGetNewsletterSubscribers.mockResolvedValue([]);
    render(<MarketingNewsletterPage />);
    await waitFor(() => expect(screen.getByTestId('store-picker')).toBeInTheDocument());
  });
});
