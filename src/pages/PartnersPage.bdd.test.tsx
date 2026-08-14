import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── service mocks ────────────────────────────────────────────────────────────
const mockPartnersGetAll = vi.fn();
const mockPartnersCreate = vi.fn();
const mockCustomFieldsGetAll = vi.fn();
const mockPartnerTypesGetAll = vi.fn();
const mockGetUsers = vi.fn();
const mockNavigate = vi.fn();
const mockValidatePhone = vi.fn();

vi.mock('../services/crmService', () => ({
    partnersApi: {
        getAll: (...args: any[]) => mockPartnersGetAll(...args),
        create: (...args: any[]) => mockPartnersCreate(...args),
    },
    settingsApi: {
        customFields: { getAll: (...args: any[]) => mockCustomFieldsGetAll(...args) },
        partnerTypes: { getAll: (...args: any[]) => mockPartnerTypesGetAll(...args) },
    },
    crmService: {
        getUsers: (...args: any[]) => mockGetUsers(...args),
    },
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

vi.mock('@so360/formatters', () => ({
    useFormatters: () => ({ formatCurrency: (v: number) => `$${v.toFixed(2)}` }),
}));

vi.mock('../utils/phoneValidation', () => ({
    validatePhone: (...args: any[]) => mockValidatePhone(...args),
}));

let tableProps: any = {};
vi.mock('../components/common/Table', () => ({
    Table: (props: any) => {
        tableProps = props;
        if (props.isLoading) return <div data-testid="table">Loading...</div>;
        if (!props.data.length) return <div data-testid="table">{props.emptyMessage}</div>;
        return (
            <div data-testid="table">
                {props.data.map((p: any) => (
                    <div key={p.id} data-testid={`partner-row-${p.id}`} onClick={() => props.onRowClick(p)}>
                        {p.contact_name}
                    </div>
                ))}
            </div>
        );
    },
}));

import PartnersPage from './PartnersPage';

// ── fixtures ─────────────────────────────────────────────────────────────────
const partnerTypes = [
    { value: 'referral', label: 'Referral' },
    { value: 'reseller', label: 'Reseller' },
];

const partners = [
    { id: 'p1', contact_name: 'Alpha Agency', email: 'alpha@test.com', partner_type: 'referral', grading: 'high', total_deals: 5, total_deal_value: 50000, pending_commission: 2500, commission_rate: 5 },
    { id: 'p2', contact_name: 'Beta Corp', email: 'beta@test.com', partner_type: 'reseller', grading: 'mid', total_deals: 2, total_deal_value: 12000, pending_commission: 0, commission_rate: 10 },
];

const users = [
    { id: 'u1', full_name: 'Ram Kumar' },
    { id: 'u2', full_name: 'Priya Sharma' },
];

beforeEach(() => {
    vi.clearAllMocks();
    tableProps = {};
    mockPartnersGetAll.mockResolvedValue(partners);
    mockPartnerTypesGetAll.mockResolvedValue(partnerTypes);
    mockCustomFieldsGetAll.mockResolvedValue([]);
    mockGetUsers.mockResolvedValue(users);
    mockPartnersCreate.mockResolvedValue({ id: 'p3', contact_name: 'New Partner' });
    mockValidatePhone.mockReturnValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PartnersPage', () => {

    // ── page renders ─────────────────────────────────────────────────────────
    describe('Given the Partners page loads', () => {
        it('When rendered / Then shows the Partners heading', async () => {
            render(<PartnersPage />);
            expect(screen.getByText('Partners')).toBeInTheDocument();
        });

        it('When data loads / Then displays partner rows in table', async () => {
            render(<PartnersPage />);
            await waitFor(() => {
                expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument();
                expect(screen.getByTestId('partner-row-p2')).toBeInTheDocument();
            });
        });

        it('When data loads / Then shows KPI totals (total partners count)', async () => {
            render(<PartnersPage />);
            await waitFor(() => {
                expect(screen.getByText('2')).toBeInTheDocument();
            });
        });

        it('When no partners returned / Then shows empty message', async () => {
            mockPartnersGetAll.mockResolvedValue([]);
            render(<PartnersPage />);
            await waitFor(() => {
                expect(screen.getByTestId('table')).toHaveTextContent('No partners found');
            });
        });

        it('When API fails / Then shows error message in table', async () => {
            mockPartnersGetAll.mockRejectedValue(new Error('Service unavailable'));
            render(<PartnersPage />);
            await waitFor(() => {
                expect(screen.getByTestId('table')).toHaveTextContent('Service unavailable');
            });
        });
    });

    // ── partner row navigation ────────────────────────────────────────────────
    describe('Given partner rows are displayed', () => {
        it('When a partner row is clicked / Then navigates to partner detail page', async () => {
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            fireEvent.click(screen.getByTestId('partner-row-p1'));
            expect(mockNavigate).toHaveBeenCalledWith('../partners/p1');
        });
    });

    // ── search filter ─────────────────────────────────────────────────────────
    describe('Given search functionality', () => {
        it('When searching by name / Then filters matching partners', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const search = screen.getByPlaceholderText('Search partners by name, email...');
            await user.type(search, 'Alpha');
            await waitFor(() => {
                expect(tableProps.data.length).toBe(1);
                expect(tableProps.data[0].id).toBe('p1');
            });
        });

        it('When search matches no partners / Then shows empty table', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const search = screen.getByPlaceholderText('Search partners by name, email...');
            await user.type(search, 'zzznomatch');
            await waitFor(() => {
                expect(tableProps.data.length).toBe(0);
            });
        });
    });

    // ── type filter ───────────────────────────────────────────────────────────
    describe('Given type filter', () => {
        it('When filtering by referral type / Then shows only referral partners', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const typeSelect = screen.getByDisplayValue('All Types');
            await user.selectOptions(typeSelect, 'referral');
            await waitFor(() => {
                expect(tableProps.data.length).toBe(1);
                expect(tableProps.data[0].partner_type).toBe('referral');
            });
        });

        it('When Clear Filters clicked after type filter / Then resets to all', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const typeSelect = screen.getByDisplayValue('All Types');
            await user.selectOptions(typeSelect, 'referral');
            await waitFor(() => expect(screen.getByText('Clear Filters')).toBeInTheDocument());
            await user.click(screen.getByText('Clear Filters'));
            await waitFor(() => {
                expect(tableProps.data.length).toBe(2);
            });
        });
    });

    // ── Add Partner modal — layout viewport safety (the core fix) ─────────────
    describe('Given the Add Partner modal', () => {
        it('When Add Partner button clicked / Then modal form becomes visible', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            // The modal is open when the form with id exists in the DOM
            expect(document.querySelector('form#create-partner-form')).not.toBeNull();
        });

        it('When modal opens / Then header is rendered outside the scrollable body (viewport-safe structure)', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            // The h2 modal title must sit in a non-scrolling div (shrink-0 header zone)
            const h2 = screen.getByRole('heading', { level: 2, name: 'Add Partner' });
            const headerDiv = h2.closest('div');
            expect(headerDiv).not.toBeNull();
            expect(headerDiv!.className).not.toContain('overflow-y-auto');
        });

        it('When modal opens / Then the form body has overflow-y-auto for internal scroll', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            // The scrollable area is the <form> element, not the outer wrapper
            const form = document.querySelector('form#create-partner-form');
            expect(form).not.toBeNull();
            expect(form!.className).toContain('overflow-y-auto');
        });

        it('When modal opens / Then footer buttons are rendered outside the scrollable form', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            // Cancel and Create Partner buttons must exist and be accessible
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /create partner/i })).toBeInTheDocument();

            // Submit button references the form by id (form attribute pattern)
            const submitBtn = screen.getByRole('button', { name: /create partner/i });
            expect(submitBtn.getAttribute('form')).toBe('create-partner-form');
            expect(submitBtn.closest('form')).toBeNull();
        });

        it('When modal outer wrapper is rendered / Then it does NOT carry overflow-y-auto', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            // The outer fixed backdrop should not have overflow-y-auto
            const backdrop = document.querySelector('.fixed.inset-0');
            expect(backdrop).not.toBeNull();
            expect(backdrop!.className).not.toContain('overflow-y-auto');

            // The immediate modal panel (child of backdrop) must not overflow-y-auto either
            const panel = backdrop!.firstElementChild as HTMLElement;
            expect(panel.className).not.toContain('overflow-y-auto');
        });

        it('When modal panel is rendered / Then it carries overflow-hidden to clip child overflow', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            const backdrop = document.querySelector('.fixed.inset-0');
            expect(backdrop).not.toBeNull();
            const panel = backdrop!.firstElementChild as HTMLElement;
            expect(panel.className).toContain('overflow-hidden');
        });

        it('When modal panel is rendered / Then it has max-h-[90vh] to prevent viewport overflow', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            const backdrop = document.querySelector('.fixed.inset-0');
            const panel = backdrop!.firstElementChild as HTMLElement;
            expect(panel.className).toContain('max-h-[90vh]');
        });

        it('When X button clicked / Then modal closes', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            expect(document.querySelector('form#create-partner-form')).not.toBeNull();

            // The X icon button lives in the modal header div alongside the h2
            const h2 = screen.getByRole('heading', { level: 2, name: 'Add Partner' });
            const headerDiv = h2.closest('div')!;
            const closeBtn = headerDiv.querySelector('button');
            expect(closeBtn).not.toBeNull();
            await user.click(closeBtn!);
            await waitFor(() => {
                expect(document.querySelector('form#create-partner-form')).toBeNull();
            });
        });

        it('When Cancel clicked / Then modal closes', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            expect(document.querySelector('form#create-partner-form')).not.toBeNull();
            await user.click(screen.getByRole('button', { name: /cancel/i }));
            await waitFor(() => {
                expect(document.querySelector('form#create-partner-form')).toBeNull();
            });
        });
    });

    // ── Add Partner modal — form validation ───────────────────────────────────
    describe('Given Add Partner form validation', () => {
        it('When submitted with empty names and type / Then shows validation error', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            // Use fireEvent.submit to bypass native HTML5 constraint validation
            // and reach our custom handleSubmit logic with empty fields
            const form = document.querySelector('form#create-partner-form')!;
            await act(async () => { fireEvent.submit(form); });

            await waitFor(() => {
                expect(screen.getByText('First name, last name, and partner type are required.')).toBeInTheDocument();
            });
            expect(mockPartnersCreate).not.toHaveBeenCalled();
        });

        it('When first name and last name filled but partner type missing / Then shows validation error', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Test');
            await user.type(screen.getByPlaceholderText('B S'), 'Partner');

            const form = document.querySelector('form#create-partner-form')!;
            await act(async () => { fireEvent.submit(form); });

            await waitFor(() => {
                expect(screen.getByText('First name, last name, and partner type are required.')).toBeInTheDocument();
            });
            expect(mockPartnersCreate).not.toHaveBeenCalled();
        });

        it('When phone validation returns error / Then shows inline phone error on change', async () => {
            mockValidatePhone.mockReturnValue('Invalid phone number');
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            const phoneInput = screen.getByPlaceholderText('+91 98765 43210');
            await user.type(phoneInput, 'badphone');

            // Phone error appears inline on change, not on submit
            await waitFor(() => {
                expect(screen.getByText('Invalid phone number')).toBeInTheDocument();
            });
        });

        it('When phone has error on submit / Then blocks create API call', async () => {
            mockValidatePhone.mockReturnValue('Invalid phone number');
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Test');
            await user.type(screen.getByPlaceholderText('B S'), 'Partner');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');
            await user.type(screen.getByPlaceholderText('+91 98765 43210'), 'badphone');

            const form = document.querySelector('form#create-partner-form')!;
            await act(async () => { fireEvent.submit(form); });

            // Both phone fields show the error (mock returns error for any input);
            // use getAllByText to handle multiple matches and just confirm at least one
            await waitFor(() => {
                expect(screen.getAllByText('Invalid phone number').length).toBeGreaterThan(0);
            });
            expect(mockPartnersCreate).not.toHaveBeenCalled();
        });
    });

    // ── Add Partner modal — successful submission ──────────────────────────────
    describe('Given Add Partner form successful submission', () => {
        it('When valid form submitted / Then calls create API with first_name and last_name and closes modal', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            // Click the page-level "Add Partner" button (the one with an SVG icon)
            const addBtn = screen.getByRole('button', { name: /add partner/i });
            await user.click(addBtn);

            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Gamma');
            await user.type(screen.getByPlaceholderText('B S'), 'Ltd');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');

            await user.click(screen.getByRole('button', { name: /create partner/i }));

            await waitFor(() => {
                expect(mockPartnersCreate).toHaveBeenCalledWith(
                    expect.objectContaining({ first_name: 'Gamma', last_name: 'Ltd', partner_type: 'referral' })
                );
            });
            await waitFor(() => {
                expect(document.querySelector('form#create-partner-form')).toBeNull();
            });
            expect(mockPartnersGetAll).toHaveBeenCalledTimes(2); // initial load + post-create refresh
        });

        it('When company name filled / Then it is included in the API call', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Dhanooj');
            await user.type(screen.getByPlaceholderText('B S'), 'B S');
            await user.type(screen.getByPlaceholderText('Moonhive Pvt Ltd'), 'Moonhive Pvt Ltd');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');

            await user.click(screen.getByRole('button', { name: /create partner/i }));

            await waitFor(() => {
                expect(mockPartnersCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        first_name: 'Dhanooj',
                        last_name: 'B S',
                        company_name: 'Moonhive Pvt Ltd',
                        partner_type: 'referral',
                    })
                );
            });
        });

        it('When optional fields are filled / Then they are included in the API call', async () => {
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Delta');
            await user.type(screen.getByPlaceholderText('B S'), 'Org');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'reseller');
            await user.type(screen.getByPlaceholderText('email@example.com'), 'delta@org.com');
            await user.type(screen.getByPlaceholderText('Street / area'), '123 Main St');
            await user.type(screen.getByPlaceholderText('Bangalore'), 'Chennai');

            await user.click(screen.getByRole('button', { name: /create partner/i }));

            await waitFor(() => {
                expect(mockPartnersCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        first_name: 'Delta',
                        last_name: 'Org',
                        partner_type: 'reseller',
                        email: 'delta@org.com',
                        address: '123 Main St',
                        city: 'Chennai',
                    })
                );
            });
        });
    });

    // ── Add Partner modal — API error handling ────────────────────────────────
    describe('Given Add Partner API error', () => {
        it('When create API rejects / Then shows error inside modal without closing it', async () => {
            mockPartnersCreate.mockRejectedValue(new Error('Duplicate email'));
            const user = userEvent.setup();
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));

            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Error');
            await user.type(screen.getByPlaceholderText('B S'), 'Partner');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');
            await user.click(screen.getByRole('button', { name: /create partner/i }));

            await waitFor(() => {
                expect(screen.getByText('Duplicate email')).toBeInTheDocument();
            });
            // Modal stays open
            expect(screen.getByRole('button', { name: /create partner/i })).toBeInTheDocument();
        });
    });

    // ── pagination ────────────────────────────────────────────────────────────
    describe('Given pagination', () => {
        it('When more than 20 partners exist / Then shows pagination controls', async () => {
            const many = Array.from({ length: 25 }, (_, i) => ({
                id: `p${i}`, contact_name: `Partner ${i}`, email: `p${i}@test.com`,
                partner_type: 'referral', grading: 'mid', total_deals: 0,
                total_deal_value: 0, pending_commission: 0, commission_rate: 0,
            }));
            mockPartnersGetAll.mockResolvedValue(many);
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
        });

        it('When Next button clicked / Then advances to page 2', async () => {
            const many = Array.from({ length: 25 }, (_, i) => ({
                id: `p${i}`, contact_name: `Partner ${i}`, email: `p${i}@test.com`,
                partner_type: 'referral', grading: 'mid', total_deals: 0,
                total_deal_value: 0, pending_commission: 0, commission_rate: 0,
            }));
            mockPartnersGetAll.mockResolvedValue(many);
            const user = userEvent.setup();
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
            await user.click(screen.getByText('Next'));
            expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
        });
    });

    // ── column renderers ──────────────────────────────────────────────────────
    describe('Given table column renderers', () => {
        it('When Name column renders / Then shows contact name and email', async () => {
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const nameCol = tableProps.columns[0];
            const { container } = render(nameCol.accessor(partners[0]));
            expect(container.textContent).toContain('Alpha Agency');
            expect(container.textContent).toContain('alpha@test.com');
        });

        it('When Royalty Rate column renders / Then shows royalty rate percentage', async () => {
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const rateCol = tableProps.columns.find((c: any) => c.header === 'Royalty Rate');
            expect(rateCol).toBeDefined();
            const { container } = render(rateCol.accessor(partners[0]));
            expect(container.textContent).toContain('5%');
        });

        it('When Royalty Rate column renders partner with no rate / Then shows dash', async () => {
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const rateCol = tableProps.columns.find((c: any) => c.header === 'Royalty Rate');
            const { container } = render(rateCol.accessor({ ...partners[0], commission_rate: 0 }));
            expect(container.textContent).toContain('-');
        });

        it('When Royalty Pending column exists / Then header label is "Royalty Pending"', async () => {
            render(<PartnersPage />);
            await waitFor(() => expect(screen.getByTestId('partner-row-p1')).toBeInTheDocument());
            const pendingCol = tableProps.columns.find((c: any) => c.header === 'Royalty Pending');
            expect(pendingCol).toBeDefined();
        });

        it('When KPI cards render / Then shows "Royalty Pending" card label', async () => {
            render(<PartnersPage />);
            await waitFor(() => {
                expect(screen.getByText('Royalty Pending')).toBeInTheDocument();
            });
        });
    });
    // ── Field-format rules shared with the lead forms ──────────────────────────
    //
    // Partners carry the same name / company / address / city / PIN fields as
    // leads and feed the same search, invoicing and mail-merge paths, so the
    // values QA filed against Create Lead must be refused here too rather than
    // leaving a second, looser standard in the CRM.
    describe('Given the Add Partner form uses the shared field rules', () => {
        const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
            render(<PartnersPage />);
            await user.click(screen.getByRole('button', { name: /add partner/i }));
        };

        it.each([
            ['Dhanooj', '%^&)_5454hiugi', 'Please enter a valid first name.'],
            ['B S', '49878)&)*_knhj', 'Please enter a valid last name.'],
            ['Moonhive Pvt Ltd', '8798798798798&^%$$*jyfutd', 'Please enter a valid company name.'],
            ['Street / area', '(^()_)+', 'Please enter a valid address.'],
            ['Bangalore', '&)&)_*', 'Please enter a valid city.'],
        ])('When "%s" receives %s / Then "%s" is shown inline', async (placeholder, value, message) => {
            const user = userEvent.setup();
            await openModal(user);
            const field = screen.getByPlaceholderText(placeholder as string);
            fireEvent.change(field, { target: { value } });
            fireEvent.blur(field);
            await waitFor(() => expect(screen.getByText(message as string)).toBeInTheDocument());
        });

        it.each(['AT&T', 'ABC Pvt. Ltd.', '7-Eleven'])(
            'When the company name is the legitimate "%s" / Then no error is raised',
            async (company) => {
                const user = userEvent.setup();
                await openModal(user);
                const field = screen.getByPlaceholderText('Moonhive Pvt Ltd');
                fireEvent.change(field, { target: { value: company } });
                fireEvent.blur(field);
                await waitFor(() =>
                    expect(screen.queryByText('Please enter a valid company name.')).not.toBeInTheDocument(),
                );
            },
        );

        it('When letters are typed into Pin Code / Then they never reach the field', async () => {
            const user = userEvent.setup();
            await openModal(user);
            const pin = screen.getByPlaceholderText('560001') as HTMLInputElement;
            fireEvent.change(pin, { target: { value: '98789kgjftd?^&(' } });
            expect(pin.value).toBe('98789');
        });

        it('When the PIN is short / Then the six-digit message appears and the count is shown', async () => {
            const user = userEvent.setup();
            await openModal(user);
            expect(screen.getByText('0/6 digits')).toBeInTheDocument();
            const pin = screen.getByPlaceholderText('560001');
            fireEvent.change(pin, { target: { value: '5600' } });
            fireEvent.blur(pin);
            await waitFor(() =>
                expect(screen.getByText('Please enter a valid 6-digit PIN code.')).toBeInTheDocument(),
            );
            expect(screen.getByText('4/6 digits')).toBeInTheDocument();
        });

        it('When an invalid city is submitted / Then the create API is never called', async () => {
            const user = userEvent.setup();
            await openModal(user);
            await user.type(screen.getByPlaceholderText('Dhanooj'), 'Test');
            await user.type(screen.getByPlaceholderText('B S'), 'Partner');
            await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
            await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');
            fireEvent.change(screen.getByPlaceholderText('Bangalore'), { target: { value: '&)&)_*' } });

            const form = document.querySelector('form#create-partner-form')!;
            await act(async () => { fireEvent.submit(form); });

            await waitFor(() => expect(screen.getByText('Please enter a valid city.')).toBeInTheDocument());
            expect(mockPartnersCreate).not.toHaveBeenCalled();
        });

        it('When an invalid value is corrected / Then the message clears', async () => {
            const user = userEvent.setup();
            await openModal(user);
            const city = screen.getByPlaceholderText('Bangalore');
            fireEvent.change(city, { target: { value: '&)&)_*' } });
            fireEvent.blur(city);
            await waitFor(() => expect(screen.getByText('Please enter a valid city.')).toBeInTheDocument());
            fireEvent.change(city, { target: { value: 'Bangalore' } });
            await waitFor(() =>
                expect(screen.queryByText('Please enter a valid city.')).not.toBeInTheDocument(),
            );
        });
    });
});
