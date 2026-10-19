import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
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
vi.mock('@so360/design-system', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        DataTable: (props: any) => {
            tableProps = { ...props, data: props.rows, isLoading: props.loading, emptyMessage: props.emptyState, columns: props.columns.map((c: any) => ({ ...c, accessor: c.render, className: c.align === 'right' ? 'text-right' : undefined })) };
            if (props.loading) return <div data-testid="table">Loading...</div>;
            if (!props.rows.length) return <div data-testid="table">{props.emptyState}</div>;
            return (
                <div data-testid="table">
                    {props.rows.map((p: any) => (
                        <div key={p.id} {...props.getRowProps(p)} onClick={() => props.onRowClick(p)}>
                            {p.contact_name}
                        </div>
                    ))}
                </div>
            );
        },
    };
});

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


const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<PartnersPage />);
    await user.click(screen.getByRole('button', { name: /add partner/i }));
    return screen.getByRole('group', { name: 'Area Served' });
};
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByPlaceholderText('Dhanooj'), 'Gamma');
    await user.type(screen.getByPlaceholderText('B S'), 'Ltd');
    await waitFor(() => expect(screen.getByDisplayValue('Select type...')).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue('Select type...'), 'referral');
};

describe('Feature: Partners Area Served ChipGroup (Comb)', () => {
    describe('Scenario: render', () => {
        it('Given the Add Partner modal When opened Then Area Served is a labelled group with 5 chips', async () => {
            const group = await openModal(userEvent.setup());
            const chips = within(group).getAllByRole('checkbox');
            expect(chips.map(c => c.textContent)).toEqual(['South India', 'North India', 'Central India', 'East India', 'West India']);
        });
        it('Given the modal When opened Then no chip is selected', async () => {
            const group = await openModal(userEvent.setup());
            within(group).getAllByRole('checkbox').forEach(c => expect(c).toHaveAttribute('aria-checked', 'false'));
        });
    });

    describe('Scenario: toggle', () => {
        it('Given no selection When a chip is clicked Then it becomes checked', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'North India' }));
            expect(within(group).getByRole('checkbox', { name: 'North India' })).toHaveAttribute('aria-checked', 'true');
        });
        it('Given a checked chip When clicked again Then it is unchecked', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            const chip = within(group).getByRole('checkbox', { name: 'North India' });
            await user.click(chip);
            await user.click(chip);
            expect(chip).toHaveAttribute('aria-checked', 'false');
        });
        it('Given one checked chip When another is clicked Then both are checked (multi-select)', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'North India' }));
            await user.click(within(group).getByRole('checkbox', { name: 'West India' }));
            expect(within(group).getAllByRole('checkbox').filter(c => c.getAttribute('aria-checked') === 'true')).toHaveLength(2);
        });
    });

    describe('Scenario: keyboard', () => {
        it('Given a focused chip When Space is pressed Then it toggles', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            const chip = within(group).getByRole('checkbox', { name: 'East India' });
            chip.focus();
            await user.keyboard(' ');
            expect(chip).toHaveAttribute('aria-checked', 'true');
        });
        it('Given a focused chip When Enter is pressed Then it toggles', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            const chip = within(group).getByRole('checkbox', { name: 'East India' });
            chip.focus();
            await user.keyboard('{Enter}');
            expect(chip).toHaveAttribute('aria-checked', 'true');
        });
        it('Given the first chip focused When Tab is pressed Then focus moves to the next chip', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            const chips = within(group).getAllByRole('checkbox');
            chips[0].focus();
            await user.tab();
            expect(chips[1]).toHaveFocus();
        });
    });

    describe('Scenario: submit payload', () => {
        it('Given no chips selected When submitted Then area_served is undefined', async () => {
            const user = userEvent.setup();
            await openModal(user);
            await fillRequired(user);
            await user.click(screen.getByRole('button', { name: /create partner/i }));
            await waitFor(() => expect(mockPartnersCreate).toHaveBeenCalled());
            expect(mockPartnersCreate.mock.calls[0][0].area_served).toBeUndefined();
        });
        it('Given two chips selected When submitted Then area_served lists them in click order', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'West India' }));
            await user.click(within(group).getByRole('checkbox', { name: 'South India' }));
            await fillRequired(user);
            await user.click(screen.getByRole('button', { name: /create partner/i }));
            await waitFor(() => expect(mockPartnersCreate).toHaveBeenCalled());
            expect(mockPartnersCreate.mock.calls[0][0].area_served).toEqual(['West India', 'South India']);
        });
        it('Given a chip selected then deselected When submitted Then area_served is undefined', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            const chip = within(group).getByRole('checkbox', { name: 'West India' });
            await user.click(chip);
            await user.click(chip);
            await fillRequired(user);
            await user.click(screen.getByRole('button', { name: /create partner/i }));
            await waitFor(() => expect(mockPartnersCreate).toHaveBeenCalled());
            expect(mockPartnersCreate.mock.calls[0][0].area_served).toBeUndefined();
        });
    });

    describe('Scenario: error / validation', () => {
        it('Given chips selected When required fields are missing Then validation error shows and create is not called', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'North India' }));
            await act(async () => { fireEvent.submit(document.querySelector("form#create-partner-form")!); });
            expect(await screen.findByText("First name, last name, and partner type are required.")).toBeInTheDocument();
            expect(mockPartnersCreate).not.toHaveBeenCalled();
            expect(within(screen.getByRole('group', { name: 'Area Served' })).getByRole('checkbox', { name: 'North India' })).toHaveAttribute('aria-checked', 'true');
        });
        it('Given chips selected When the API rejects Then error shows and selection is kept', async () => {
            mockPartnersCreate.mockRejectedValue(new Error('Boom'));
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'North India' }));
            await fillRequired(user);
            await user.click(screen.getByRole('button', { name: /create partner/i }));
            expect(await screen.findByText('Boom')).toBeInTheDocument();
            expect(within(screen.getByRole('group', { name: 'Area Served' })).getByRole('checkbox', { name: 'North India' })).toHaveAttribute('aria-checked', 'true');
        });
        it('Given the modal was closed with a selection When reopened Then selection is reset', async () => {
            const user = userEvent.setup();
            const group = await openModal(user);
            await user.click(within(group).getByRole('checkbox', { name: 'North India' }));
            await user.click(screen.getByRole('button', { name: /cancel/i }));
            await user.click(screen.getByRole('button', { name: /add partner/i }));
            within(screen.getByRole('group', { name: 'Area Served' })).getAllByRole('checkbox').forEach(c => expect(c).toHaveAttribute('aria-checked', 'false'));
        });
    });
});
