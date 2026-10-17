import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombScope, DetailPageTemplate, ListPageTemplate } from '@so360/design-system';

const scope = (navigate = vi.fn()) => ({ navigate, wrap: (ui: React.ReactNode) => (
    <CombScope module="crm" root={{ label: 'CRM', to: '/crm/dashboard' }} navigate={navigate}>{ui}</CombScope>
) });

describe('CRM page trail', () => {
    it('Given a lead detail page / When rendered / Then the trail reads CRM > Leads and Back goes to Leads', () => {
        const { navigate, wrap } = scope();
        render(wrap(<DetailPageTemplate title="Acme" trail={[{ label: 'Leads', to: '/crm/leads' }]}>x</DetailPageTemplate>));
        const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
        expect(crumbs.textContent).toBe('CRMLeads');
        fireEvent.click(screen.getByLabelText('Back to Leads'));
        expect(navigate).toHaveBeenCalledWith('/crm/leads');
    });

    it('Given a customer-route detail / When trail names Customers / Then Back goes to Customers, not Leads', () => {
        const { navigate, wrap } = scope();
        render(wrap(<DetailPageTemplate title="Acme" trail={[{ label: 'Customers', to: '/crm/customers' }]}>x</DetailPageTemplate>));
        fireEvent.click(screen.getByLabelText('Back to Customers'));
        expect(navigate).toHaveBeenCalledWith('/crm/customers');
    });

    it('Given a list page with an empty trail / When rendered / Then only the CRM root crumb shows and Back goes to the dashboard', () => {
        const { navigate, wrap } = scope();
        render(wrap(<ListPageTemplate title="Leads" trail={[]}>x</ListPageTemplate>));
        expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('CRM');
        fireEvent.click(screen.getByLabelText('Back to CRM'));
        expect(navigate).toHaveBeenCalledWith('/crm/dashboard');
    });

    it('Given the module root page without a trail / When rendered / Then no trail row or Back renders', () => {
        const { wrap } = scope();
        render(wrap(<ListPageTemplate title="Dashboard">x</ListPageTemplate>));
        expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
        expect(screen.queryByLabelText(/^Back/)).toBeNull();
    });

    it('Given a trail that already starts at the root / When rendered / Then the root crumb is not duplicated', () => {
        const { wrap } = scope();
        render(wrap(<DetailPageTemplate title="Acme" trail={[{ label: 'CRM', to: '/crm/dashboard' }, { label: 'Leads', to: '/crm/leads' }]}>x</DetailPageTemplate>));
        expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('CRMLeads');
    });
});
