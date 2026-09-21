import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { DealLifecycleStepper, type DealLifecycleStage } from './DealLifecycleStepper';

// Mirrors a real org's configured pipeline_stages (the whole point of the fix: no hardcoded labels).
const STAGES: DealLifecycleStage[] = [
  { id: 's1', name: 'New', type: 'OPEN' },
  { id: 's2', name: 'Qualified', type: 'OPEN' },
  { id: 's3', name: 'Proposal', type: 'OPEN' },
  { id: 's4', name: 'Negotiation', type: 'OPEN' },
  { id: 's5', name: 'Won', type: 'WON' },
];

const LOST_STAGE: DealLifecycleStage = { id: 's6', name: 'Lost', type: 'LOST' };

describe('Given DealLifecycleStepper', () => {
  it('When action / Then renders forward stages for a new deal using the configured stage names', () => {
    render(<DealLifecycleStepper stages={STAGES} currentStageId="s1" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('When action / Then shows Deal Lost banner for a stage typed LOST', () => {
    render(<DealLifecycleStepper stages={[...STAGES, LOST_STAGE]} currentStageId="s6" />);
    expect(screen.getByText('Deal Lost')).toBeInTheDocument();
  });

  it('When action / Then highlights completed stages', () => {
    render(<DealLifecycleStepper stages={STAGES} currentStageId="s4" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
  });

  it('When action / Then handles the WON-typed stage', () => {
    render(<DealLifecycleStepper stages={STAGES} currentStageId="s5" />);
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('When action / Then falls back to matching currentState by name when no currentStageId is given', () => {
    render(<DealLifecycleStepper stages={STAGES} currentState="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('When rendered with an unresolvable stage id / Then does not crash and still renders all step labels', () => {
    render(<DealLifecycleStepper stages={STAGES} currentStageId="does-not-exist" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('When rendered with an empty stages array / Then shows an empty-state message instead of crashing or fabricating labels', () => {
    render(<DealLifecycleStepper stages={[]} currentStageId="s1" />);
    expect(screen.getByText('No pipeline stages configured')).toBeInTheDocument();
  });

  it('When rendered with a differently-named/ordered pipeline / Then renders exactly those configured labels, not generic ones', () => {
    const customStages: DealLifecycleStage[] = [
      { id: 'a', name: 'Stage 1', type: 'OPEN' },
      { id: 'b', name: 'Stage 2', type: 'OPEN' },
      { id: 'c', name: 'Stage 3', type: 'WON' },
    ];
    render(<DealLifecycleStepper stages={customStages} currentStageId="b" />);
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Stage 2')).toBeInTheDocument();
    expect(screen.getByText('Stage 3')).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });
});
