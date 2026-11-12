import { stageKind } from '../services/salesConfigService';

/**
 * One rule set for a deal's stage on Deal Detail and the Pipeline board
 * (Pulse beaea97b). The persisted deal (status + stage_id) is the source;
 * both screens resolve their label / allowed move from it the same way.
 */
export type StageLike = { id: string; name: string; type?: string };
export type DealStageRef = {
    status?: string | null;
    stage_id?: string | null;
    current_flow_state?: string | null;
};

/** 'won' | 'lost' when the saved deal is closed, else null. */
export function closedKind(status: string | null | undefined): 'won' | 'lost' | null {
    const v = String(status ?? '').toLowerCase();
    return v === 'won' || v === 'lost' ? v : null;
}

/**
 * The configured stage the saved deal is on. A closed deal resolves to a stage
 * of its own outcome even when stage_id drifted, so Detail never shows a won
 * deal as "New" while the board shows it in Won.
 */
export function resolveDealStage<S extends StageLike>(deal: DealStageRef | null | undefined, stages: S[]): S | undefined {
    if (!deal) return undefined;
    const byStageId = deal.stage_id ? stages.find(s => s.id === deal.stage_id) : undefined;
    const closed = closedKind(deal.status);
    if (closed) {
        if (byStageId && stageKind(byStageId) === closed) return byStageId;
        return stages.find(s => stageKind(s) === closed) ?? byStageId;
    }
    if (byStageId) return byStageId;
    return deal.current_flow_state ? stages.find(s => s.id === deal.current_flow_state) : undefined;
}

export type StageMovePlan =
    | { action: 'close'; kind: 'won' | 'lost' }
    | { action: 'move' }
    | { action: 'reconcile'; message: string }
    | { action: 'blocked'; message: string };

/**
 * What a request to move the saved deal onto `target` should do. Won/Lost go
 * through the close flow; a deal already in that outcome is only re-read
 * (never re-posted to /win or /lose); a closed deal is not silently reopened.
 */
export function planStageMove(deal: DealStageRef, target: { name?: string; type?: string }): StageMovePlan {
    const closed = closedKind(deal.status);
    const kind = stageKind(target);
    if (closed && kind === closed) {
        return { action: 'reconcile', message: `This deal is already marked as ${closed}.` };
    }
    if (closed) {
        return { action: 'blocked', message: `This deal is ${closed} and can't be moved to another stage.` };
    }
    if (kind !== 'open') return { action: 'close', kind };
    return { action: 'move' };
}

/** True for the API's "Deal is already marked as won/lost" refusal. */
export function isAlreadyClosedError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error ?? '');
    return /already marked as (won|lost)/i.test(msg);
}
