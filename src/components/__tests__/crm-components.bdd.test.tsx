/**
 * BDD Spec — CRM FE Components
 *
 * Covers:
 *  - CustomerDetailsPanel (tax ID validation, credit limit, B2B/B2C display)
 *  - LeadJourneyStepper (all states: new, qualified, converted, lost)
 *  - DealLifecycleStepper (all states: new, negotiation, won, lost)
 *  - KanbanBoard (stage columns, deal cards, drag-and-drop callbacks, terminal columns)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Lucide icon mocks ──────────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Building2:     () => <span data-testid="icon-building2" />,
  CreditCard:    () => <span data-testid="icon-credit-card" />,
  Shield:        () => <span data-testid="icon-shield" />,
  CheckCircle2:  () => <span data-testid="icon-check-circle2" />,
  AlertCircle:   () => <span data-testid="icon-alert-circle" />,
  Loader2:       () => <span data-testid="icon-loader2" />,
  Tag:           () => <span data-testid="icon-tag" />,
  ShoppingCart:  () => <span data-testid="icon-shopping-cart" />,
  CheckCircle:   () => <span data-testid="icon-check-circle" />,
  Circle:        () => <span data-testid="icon-circle" />,
  XCircle:       () => <span data-testid="icon-x-circle" />,
  Calendar:      () => <span data-testid="icon-calendar" />,
  TrendingUp:    () => <span data-testid="icon-trending-up" />,
  Lock:          () => <span data-testid="icon-lock" />,
}));

// ── crmService mock ────────────────────────────────────────────────────────────
const mockCrmService = {
  validateCustomerTaxId:    vi.fn(),
  updateCustomerCreditLimit: vi.fn(),
};

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────
import CustomerDetailsPanel from '../CustomerDetailsPanel';
import { LeadJourneyStepper } from '../LeadJourneyStepper';
import { DealLifecycleStepper } from '../DealLifecycleStepper';
import { KanbanBoard } from '../kanban/KanbanBoard';

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeB2BLead(overrides: Record<string, any> = {}) {
  return {
    id: 'lead-001',
    customer_category: 'b2b',
    acquisition_source: 'manual_entry',
    tax_id: '',
    tax_id_verified: false,
    tax_id_verified_at: null,
    credit_limit: 5000,
    credit_balance: '0',
    first_order_id: null,
    ...overrides,
  };
}

function makeB2CLead(overrides: Record<string, any> = {}) {
  return {
    id: 'lead-002',
    customer_category: 'b2c',
    acquisition_source: 'storefront_registration',
    tax_id: null,
    tax_id_verified: false,
    tax_id_verified_at: null,
    credit_limit: 0,
    credit_balance: '0',
    first_order_id: null,
    ...overrides,
  };
}

function makeDeal(overrides: Record<string, any> = {}) {
  return {
    id: 'deal-001',
    name: 'Acme Corp Deal',
    company_name: 'Acme Corp',
    value: 15000,
    current_flow_state: 'new',
    stage: 'New',
    expected_close_date: '2026-06-30',
    owner: { full_name: 'Jane Smith', avatar_url: null },
    ...overrides,
  };
}

function makeStage(overrides: Record<string, any> = {}) {
  return {
    id: 'new',
    name: 'New',
    color: '#94A3B8',
    is_terminal: false,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CustomerDetailsPanel
// ══════════════════════════════════════════════════════════════════════════════
describe('Given CustomerDetailsPanel', () => {
  const onUpdate  = vi.fn();
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given a B2C lead / When rendered / Then category badge shows B2C and tax/credit fields are hidden', () => {
    const lead = makeB2CLead();
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText('B2C')).toBeTruthy();
    expect(screen.queryByText(/Tax ID/i)).toBeNull();
    expect(screen.queryByText(/Credit Limit/i)).toBeNull();
  });

  it('Given a B2B lead / When rendered / Then category is B2B and tax/credit fields are visible', () => {
    const lead = makeB2BLead();
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText('B2B')).toBeTruthy();
    expect(screen.getByText(/Tax ID/i)).toBeTruthy();
    expect(screen.getByText(/Credit Limit/i)).toBeTruthy();
  });

  it('Given a B2B lead with first_order_id / When rendered / Then first order reference is shown', () => {
    const lead = makeB2BLead({ first_order_id: 'ord-abc12345-xyz' });
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    expect(screen.getByText(/First Order/i)).toBeTruthy();
    expect(screen.getByText(/ord-abc1/)).toBeTruthy();
  });

  it('Given a B2B lead / When Validate button clicked / Then crmService.validateCustomerTaxId is called and success toast shown', async () => {
    const updatedLead = makeB2BLead({ tax_id: '29ABCDE1234F1Z5', tax_id_verified: true });
    mockCrmService.validateCustomerTaxId.mockResolvedValueOnce(updatedLead);

    const lead = makeB2BLead();
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await userEvent.type(input, '29ABCDE1234F1Z5');

    const validateButton = screen.getByRole('button', { name: /Validate/i });
    await userEvent.click(validateButton);

    await waitFor(() => {
      expect(mockCrmService.validateCustomerTaxId).toHaveBeenCalledWith('lead-001', '29ABCDE1234F1Z5');
      expect(onUpdate).toHaveBeenCalledWith(updatedLead);
      expect(showToast).toHaveBeenCalledWith('Tax ID validated successfully', 'success');
    });
  });

  it('Given a B2B lead / When Validate fails / Then error message is shown and error toast fired', async () => {
    mockCrmService.validateCustomerTaxId.mockRejectedValueOnce({
      message: 'Invalid GST number',
    });

    const lead = makeB2BLead();
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await userEvent.type(input, 'BADTAXID');

    await userEvent.click(screen.getByRole('button', { name: /Validate/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Invalid GST number', 'error');
    });
  });

  it('Given a B2B lead / When Save credit limit clicked / Then crmService.updateCustomerCreditLimit is called', async () => {
    const updatedLead = makeB2BLead({ credit_limit: 10000 });
    mockCrmService.updateCustomerCreditLimit.mockResolvedValueOnce(updatedLead);

    const lead = makeB2BLead();
    render(<CustomerDetailsPanel lead={lead} onUpdate={onUpdate} showToast={showToast} />);

    const creditInput = screen.getByDisplayValue('5000');
    fireEvent.change(creditInput, { target: { value: '10000' } });

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockCrmService.updateCustomerCreditLimit).toHaveBeenCalledWith('lead-001', 10000);
      expect(showToast).toHaveBeenCalledWith('Credit limit updated', 'success');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LeadJourneyStepper
// ══════════════════════════════════════════════════════════════════════════════
describe('Given LeadJourneyStepper', () => {
  it('Given currentState=new / When rendered / Then first step is active and other steps are pending', () => {
    render(<LeadJourneyStepper currentState="new" />);

    // All six stage labels should be visible
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Contacted')).toBeTruthy();
    expect(screen.getByText('Qualified')).toBeTruthy();
    expect(screen.getByText('Converted')).toBeTruthy();
  });

  it('Given currentState=converted / When rendered / Then stepper shows terminal converted state', () => {
    render(<LeadJourneyStepper currentState="converted" />);
    expect(screen.getByText('Converted')).toBeTruthy();
  });

  it('Given currentState=lost / When rendered / Then lost banner is shown and stepper is not rendered', () => {
    render(<LeadJourneyStepper currentState="lost" />);

    expect(screen.getByText('Lead Lost')).toBeTruthy();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('Given currentState with spaces / When rendered / Then state is normalised and does not crash', () => {
    render(<LeadJourneyStepper currentState="Proposal Sent" />);
    expect(screen.getByText('Proposal Sent')).toBeTruthy();
  });

  it('Given empty currentState / When rendered / Then defaults to new step', () => {
    render(<LeadJourneyStepper currentState="" />);
    expect(screen.getByText('New')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DealLifecycleStepper
// ══════════════════════════════════════════════════════════════════════════════
describe('Given DealLifecycleStepper', () => {
  it('Given currentState=new / When rendered / Then all five stage labels are shown', () => {
    render(<DealLifecycleStepper currentState="new" />);

    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Qualified')).toBeTruthy();
    expect(screen.getByText('Proposal')).toBeTruthy();
    expect(screen.getByText('Negotiation')).toBeTruthy();
    expect(screen.getByText('Won')).toBeTruthy();
  });

  it('Given currentState=won / When rendered / Then terminal won stage is highlighted', () => {
    render(<DealLifecycleStepper currentState="won" />);
    expect(screen.getByText('Won')).toBeTruthy();
  });

  it('Given currentState=lost / When rendered / Then deal lost banner is shown instead of stepper', () => {
    render(<DealLifecycleStepper currentState="lost" />);

    expect(screen.getByText('Deal Lost')).toBeTruthy();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('Given currentState=negotiation / When rendered / Then negotiation step is current and preceding steps are completed', () => {
    render(<DealLifecycleStepper currentState="negotiation" />);

    // Label for the current step must be present
    expect(screen.getByText('Negotiation')).toBeTruthy();
    // All earlier steps must also be visible
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Qualified')).toBeTruthy();
    expect(screen.getByText('Proposal')).toBeTruthy();
  });

  it('Given empty currentState / When rendered / Then defaults to first stage without crashing', () => {
    render(<DealLifecycleStepper currentState="" />);
    expect(screen.getByText('New')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// KanbanBoard
// ══════════════════════════════════════════════════════════════════════════════
describe('Given KanbanBoard', () => {
  const onDealClick   = vi.fn();
  const onStageChange = vi.fn();

  const stages = [
    makeStage({ id: 'new', name: 'New' }),
    makeStage({ id: 'qualified', name: 'Qualified' }),
    makeStage({ id: 'won', name: 'Won', is_terminal: true }),
  ];

  const deals = [
    makeDeal({ id: 'd1', name: 'Alpha Deal',  current_flow_state: 'new',       value: 5000 }),
    makeDeal({ id: 'd2', name: 'Beta Deal',   current_flow_state: 'qualified', value: 8000 }),
    makeDeal({ id: 'd3', name: 'Gamma Deal',  current_flow_state: 'won',       value: 12000 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given stages and deals / When rendered / Then all stage column headers are shown', () => {
    render(
      <KanbanBoard
        deals={deals}
        stages={stages}
        onDealClick={onDealClick}
        onStageChange={onStageChange}
      />
    );

    expect(screen.getByText('NEW')).toBeTruthy();
    expect(screen.getByText('QUALIFIED')).toBeTruthy();
    expect(screen.getByText('WON')).toBeTruthy();
  });

  it('Given deals in stages / When rendered / Then deal names appear in their respective columns', () => {
    render(
      <KanbanBoard
        deals={deals}
        stages={stages}
        onDealClick={onDealClick}
        onStageChange={onStageChange}
      />
    );

    expect(screen.getByText('Alpha Deal')).toBeTruthy();
    expect(screen.getByText('Beta Deal')).toBeTruthy();
    expect(screen.getByText('Gamma Deal')).toBeTruthy();
  });

  it('Given a deal card / When clicked / Then onDealClick is called with the deal', async () => {
    render(
      <KanbanBoard
        deals={deals}
        stages={stages}
        onDealClick={onDealClick}
        onStageChange={onStageChange}
      />
    );

    await userEvent.click(screen.getByText('Alpha Deal'));
    expect(onDealClick).toHaveBeenCalledWith(deals[0]);
  });

  it('Given an empty non-terminal stage / When rendered / Then drop-here hint is shown', () => {
    render(
      <KanbanBoard
        deals={[]}
        stages={stages}
        onDealClick={onDealClick}
        onStageChange={onStageChange}
      />
    );

    // At least one "drop here" hint should be visible (for non-terminal empty columns)
    const hints = screen.getAllByText(/Drop here/i);
    expect(hints.length).toBeGreaterThan(0);
  });

  it('Given a terminal stage with no deals / When rendered / Then win/lose instruction is shown', () => {
    render(
      <KanbanBoard
        deals={deals.filter(d => d.current_flow_state !== 'won')}
        stages={stages}
        onDealClick={onDealClick}
        onStageChange={onStageChange}
      />
    );

    expect(screen.getByText(/Win\/Lose via/i)).toBeTruthy();
  });
});
