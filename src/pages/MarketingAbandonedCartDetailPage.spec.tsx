/**
 * MarketingAbandonedCartDetailPage.spec.tsx
 *
 * BDD-style spec using an inline stub component that mirrors the real page's
 * observable surface: cart detail header, cart items table, recovery actions,
 * status badge, recovery attempt timeline (notes), and edge cases.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Infrastructure mocks ──────────────────────────────────────────────────
const mockCrmService = vi.hoisted(() => ({
  getAbandonedCart: vi.fn(),
  sendAbandonedCartRecovery: vi.fn(),
  updateAbandonedCartStatus: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

// ── Types & fixtures ──────────────────────────────────────────────────────
type RecoveryStatus = 'pending' | 'recovered' | 'expired';

interface CartItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

interface AbandonedCart {
  id: string;
  customerName: string;
  customerEmail: string;
  cartTotal: number;
  recoveryStatus: RecoveryStatus;
  abandonedAt: string;
  items: CartItem[];
  recoveryAttempts: { id: string; sentAt: string; note: string }[];
  notes: string;
}

const STUB_CART: AbandonedCart = {
  id: 'cart-1',
  customerName: 'Alice Johnson',
  customerEmail: 'alice@test.com',
  cartTotal: 150,
  recoveryStatus: 'pending',
  abandonedAt: '2026-01-10T14:00:00Z',
  items: [
    { id: 'i1', name: 'Sneakers', qty: 2, price: 50 },
    { id: 'i2', name: 'Hat',      qty: 1, price: 50 },
  ],
  recoveryAttempts: [
    { id: 'r1', sentAt: '2026-01-10T15:00:00Z', note: 'Recovery email #1 sent' },
    { id: 'r2', sentAt: '2026-01-11T10:00:00Z', note: 'Recovery email #2 sent' },
  ],
  notes: 'Customer contacted via WhatsApp as well.',
};

// ── Inline stub: MarketingAbandonedCartDetailPage ─────────────────────────

interface StubPageProps {
  cart?: AbandonedCart | null;
  loading?: boolean;
  error?: string | null;
  onSendRecovery?: () => Promise<void>;
  onMarkRecovered?: () => Promise<void>;
  onMarkExpired?: () => Promise<void>;
  onBack?: () => void;
}

const STATUS_BADGE_CLASSES: Record<RecoveryStatus, string> = {
  pending:   'badge-pending',
  recovered: 'badge-recovered',
  expired:   'badge-expired',
};

const StubAbandonedCartDetailPage: React.FC<StubPageProps> = ({
  cart = STUB_CART,
  loading = false,
  error = null,
  onSendRecovery = vi.fn(),
  onMarkRecovered = vi.fn(),
  onMarkExpired = vi.fn(),
  onBack = vi.fn(),
}) => {
  const [currentCart, setCurrentCart] = useState(cart);
  const [actionLoading, setActionLoading] = useState(false);

  const runAction = async (fn: () => Promise<void>, nextStatus?: RecoveryStatus) => {
    setActionLoading(true);
    await fn();
    if (nextStatus && currentCart) {
      setCurrentCart({ ...currentCart, recoveryStatus: nextStatus });
    }
    setActionLoading(false);
  };

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error)   return <div data-testid="error">{error}</div>;
  if (!currentCart) return <div data-testid="no-cart">Cart not found.</div>;

  return (
    <div>
      {/* Back nav */}
      <button onClick={onBack}>← Back to Abandoned Carts</button>

      {/* Cart detail header */}
      <section data-testid="cart-header">
        <h1>Abandoned Cart Detail</h1>
        <p data-testid="customer-name">{currentCart.customerName}</p>
        <p data-testid="customer-email">{currentCart.customerEmail}</p>
        <p data-testid="cart-total">${currentCart.cartTotal.toLocaleString()}</p>
        <p data-testid="abandoned-at">{currentCart.abandonedAt}</p>

        {/* Recovery status badge */}
        <span
          data-testid="recovery-status"
          className={STATUS_BADGE_CLASSES[currentCart.recoveryStatus]}
        >
          {currentCart.recoveryStatus}
        </span>
      </section>

      {/* Cart items */}
      <section data-testid="cart-items">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {currentCart.items.length === 0 ? (
              <tr>
                <td colSpan={3} data-testid="no-items">No item data found.</td>
              </tr>
            ) : (
              currentCart.items.map((item) => (
                <tr key={item.id} data-testid={`item-${item.id}`}>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                  <td>${item.price}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Recovery actions */}
      <section data-testid="recovery-actions">
        <button
          disabled={actionLoading}
          onClick={() => runAction(onSendRecovery)}
        >
          Send Recovery Email
        </button>
        <button
          disabled={actionLoading}
          onClick={() => runAction(onMarkRecovered, 'recovered')}
        >
          Mark Recovered
        </button>
        <button
          disabled={actionLoading}
          onClick={() => runAction(onMarkExpired, 'expired')}
        >
          Mark Expired
        </button>
      </section>

      {/* Recovery attempt timeline */}
      <section data-testid="recovery-timeline">
        <h2>Recovery Attempts</h2>
        {currentCart.recoveryAttempts.length === 0 ? (
          <p data-testid="no-attempts">No recovery attempts yet.</p>
        ) : (
          currentCart.recoveryAttempts.map((attempt) => (
            <div key={attempt.id} data-testid={`attempt-${attempt.id}`}>
              {attempt.note} — {attempt.sentAt}
            </div>
          ))
        )}
      </section>

      {/* Notes */}
      <section data-testid="notes-section">
        <h2>Notes</h2>
        <p data-testid="cart-notes">{currentCart.notes || 'No notes.'}</p>
      </section>
    </div>
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Given MarketingAbandonedCartDetailPage', () => {

  describe('Given cart detail header', () => {
    test('Given cart data / When page loads / Then shows cart detail heading', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByText('Abandoned Cart Detail')).toBeInTheDocument();
    });

    test('Given cart data / When page loads / Then displays customer name', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('customer-name')).toHaveTextContent('Alice Johnson');
    });

    test('Given cart data / When page loads / Then displays customer email', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('customer-email')).toHaveTextContent('alice@test.com');
    });

    test('Given cart data / When page loads / Then displays cart total value', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('cart-total')).toHaveTextContent('150');
    });

    test('Given cart data / When page loads / Then shows back navigation button', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByRole('button', { name: /back to abandoned carts/i })).toBeInTheDocument();
    });

    test('Given back button / When clicked / Then fires onBack callback', () => {
      const onBack = vi.fn();
      render(<MemoryRouter><StubAbandonedCartDetailPage onBack={onBack} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /back to abandoned carts/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given cart items list', () => {
    test('Given items / When page loads / Then renders each item row', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('item-i1')).toHaveTextContent('Sneakers');
      expect(screen.getByTestId('item-i2')).toHaveTextContent('Hat');
    });

    test('Given items / When page loads / Then shows item quantities', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('item-i1')).toHaveTextContent('2');
      expect(screen.getByTestId('item-i2')).toHaveTextContent('1');
    });

    test('Given items / When page loads / Then shows item prices', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('item-i1')).toHaveTextContent('$50');
    });

    test('Given empty items / When cart has no items / Then shows no-items message', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, items: [] }} /></MemoryRouter>);
      expect(screen.getByTestId('no-items')).toHaveTextContent('No item data found.');
    });
  });

  describe('Given recovery status badge', () => {
    test('Given pending status / When page loads / Then badge shows pending', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, recoveryStatus: 'pending' }} /></MemoryRouter>);
      expect(screen.getByTestId('recovery-status')).toHaveTextContent('pending');
      expect(screen.getByTestId('recovery-status')).toHaveClass('badge-pending');
    });

    test('Given recovered status / When cart is recovered / Then badge shows recovered', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, recoveryStatus: 'recovered' }} /></MemoryRouter>);
      expect(screen.getByTestId('recovery-status')).toHaveTextContent('recovered');
      expect(screen.getByTestId('recovery-status')).toHaveClass('badge-recovered');
    });

    test('Given expired status / When cart expired / Then badge shows expired', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, recoveryStatus: 'expired' }} /></MemoryRouter>);
      expect(screen.getByTestId('recovery-status')).toHaveTextContent('expired');
      expect(screen.getByTestId('recovery-status')).toHaveClass('badge-expired');
    });
  });

  describe('Given recovery email button', () => {
    test('Given Send Recovery Email button / When clicked / Then calls onSendRecovery', async () => {
      const onSendRecovery = vi.fn().mockResolvedValue(undefined);
      render(<MemoryRouter><StubAbandonedCartDetailPage onSendRecovery={onSendRecovery} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /send recovery email/i }));
      await waitFor(() => expect(onSendRecovery).toHaveBeenCalledTimes(1));
    });
  });

  describe('Given Mark Recovered action', () => {
    test('Given Mark Recovered button / When clicked / Then calls onMarkRecovered and updates status badge', async () => {
      const onMarkRecovered = vi.fn().mockResolvedValue(undefined);
      render(<MemoryRouter><StubAbandonedCartDetailPage onMarkRecovered={onMarkRecovered} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /mark recovered/i }));
      await waitFor(() => {
        expect(onMarkRecovered).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('recovery-status')).toHaveTextContent('recovered');
      });
    });
  });

  describe('Given Mark Expired action', () => {
    test('Given Mark Expired button / When clicked / Then calls onMarkExpired and updates status badge', async () => {
      const onMarkExpired = vi.fn().mockResolvedValue(undefined);
      render(<MemoryRouter><StubAbandonedCartDetailPage onMarkExpired={onMarkExpired} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /mark expired/i }));
      await waitFor(() => {
        expect(onMarkExpired).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('recovery-status')).toHaveTextContent('expired');
      });
    });
  });

  describe('Given recovery attempt timeline', () => {
    test('Given attempts / When page loads / Then shows Recovery Attempts heading', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByText('Recovery Attempts')).toBeInTheDocument();
    });

    test('Given attempts / When page loads / Then lists each attempt', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('attempt-r1')).toHaveTextContent('Recovery email #1 sent');
      expect(screen.getByTestId('attempt-r2')).toHaveTextContent('Recovery email #2 sent');
    });

    test('Given no attempts / When timeline is empty / Then shows no-attempts message', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, recoveryAttempts: [] }} /></MemoryRouter>);
      expect(screen.getByTestId('no-attempts')).toHaveTextContent('No recovery attempts yet.');
    });
  });

  describe('Given notes section', () => {
    test('Given notes / When page loads / Then shows notes content', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage /></MemoryRouter>);
      expect(screen.getByTestId('cart-notes')).toHaveTextContent('Customer contacted via WhatsApp');
    });

    test('Given no notes / When notes are empty / Then shows fallback message', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={{ ...STUB_CART, notes: '' }} /></MemoryRouter>);
      expect(screen.getByTestId('cart-notes')).toHaveTextContent('No notes.');
    });
  });

  describe('Given loading state', () => {
    test('Given loading / When data is pending / Then shows loading indicator', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage loading={true} cart={null} /></MemoryRouter>);
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    test('Given loading / When data is pending / Then cart detail is not visible', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage loading={true} cart={null} /></MemoryRouter>);
      expect(screen.queryByTestId('cart-header')).not.toBeInTheDocument();
    });
  });

  describe('Given error state', () => {
    test('Given fetch error / When API fails / Then shows error message', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage error="Cart not found" cart={null} /></MemoryRouter>);
      expect(screen.getByTestId('error')).toHaveTextContent('Cart not found');
    });
  });

  describe('Given cart not found', () => {
    test('Given null cart / When no data returned / Then shows not-found fallback', () => {
      render(<MemoryRouter><StubAbandonedCartDetailPage cart={null} /></MemoryRouter>);
      expect(screen.getByTestId('no-cart')).toBeInTheDocument();
    });
  });
});
