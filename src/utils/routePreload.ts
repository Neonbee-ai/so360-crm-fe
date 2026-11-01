/**
 * Start a lazy route's chunk download as soon as the MFE module evaluates.
 *
 * A deep link to a lazy detail page used to load serially: wait for the Shell
 * context sync, THEN download the page chunk, THEN fetch the record, so
 * /crm/leads/:id held its spinner ~3s (AutoQA P2). Kicking the chunk off on
 * module load lets it download while the Shell context is still syncing.
 */
export type ChunkLoader = () => Promise<unknown>;
export interface RoutePreload {
    pattern: RegExp;
    load: ChunkLoader;
}

export function preloadRouteChunk(pathname: string, routes: RoutePreload[]): boolean {
    const hit = routes.find((r) => r.pattern.test(pathname));
    if (!hit) return false;
    // A failed preload is harmless: React.lazy retries the same import on render.
    hit.load().catch(() => undefined);
    return true;
}
