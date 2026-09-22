import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DealLifecycleStepper, type DealLifecycleStage } from './DealLifecycleStepper';

// A real org's configured pipeline_stages — the stepper must render exactly these, not hardcoded defaults.
const STAGES: DealLifecycleStage[] = [
  { id: 's1', name: 'New', type: 'OPEN' },
  { id: 's2', name: 'Qualified', type: 'OPEN' },
  { id: 's3', name: 'Proposal', type: 'OPEN' },
  { id: 's4', name: 'Negotiation', type: 'OPEN' },
  { id: 's5', name: 'Won', type: 'WON' },
];
const LOST_STAGE: DealLifecycleStage = { id: 's6', name: 'Lost', type: 'LOST' };

describe('DealLifecycleStepper', () => {
  describe('Given a deal on a stage typed LOST', () => {
    it('When rendered / Then shows the Deal Lost banner', () => {
      render(<DealLifecycleStepper stages={[...STAGES, LOST_STAGE]} currentStageId="s6" />);
      expect(screen.getByText('Deal Lost')).toBeInTheDocument();
    });

    it('When rendered / Then does not show the step-by-step stepper', () => {
      render(<DealLifecycleStepper stages={[...STAGES, LOST_STAGE]} currentStageId="s6" />);
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });

  describe('Given a new deal', () => {
    it('When rendered / Then shows all configured forward stage labels', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s1" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
      expect(screen.getByText('Proposal')).toBeInTheDocument();
      expect(screen.getByText('Negotiation')).toBeInTheDocument();
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s1" />);
      expect(screen.queryByText('Deal Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given a deal in the Negotiation stage', () => {
    it('When rendered / Then shows the current stage label', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s4" />);
      expect(screen.getByText('Negotiation')).toBeInTheDocument();
    });

    it('When rendered / Then also shows earlier stages', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s4" />);
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
    });
  });

  describe('Given a deal on the WON-typed stage', () => {
    it('When rendered / Then shows the Won stage label', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s5" />);
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a lost banner', () => {
      render(<DealLifecycleStepper stages={STAGES} currentStageId="s5" />);
      expect(screen.queryByText('Deal Lost')).not.toBeInTheDocument();
    });
  });

  describe('Given a pipeline with organization-specific stage names', () => {
    it('When rendered / Then shows those exact names instead of generic Stage 1/2/3 labels', () => {
      const orgStages: DealLifecycleStage[] = [
        { id: 'a', name: 'Discovery', type: 'OPEN' },
        { id: 'b', name: 'Commercial Negotiation', type: 'OPEN' },
        { id: 'c', name: 'Closed Won', type: 'WON' },
      ];
      render(<DealLifecycleStepper stages={orgStages} currentStageId="b" />);
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Commercial Negotiation')).toBeInTheDocument();
      expect(screen.getByText('Closed Won')).toBeInTheDocument();
    });
  });

  describe('Given no stage configuration is available', () => {
    it('When rendered with an empty stages array / Then shows an explicit empty state rather than fabricating labels', () => {
      render(<DealLifecycleStepper stages={[]} currentStageId="anything" />);
      expect(screen.getByText('No pipeline stages configured')).toBeInTheDocument();
    });
  });
});
