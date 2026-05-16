import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DealLifecycleStepper } from './DealLifecycleStepper';

describe('DealLifecycleStepper', () => {
  describe('Given a deal in the Lost state', () => {
    it('When rendered / Then shows the Deal Lost banner', () => {
      render(<DealLifecycleStepper currentState="lost" />);
      expect(screen.getByText('Deal Lost')).toBeInTheDocument();
    });

    it('When rendered / Then does not show the step-by-step stepper', () => {
      render(<DealLifecycleStepper currentState="lost" />);
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });

  describe('Given a new deal', () => {
    it('When rendered / Then shows all forward stage labels', () => {
      render(<DealLifecycleStepper currentState="new" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
      expect(screen.getByText('Proposal')).toBeInTheDocument();
      expect(screen.getByText('Negotiation')).toBeInTheDocument();
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<DealLifecycleStepper currentState="new" />);
      expect(screen.queryByText('Deal Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given a deal in the Negotiation stage', () => {
    it('When rendered / Then shows the current stage label', () => {
      render(<DealLifecycleStepper currentState="negotiation" />);
      expect(screen.getByText('Negotiation')).toBeInTheDocument();
    });

    it('When rendered / Then also shows earlier stages', () => {
      render(<DealLifecycleStepper currentState="negotiation" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
    });
  });

  describe('Given a deal in the Won state', () => {
    it('When rendered / Then shows the Won stage label', () => {
      render(<DealLifecycleStepper currentState="won" />);
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<DealLifecycleStepper currentState="won" />);
      expect(screen.queryByText('Deal Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given an empty or unknown state', () => {
    it('When rendered with empty string / Then defaults to showing New as current stage', () => {
      render(<DealLifecycleStepper currentState="" />);
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});
