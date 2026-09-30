import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LeadAttributionCard, attributionEntries } from './LeadAttributionCard';

/** Feature: lead detail shows how the lead was acquired (RE §26). */
describe('Feature: lead Source & attribution card', () => {
    describe('Given a lead captured from a Meta lead ad', () => {
        it('When the card renders / Then only the populated attribution fields are listed', () => {
            render(<LeadAttributionCard lead={{
                id: 'l1', utm_source: 'facebook', utm_medium: 'paid_social', ad_platform: 'instagram',
                ad_name: 'Marina 2BR', fbclid: 'fb-1', gclid: null, utm_term: '  ',
            }} />);
            expect(screen.getByText('Source & attribution')).toBeInTheDocument();
            expect(screen.getByTestId('attr-utm_source')).toHaveTextContent('facebook');
            expect(screen.getByTestId('attr-ad_platform')).toHaveTextContent('instagram');
            expect(screen.getByTestId('attr-ad_name')).toHaveTextContent('Marina 2BR');
            expect(screen.getByTestId('attr-fbclid')).toHaveTextContent('fb-1');
            expect(screen.queryByTestId('attr-gclid')).not.toBeInTheDocument();
            expect(screen.queryByTestId('attr-utm_term')).not.toBeInTheDocument();
        });
    });

    describe('Given a manually created lead with no attribution', () => {
        it('When the card renders / Then nothing is shown', () => {
            const { container } = render(<LeadAttributionCard lead={{ id: 'l2', company_name: 'Acme' }} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('Given a missing lead', () => {
        it('then attributionEntries is empty', () => {
            expect(attributionEntries(null)).toEqual([]);
            expect(attributionEntries(undefined)).toEqual([]);
        });
    });
});
