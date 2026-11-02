import { describe, it, expect } from 'vitest';
import { insertOpenStage } from './dealStageOrder';

const s = (id: string, type: string) => ({ id, name: id, type });

describe('Given the deal pipeline stages (Pulse ba71bf76)', () => {
    it('When an OPEN stage is added Then it is placed before the first Won/Lost stage', () => {
        const out = insertOpenStage([s('a', 'OPEN'), s('b', 'OPEN'), s('w', 'WON'), s('l', 'LOST')], s('new', 'OPEN'));
        expect(out.map(x => x.id)).toEqual(['a', 'b', 'new', 'w', 'l']);
    });
    it('When there is no terminal stage Then it is appended', () => {
        expect(insertOpenStage([s('a', 'OPEN')], s('new', 'OPEN')).map(x => x.id)).toEqual(['a', 'new']);
    });
    it('When the list is empty Then it holds only the new stage', () => {
        expect(insertOpenStage([], s('new', 'OPEN')).map(x => x.id)).toEqual(['new']);
    });
});
