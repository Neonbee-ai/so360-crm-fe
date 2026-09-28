import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

/**
 * Task assignee integrity (Pulse 4dc7892e):
 *   - getProjectTeamUserIds() feeds the Task modal's "is the assignee a member
 *     of this project?" check, and must tell "unknown" (null) from "empty" ([])
 *   - updateTask() forwards description / priority / start_date, which it used
 *     to drop so those edits silently never saved
 */

const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';

const mockFetchOk = (body: unknown) =>
    vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        json: async () => body,
    });

const mockFetchFail = (status: number) =>
    vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: () => Promise.resolve(JSON.stringify({ message: 'nope' })),
        json: async () => ({ message: 'nope' }),
    });

describe('crmService.getProjectTeamUserIds()', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('Given the project has team members / When called / Then it GETs the project team and returns their user ids', async () => {
        const fetchSpy = mockFetchOk([
            { user_id: 'u-zarin', role: 'member' },
            { user_id: 'u-preetham', role: 'manager' },
        ]);
        vi.stubGlobal('fetch', fetchSpy);

        const ids = await crmService.getProjectTeamUserIds('proj-1');

        expect(String(fetchSpy.mock.calls[0][0])).toContain('/projects/proj-1/team');
        expect(ids).toEqual(['u-zarin', 'u-preetham']);
    });

    it('Given a { data: [...] } wrapped response / When called / Then the rows are unwrapped', async () => {
        vi.stubGlobal('fetch', mockFetchOk({ data: [{ user_id: 'u-zarin' }] }));

        expect(await crmService.getProjectTeamUserIds('proj-1')).toEqual(['u-zarin']);
    });

    it('Given the project has no team / When called / Then it returns an empty list (known empty, not unknown)', async () => {
        vi.stubGlobal('fetch', mockFetchOk([]));

        expect(await crmService.getProjectTeamUserIds('proj-1')).toEqual([]);
    });

    it('Given the team request fails / When called / Then it returns null so the caller does not block on a blip', async () => {
        vi.stubGlobal('fetch', mockFetchFail(500));

        expect(await crmService.getProjectTeamUserIds('proj-1')).toBeNull();
    });
});

describe('crmService.updateTask() field whitelist', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Given an edit to description, priority and start date / When updateTask is called / Then all three reach the API', async () => {
        const fetchSpy = mockFetchOk({ id: 't1' });
        vi.stubGlobal('fetch', fetchSpy);

        await crmService.updateTask('t1', {
            description: 'Bring the revised estimate',
            priority: 'HIGH',
            start_date: '2026-10-01',
        });

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body).toMatchObject({
            description: 'Bring the revised estimate',
            priority: 'HIGH',
            start_date: '2026-10-01',
        });
    });

    it('Given an edit that does not mention the assignee / When updateTask is called / Then no assignee_id is sent', async () => {
        const fetchSpy = mockFetchOk({ id: 't1' });
        vi.stubGlobal('fetch', fetchSpy);

        await crmService.updateTask('t1', { due_date: '2026-10-05' });

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body).not.toHaveProperty('assignee_id');
    });
});
