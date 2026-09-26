import { describe, it, expect } from 'vitest';
import { isWonLeadStage } from './leadStages';

describe('isWonLeadStage', () => {
    it.each(['Converted', 'converted', 'Won', 'Closed Won', 'closed_won', 'closed-won', ' Customer '])(
        'Given the stage "%s" / When checked / Then it is a won stage',
        (name) => {
            expect(isWonLeadStage(name)).toBe(true);
        },
    );

    it.each(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Lost', 'Closed Lost'])(
        'Given the stage "%s" / When checked / Then it is not a won stage',
        (name) => {
            expect(isWonLeadStage(name)).toBe(false);
        },
    );

    it('Given no stage name / When checked / Then it is not a won stage', () => {
        expect(isWonLeadStage(undefined)).toBe(false);
        expect(isWonLeadStage(null)).toBe(false);
        expect(isWonLeadStage('')).toBe(false);
    });
});
