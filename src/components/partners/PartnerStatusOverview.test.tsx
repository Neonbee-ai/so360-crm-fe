import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { PartnerStatusOverview } from './PartnerStatusOverview';

const PARTNER_TYPES = [
  { value: 'dealer', label: 'Dealer' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'referral', label: 'Referral' },
];

function makePartner(partner_type: string | undefined, id: string) {
  return { id, partner_type };
}

describe('PartnerStatusOverview', () => {
  describe('Given no partners', () => {
    it('When partners is an empty array / Then renders nothing', () => {
      const { container } = render(<PartnerStatusOverview partners={[]} partnerTypes={PARTNER_TYPES} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given a single partner', () => {
    it('When one dealer partner is passed / Then shows 100% for dealer only', () => {
      render(<PartnerStatusOverview partners={[makePartner('dealer', '1')]} partnerTypes={PARTNER_TYPES} />);

      expect(screen.getByText('1 partner')).toBeInTheDocument();
      expect(screen.getByText('Dealer')).toBeInTheDocument();
      expect(screen.getByText('(100%)')).toBeInTheDocument();
      expect(screen.getByTestId('partner-status-segment-dealer')).toHaveStyle({ width: '100%' });
    });
  });

  describe('Given a mixed set of partners', () => {
    const partners = [
      makePartner('dealer', '1'),
      makePartner('dealer', '2'),
      makePartner('reseller', '3'),
      makePartner('referral', '4'),
    ];

    it('When rendered / Then shows the plural total count', () => {
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);
      expect(screen.getByText('4 partners')).toBeInTheDocument();
    });

    it('When rendered / Then computes correct counts and percentages per type', () => {
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      expect(screen.getByTestId('partner-status-segment-dealer')).toHaveStyle({ width: '50%' });
      expect(screen.getByTestId('partner-status-segment-reseller')).toHaveStyle({ width: '25%' });
      expect(screen.getByTestId('partner-status-segment-referral')).toHaveStyle({ width: '25%' });
    });

    it('When rendered / Then legend entries follow Settings-configured order', () => {
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      const labels = screen.getAllByText(/Dealer|Reseller|Referral/).map(el => el.textContent);
      expect(labels).toEqual(['Dealer', 'Reseller', 'Referral']);
    });
  });

  describe('Given a partner type not present in Settings', () => {
    it('When a partner carries an unlisted type / Then it still gets its own segment using the raw value as label', () => {
      const partners = [makePartner('legacy_unlisted', '1')];
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      expect(screen.getByText('legacy_unlisted')).toBeInTheDocument();
      expect(screen.getByTestId('partner-status-segment-legacy_unlisted')).toBeInTheDocument();
    });
  });

  describe('Given a partner with no type set', () => {
    it('When partner_type is undefined / Then it is grouped under an "Unspecified" segment', () => {
      const partners = [makePartner(undefined, '1'), makePartner('dealer', '2')];
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      expect(screen.getByText('Unspecified')).toBeInTheDocument();
      expect(screen.getByTestId('partner-status-segment-unspecified')).toBeInTheDocument();
    });
  });

  describe('Given only configured types with zero partners', () => {
    it('When a configured type has no partners / Then it is omitted from the segments entirely', () => {
      const partners = [makePartner('dealer', '1')];
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      expect(screen.queryByTestId('partner-status-segment-reseller')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partner-status-segment-referral')).not.toBeInTheDocument();
      expect(screen.queryByText('Reseller')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('When rendered / Then the distribution bar exposes an accessible image role and label', () => {
      const partners = [makePartner('dealer', '1'), makePartner('reseller', '2')];
      render(<PartnerStatusOverview partners={partners} partnerTypes={PARTNER_TYPES} />);

      expect(screen.getByRole('img', { name: 'Partner type distribution across 2 partners' })).toBeInTheDocument();
    });
  });
});
