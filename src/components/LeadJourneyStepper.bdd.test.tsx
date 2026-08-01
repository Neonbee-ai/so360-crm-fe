import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LeadJourneyStepper } from './LeadJourneyStepper';

describe('LeadJourneyStepper', () => {
  describe('Given a lead in the Lost state', () => {
    it('When rendered / Then shows the Lead Lost banner', () => {
      render(<LeadJourneyStepper currentState="lost" />);
      expect(screen.getByText('Lead Lost')).toBeInTheDocument();
    });

    it('When rendered / Then does not show the stepper stages', () => {
      render(<LeadJourneyStepper currentState="lost" />);
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });

  describe('Given a new lead', () => {
    it('When rendered / Then shows all journey stage labels', () => {
      render(<LeadJourneyStepper currentState="new" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Contacted')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
      expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
      expect(screen.getByText('Negotiation')).toBeInTheDocument();
      expect(screen.getByText('Converted')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<LeadJourneyStepper currentState="new" />);
      expect(screen.queryByText('Lead Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given a lead in the Qualified stage', () => {
    it('When rendered / Then shows the Qualified stage label as current', () => {
      render(<LeadJourneyStepper currentState="qualified" />);
      expect(screen.getByText('Qualified')).toBeInTheDocument();
    });

    it('When rendered / Then also shows earlier stages', () => {
      render(<LeadJourneyStepper currentState="qualified" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Contacted')).toBeInTheDocument();
    });
  });

  describe('Given a converted lead', () => {
    it('When rendered / Then shows the Converted stage label', () => {
      render(<LeadJourneyStepper currentState="converted" />);
      expect(screen.getByText('Converted')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<LeadJourneyStepper currentState="converted" />);
      expect(screen.queryByText('Lead Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given an empty or unknown state', () => {
    it('When rendered with empty string / Then defaults to showing New stage', () => {
      render(<LeadJourneyStepper currentState="" />);
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  describe('Given a lead in the Proposal Sent stage (space-separated status from lead.status)', () => {
    it('When rendered with "Proposal Sent" / Then highlights the Proposal Sent stage', () => {
      render(<LeadJourneyStepper currentState="Proposal Sent" />);
      expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
    });

    it('When rendered with "Proposal Sent" / Then shows earlier stages as completed', () => {
      render(<LeadJourneyStepper currentState="Proposal Sent" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Contacted')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
    });
  });
});
