import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getNewsletterSubscribers: vi.fn().mockResolvedValue([]),
    addNewsletterSubscriber: vi.fn(),
    unsubscribeNewsletter: vi.fn(),
    deleteNewsletterSubscriber: vi.fn(),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}><option value="">Select</option></select>,
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

import MarketingNewsletterPage from './MarketingNewsletterPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('MarketingNewsletterPage', () => {
  it('renders store picker', () => {
    render(<MarketingNewsletterPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});
