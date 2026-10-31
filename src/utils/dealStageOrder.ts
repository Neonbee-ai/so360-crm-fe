export interface StageLike { id: string; name: string; type: 'OPEN' | 'WON' | 'LOST' | string }

/** Insert a new OPEN stage before the first WON/LOST stage so it shows on the board (Pulse ba71bf76). */
export function insertOpenStage<T extends StageLike>(stages: T[], stage: T): T[] {
    const firstTerminal = stages.findIndex(s => s.type === 'WON' || s.type === 'LOST');
    if (firstTerminal === -1) return [...stages, stage];
    return [...stages.slice(0, firstTerminal), stage, ...stages.slice(firstTerminal)];
}
