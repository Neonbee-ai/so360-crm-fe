import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { LeadJourneyStepper } from './LeadJourneyStepper';

describe('LeadJourneyStepper', () => {
  it('renders forward states for new lead', () => {
    render(<LeadJourneyStepper currentState="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Contacted')).toBeInTheDocument();
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });

  it('shows Lead Lost banner for lost state', () => {
    render(<LeadJourneyStepper currentState="lost" />);
    expect(screen.getByText('Lead Lost')).toBeInTheDocument();
  });

  it('highlights completed states for qualified', () => {
    render(<LeadJourneyStepper currentState="qualified" />);
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('handles converted state', () => {
    render(<LeadJourneyStepper currentState="converted" />);
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });

  it('defaults to new on empty state', () => {
    render(<LeadJourneyStepper currentState="" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
