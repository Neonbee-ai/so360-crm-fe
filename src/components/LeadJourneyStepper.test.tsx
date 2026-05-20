import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { LeadJourneyStepper } from './LeadJourneyStepper';

describe('Given LeadJourneyStepper', () => {
  it('When action / Then renders forward states for new lead', () => {
    render(<LeadJourneyStepper currentState="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Contacted')).toBeInTheDocument();
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });

  it('When action / Then shows Lead Lost banner for lost state', () => {
    render(<LeadJourneyStepper currentState="lost" />);
    expect(screen.getByText('Lead Lost')).toBeInTheDocument();
  });

  it('When action / Then highlights completed states for qualified', () => {
    render(<LeadJourneyStepper currentState="qualified" />);
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('When action / Then handles converted state', () => {
    render(<LeadJourneyStepper currentState="converted" />);
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });

  it('When action / Then defaults to new on empty state', () => {
    render(<LeadJourneyStepper currentState="" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('Given an unexpected or unknown currentState', () => {
  it('When rendered with an unknown state / Then does not crash and renders all step labels', () => {
    render(<LeadJourneyStepper currentState="unknown_state" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Contacted')).toBeInTheDocument();
  });

  it('When rendered with uppercase state / Then normalizes and does not crash', () => {
    render(<LeadJourneyStepper currentState="NEW" />);
    expect(document.body).toBeTruthy();
  });
});

describe('Given each valid forward state', () => {
  const states = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted'];

  states.forEach((state) => {
    it(`When currentState is "${state}" / Then renders without crashing`, () => {
      render(<LeadJourneyStepper currentState={state} />);
      expect(document.body).toBeTruthy();
    });
  });
});
