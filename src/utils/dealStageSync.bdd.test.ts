import { describe, it, expect } from 'vitest';
import { closedKind, resolveDealStage, planStageMove, isAlreadyClosedError } from './dealStageSync';

const STAGES = [
    { id: 's-new', name: 'New', type: 'OPEN' },
    { id: 's-qual', name: 'Qualified', type: 'OPEN' },
    { id: 's-won', name: 'Won', type: 'OPEN' }, // live shape: Won typed OPEN
    { id: 's-lost', name: 'Closed', type: 'LOST' },
];

describe('closedKind', () => {
    it('Given won or LOST / When classified / Then the outcome is returned', () => {
        expect(closedKind('won')).toBe('won');
        expect(closedKind('LOST')).toBe('lost');
    });
    it('Given open, empty or null / When classified / Then it is not closed', () => {
        expect(closedKind('open')).toBeNull();
        expect(closedKind('')).toBeNull();
        expect(closedKind(null)).toBeNull();
    });
});

describe('resolveDealStage', () => {
    it('Given no deal / When resolved / Then nothing is returned', () => {
        expect(resolveDealStage(null, STAGES)).toBeUndefined();
    });
    it('Given an open deal / When resolved / Then its stage_id stage is returned', () => {
        expect(resolveDealStage({ status: 'open', stage_id: 's-qual' }, STAGES)?.id).toBe('s-qual');
    });
    it('Given an open deal without stage_id / When resolved / Then the current_flow_state stage is returned', () => {
        expect(resolveDealStage({ status: 'open', current_flow_state: 's-new' }, STAGES)?.id).toBe('s-new');
    });
    it('Given an open deal with no matching stage / When resolved / Then nothing is returned', () => {
        expect(resolveDealStage({ status: 'open', stage_id: 'gone' }, STAGES)).toBeUndefined();
    });
    it('Given a won deal whose stage_id drifted to New / When resolved / Then the Won stage is returned', () => {
        expect(resolveDealStage({ status: 'won', stage_id: 's-new' }, STAGES)?.id).toBe('s-won');
    });
    it('Given a lost deal on a LOST-typed stage / When resolved / Then that stage is kept', () => {
        expect(resolveDealStage({ status: 'lost', stage_id: 's-lost' }, STAGES)?.id).toBe('s-lost');
    });
    it('Given a won deal and no Won stage configured / When resolved / Then its stage_id stage is the fallback', () => {
        expect(resolveDealStage({ status: 'won', stage_id: 's-new' }, STAGES.filter(s => s.id !== 's-won'))?.id).toBe('s-new');
    });
});

describe('planStageMove', () => {
    it('Given an open deal / When moved to an open stage / Then it is an ordinary move', () => {
        expect(planStageMove({ status: 'open' }, { name: 'Qualified', type: 'OPEN' })).toEqual({ action: 'move' });
    });
    it('Given an open deal / When moved to Won / Then the won close flow runs', () => {
        expect(planStageMove({ status: 'open' }, { name: 'Won' })).toEqual({ action: 'close', kind: 'won' });
    });
    it('Given an open deal / When moved to a LOST-typed stage / Then the lost close flow runs', () => {
        expect(planStageMove({ status: 'open' }, { name: 'Closed', type: 'LOST' })).toEqual({ action: 'close', kind: 'lost' });
    });
    it('Given a won deal / When moved to Won again / Then it only reconciles', () => {
        expect(planStageMove({ status: 'won' }, { name: 'Won' })).toEqual({ action: 'reconcile', message: 'This deal is already marked as won.' });
    });
    it('Given a lost deal / When moved to an open stage / Then the move is blocked', () => {
        expect(planStageMove({ status: 'lost' }, { name: 'New' }).action).toBe('blocked');
    });
    it('Given a won deal / When moved to Lost / Then the move is blocked (no silent outcome flip)', () => {
        expect(planStageMove({ status: 'won' }, { name: 'Lost' }).action).toBe('blocked');
    });
});

describe('isAlreadyClosedError', () => {
    it('Given the API "already marked as won" error / When checked / Then it is recognised', () => {
        expect(isAlreadyClosedError(new Error('Deal is already marked as won'))).toBe(true);
    });
    it('Given a plain object with an "already marked as lost" message / When checked / Then it is recognised', () => {
        expect(isAlreadyClosedError({ message: 'Deal is already marked as lost' })).toBe(true);
    });
    it('Given any other error / When checked / Then it is not', () => {
        expect(isAlreadyClosedError(new Error('network error'))).toBe(false);
        expect(isAlreadyClosedError(undefined)).toBe(false);
    });
});
