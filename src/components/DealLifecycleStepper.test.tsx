import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { DealLifecycleStepper } from './DealLifecycleStepper';

describe('Given DealLifecycleStepper', () => {
  it('When action / Then renders forward states for new deal', () => {
    render(<DealLifecycleStepper currentState="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('When action / Then shows Deal Lost banner for lost state', () => {
    render(<DealLifecycleStepper currentState="lost" />);
    expect(screen.getByText('Deal Lost')).toBeInTheDocument();
  });

  it('When action / Then highlights completed states', () => {
    render(<DealLifecycleStepper currentState="negotiation" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
  });

  it('When action / Then handles won state', () => {
    render(<DealLifecycleStepper currentState="won" />);
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('When action / Then defaults to new on empty state', () => {
    render(<DealLifecycleStepper currentState="" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
