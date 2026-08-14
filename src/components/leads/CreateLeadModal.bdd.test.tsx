import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createLead: (...a: any[]) => mockCreateLead(...a),
    getUsers: () => Promise.resolve([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]),
    getPartners: () => Promise.resolve([
      { id: 'p1', company_name: 'Acme Corp', contact_name: 'John' },
      { id: 'p2', company_name: 'Beta LLC', contact_name: 'Jane' },
    ]),
  },
  settingsApi: {
    sourceTypes: {
      getAll: () => Promise.resolve([
        { id: 'st1', label: 'Website', value: 'website', is_active: true },
        { id: 'st2', label: 'Referral', value: 'referral', is_active: true },
      ]),
    },
  },
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import { CreateLeadModal } from './CreateLeadModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    lead_stages: [{ id: 'ls1', name: 'New' }, { id: 'ls2', name: 'Contacted' }],
    lead_custom_fields: [
      { id: 'cf1', label: 'Industry', type: 'text', required: false },
      { id: 'cf2', label: 'Budget', type: 'number', required: true },
    ],
    deal_stages: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockCreateLead.mockResolvedValue({ id: 'l-new', company_name: 'NewCo' });
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('CreateLeadModal', () => {
  describe('Given the modal is closed', () => {
    it('When isOpen is false / Then renders nothing', () => {
      const { container } = render(
        <CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />,
      );
      expect(container.querySelector('[data-testid="modal"]')).toBeNull();
    });

    it('When isOpen is false / Then does not fetch settings', () => {
      render(<CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(mockGetSettings).not.toHaveBeenCalled();
    });
  });

  describe('Given the modal is open', () => {
    it('When rendered / Then fetches lead stages and custom fields', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    });

    it('When rendered / Then shows required form fields', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText(/company name/i)).toBeInTheDocument();
        expect(screen.getByText(/first name/i)).toBeInTheDocument();
        expect(screen.getByText(/last name/i)).toBeInTheDocument();
        expect(screen.getByText(/contact email/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then First Name is required and Last Name is optional', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(screen.getByPlaceholderText('e.g. John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Doe')).toBeInTheDocument();
      // Required-ness is the app's to enforce, not the browser's: native
      // `required`/`minLength` popups pre-empted the inline messages, so the
      // contract is now aria-required plus a disabled Create Lead button.
      const firstNameInput = screen.getByPlaceholderText('e.g. John');
      expect(firstNameInput).toHaveAttribute('aria-required', 'true');
      const lastNameInput = screen.getByPlaceholderText('e.g. Doe');
      expect(lastNameInput).not.toHaveAttribute('aria-required');
    });

    it('When rendered / Then always shows Referred By field regardless of source', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText(/referred by/i)).toBeInTheDocument();
        expect(screen.getByTestId('partner-search-dropdown')).toBeInTheDocument();
      });
    });

    it('When Referred By dropdown is opened / Then shows partner options', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('partner-search-dropdown'));
      const dropdown = screen.getByTestId('partner-search-dropdown');
      fireEvent.click(dropdown.querySelector('[role="combobox"]')!);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      });
    });

    it('When settings load / Then shows lead stage options from settings', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('Contacted')).toBeInTheDocument();
      });
    });

    it('When settings load / Then shows custom field labels', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText('Industry')).toBeInTheDocument();
        expect(screen.getByText(/budget/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given a duplicate company name is entered', () => {
    it('When company name matches an existing lead / Then shows duplicate warning', async () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />,
      );
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Acme Corp' } });
      expect(screen.getByText(/potential duplicate/i)).toBeInTheDocument();
    });

    it('When company name does not match / Then does not show duplicate warning', async () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />,
      );
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'New Company' } });
      expect(screen.queryByText(/potential duplicate/i)).not.toBeInTheDocument();
    });
  });

  describe('Given the form is filled and submitted', () => {
    it('When submitted successfully / Then calls onSuccess and onClose', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateLead).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('When submitted / Then passes first_name and last_name (not contact_name) to createLead', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Doe'), { target: { value: 'Smith' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateLead.mock.calls[0][0];
        expect(payload.first_name).toBe('Alice');
        expect(payload.last_name).toBe('Smith');
        expect(payload).not.toHaveProperty('contact_name');
      });
    });

    it('When submitted with valid phone / Then phone is trimmed before saving', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '  +91 9876543210  ' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateLead.mock.calls[0][0];
        expect(payload.phone).toBe('+91 9876543210');
      });
    });

    it('When submission fails / Then shows error message', async () => {
      mockCreateLead.mockRejectedValue(new Error('Server error'));
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given the Primary Mobile Number mandatory validation', () => {
    it('When phone label is rendered / Then shows required asterisk (*)', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(screen.getAllByText('*').length).toBeGreaterThan(0);
    });

    it('When form is submitted with empty phone / Then shows required error and does not call createLead', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText('Primary Mobile Number is required.')).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When form is submitted with whitespace-only phone / Then shows required error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '   ' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText('Primary Mobile Number is required.')).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When form is submitted with invalid phone format / Then shows format error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'abc' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText(/Please enter a valid phone number/i)).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When phone is typed with invalid format / Then shows inline format error immediately', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'bad!!phone' } });
      expect(screen.getByText(/Please enter a valid phone number/i)).toBeInTheDocument();
    });

    it('When phone field is cleared after an error / Then clears the inline error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'bad' } });
      expect(screen.getByText(/Please enter a valid phone number/i)).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '' } });
      expect(screen.queryByText(/Please enter a valid phone number/i)).not.toBeInTheDocument();
    });

    it('When a valid phone is entered / Then no format error is shown', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      expect(screen.queryByText(/Primary Mobile Number is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Please enter a valid phone number/i)).not.toBeInTheDocument();
    });

    it('When alt phone is not filled / Then form can still submit with only primary phone', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockCreateLead).toHaveBeenCalled());
      const payload = mockCreateLead.mock.calls[0][0];
      expect(payload.alt_phone).toBe('');
    });
  });
  // ─── QA batch: field-level validation, gated submit, honest errors ──────
  //
  // Everything below tracks the QA reports on Create New Lead: values like
  // `8798798798798&^%$$*jyfutd` (company), `%^&)_5454hiugi` (first name),
  // `&)&)_*` (city) and `98789kgjftd?^&(` (PIN) were stored without a word,
  // Create Lead was clickable on an empty form, and every failure — validation
  // or outage — collapsed into "Failed to create lead. Please try again."

  const fillValidForm = async () => {
    await waitFor(() => screen.getByTestId('modal'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
    // "Budget" is a required custom field in this fixture, and required custom
    // fields gate the button exactly like the built-in mandatory ones.
    fireEvent.change(document.querySelector('input[type="number"]')!, { target: { value: '1000' } });
  };

  const createButton = () => screen.getByRole('button', { name: /create lead/i });

  describe('Given the Create Lead button gating', () => {
    it('When the form is untouched / Then Create Lead is disabled but Cancel stays available', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(createButton()).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
    });

    it('When every mandatory field holds a valid value / Then Create Lead becomes enabled', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      await waitFor(() => expect(createButton()).toBeEnabled());
    });

    it('When a mandatory field is emptied again / Then Create Lead returns to disabled', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      await waitFor(() => expect(createButton()).toBeEnabled());
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: '' } });
      await waitFor(() => expect(createButton()).toBeDisabled());
    });

    it('When an optional field turns invalid / Then Create Lead is disabled until it is corrected', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      await waitFor(() => expect(createButton()).toBeEnabled());
      fireEvent.change(screen.getByPlaceholderText('Bangalore'), { target: { value: '&)&)_*' } });
      await waitFor(() => expect(createButton()).toBeDisabled());
      fireEvent.change(screen.getByPlaceholderText('Bangalore'), { target: { value: 'Bangalore' } });
      await waitFor(() => expect(createButton()).toBeEnabled());
    });
  });

  describe('Given a field-level validation error on blur', () => {
    it.each([
      ['e.g. Acme Corp', '8798798798798&^%$$*jyfutd', 'Please enter a valid company name.'],
      ['e.g. John', '%^&)_5454hiugi', 'Please enter a valid first name.'],
      ['e.g. Doe', '49878)&)*_knhj', 'Please enter a valid last name.'],
      ['Street / area', '(^()_)+', 'Please enter a valid address.'],
      ['Bangalore', '&)&)_*', 'Please enter a valid city.'],
      ['+91 98765 43211', '/*8097*^*%(^lm', 'Please enter a valid phone number.'],
    ])('When "%s" receives %s / Then the message "%s" is shown beneath it', async (placeholder, value, message) => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const field = screen.getByPlaceholderText(placeholder as string);
      fireEvent.change(field, { target: { value } });
      fireEvent.blur(field);
      await waitFor(() => expect(screen.getByText(message as string)).toBeInTheDocument());
    });

    it('When an invalid email loses focus / Then the app message replaces the browser popup', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const email = screen.getByPlaceholderText('name@company.com');
      // The field is deliberately type="text" so the browser never intercepts.
      expect(email).toHaveAttribute('type', 'text');
      fireEvent.change(email, { target: { value: 'khfugo^(%^)_987984' } });
      fireEvent.blur(email);
      await waitFor(() => expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument());
    });

    it('When the invalid value is corrected / Then the message clears immediately', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const city = screen.getByPlaceholderText('Bangalore');
      fireEvent.change(city, { target: { value: '&)&)_*' } });
      fireEvent.blur(city);
      await waitFor(() => expect(screen.getByText('Please enter a valid city.')).toBeInTheDocument());
      fireEvent.change(city, { target: { value: 'Bangalore' } });
      await waitFor(() => expect(screen.queryByText('Please enter a valid city.')).not.toBeInTheDocument());
    });

    it('When a valid value is entered / Then no error is raised on blur', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const company = screen.getByPlaceholderText('e.g. Acme Corp');
      fireEvent.change(company, { target: { value: 'AT&T' } });
      fireEvent.blur(company);
      await waitFor(() => expect(screen.queryByText('Please enter a valid company name.')).not.toBeInTheDocument());
    });
  });

  describe('Given the PIN Code field', () => {
    it('When letters and symbols are typed / Then they never reach the field', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const pin = screen.getByPlaceholderText('560001') as HTMLInputElement;
      fireEvent.change(pin, { target: { value: '98789kgjftd?^&(' } });
      expect(pin.value).toBe('98789');
    });

    it('When digits are entered / Then a running digit count is shown', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(screen.getByText('0/6 digits')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('560001'), { target: { value: '5600' } });
      await waitFor(() => expect(screen.getByText('4/6 digits')).toBeInTheDocument());
    });

    it('When fewer than six digits are entered / Then the PIN message appears on blur', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      const pin = screen.getByPlaceholderText('560001');
      fireEvent.change(pin, { target: { value: '5600' } });
      fireEvent.blur(pin);
      await waitFor(() => expect(screen.getByText('Please enter a valid 6-digit PIN code.')).toBeInTheDocument());
    });
  });

  describe('Given the form is submitted with invalid values', () => {
    it('When submit is forced past the disabled button / Then createLead is not called and the field is flagged', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: '&&&&&&' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(screen.getByText('Please enter a valid company name.')).toBeInTheDocument());
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When several fields are invalid / Then focus moves to the first one needing correction', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: '&&&&&&' } });
      fireEvent.change(screen.getByPlaceholderText('Bangalore'), { target: { value: '&)&)_*' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByPlaceholderText('e.g. Acme Corp')));
    });

    it('When submission is blocked / Then the entered values are kept', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.change(screen.getByPlaceholderText('Bangalore'), { target: { value: '&)&)_*' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(screen.getByText('Please enter a valid city.')).toBeInTheDocument());
      expect(screen.getByPlaceholderText('e.g. John')).toHaveValue('Alice');
      expect(screen.getByPlaceholderText('name@company.com')).toHaveValue('alice@acme.com');
      expect(screen.getByPlaceholderText('+91 98765 43210')).toHaveValue('+91 9876543210');
    });
  });

  describe('Given the backend rejects the create', () => {
    const rejectWith = (message: string, status?: number) => {
      const err = new Error(message) as Error & { status?: number };
      if (status !== undefined) err.status = status;
      mockCreateLead.mockRejectedValue(err);
    };

    it('When a 400 explains which field is wrong / Then that explanation is shown verbatim', async () => {
      rejectWith('phone must be a valid phone number', 400);
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(screen.getByText('phone must be a valid phone number')).toBeInTheDocument());
    });

    it('When a 409 reports a duplicate / Then the backend message is shown', async () => {
      rejectWith('A lead with this email already exists', 409);
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(screen.getByText('A lead with this email already exists')).toBeInTheDocument());
    });

    it('When the server genuinely faults / Then the generic message is used, not the internals', async () => {
      rejectWith('relation "leads" does not exist', 500);
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(
          screen.getByText("We couldn't create the lead due to a server error. Please try again."),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByText(/relation "leads"/)).not.toBeInTheDocument();
    });

    it('When the create fails / Then the form keeps everything the user typed', async () => {
      rejectWith('Server exploded', 500);
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await fillValidForm();
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
      expect(screen.getByPlaceholderText('e.g. Acme Corp')).toHaveValue('Acme Corp');
      expect(screen.getByPlaceholderText('e.g. John')).toHaveValue('Alice');
      expect(screen.getByPlaceholderText('name@company.com')).toHaveValue('alice@acme.com');
    });
  });
});
