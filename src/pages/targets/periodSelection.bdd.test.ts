import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * BDD specs for reading a period other than today.
 *
 * Every visibility screen was pinned to the current date, so a past month was
 * unreachable even though its numbers were already stored. Two properties
 * matter beyond "the parameter is sent":
 *
 *   * the parameter is OMITTED when no period is chosen, so the backend keeps
 *     its own notion of today rather than inheriting the browser's clock;
 *   * the picker is rendered by every branch, including empty and loading, or
 *     choosing a period with no data strands the user there with no control
 *     to choose another.
 */

const pkgRoot = (() => {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'src', 'pages', 'targets', 'targetUi.tsx'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`crm-fe root not found above ${process.cwd()}`);
    dir = parent;
  }
})();

const targetsDir = join(pkgRoot, 'src', 'pages', 'targets');
const read = (f: string) => readFileSync(join(targetsDir, f), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

// ─── The client ────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  });
  global.fetch = fetchMock as any;
});

const calledPath = () => String(fetchMock.mock.calls[0][0]);

describe('Given a targets read', () => {
  it('When no period is chosen / Then no as_of is sent at all', async () => {
    // An empty `as_of=` would be a malformed date to the backend, and sending
    // today's date from the browser would use the wrong clock entirely.
    const { targetPlanService } = await import('../../services/targetPlanService');
    await targetPlanService.myOverview();
    expect(calledPath()).not.toContain('as_of');
  });

  it('When a period is chosen / Then as_of carries it', async () => {
    const { targetPlanService } = await import('../../services/targetPlanService');
    await targetPlanService.myOverview('2026-03-15');
    expect(calledPath()).toContain('as_of=2026-03-15');
  });

  it('When another person is read / Then as_of is appended to their path', async () => {
    const { targetPlanService } = await import('../../services/targetPlanService');
    await targetPlanService.overviewFor('p7', '2026-01-31');
    expect(calledPath()).toContain('/target-plans/overview/p7?as_of=2026-01-31');
  });

  it('When the team scorecard already has a query / Then as_of is joined with &, not ?', async () => {
    // person_ids is always present, so a second `?` would silently drop the
    // date and the view would show today while claiming otherwise.
    const { targetPlanService } = await import('../../services/targetPlanService');
    await targetPlanService.teamScorecard(['a', 'b'], '2026-06-30');
    const path = calledPath();
    expect(path).toContain('person_ids=a,b');
    expect(path).toContain('&as_of=2026-06-30');
    expect(path.match(/\?/g)?.length).toBe(1);
  });

  it('When measurement is read for a period / Then as_of carries it', async () => {
    const { targetPlanService } = await import('../../services/targetPlanService');
    await targetPlanService.myMeasurement('2026-05-01');
    expect(calledPath()).toContain('as_of=2026-05-01');
  });
});

// ─── The screens ───────────────────────────────────────────────────────────

const PERIOD_PAGES = ['MyTargetsPage.tsx', 'TeamTargetsPage.tsx', 'MeasurementPage.tsx'];

describe.each(PERIOD_PAGES)('Given %s', (file) => {
  const body = () => stripComments(read(file));

  it('When it renders / Then it offers a period picker', () => {
    expect(body()).toContain('<PeriodPicker');
  });

  it('When a past period is shown / Then it is labelled as historical', () => {
    // Otherwise last quarter's shortfall reads as this quarter's.
    expect(body()).toContain('<AsOfBanner');
  });

  it('When the period changes / Then the data reloads', () => {
    // A picker that does not re-fetch is worse than no picker: the date says
    // one thing and the numbers show another.
    expect(body()).toMatch(/\}, \[asOf\]\);/);
  });

  it('When a branch returns early / Then the picker is still on screen', () => {
    // Loading, error and empty states all render {header}; without this a
    // period with no data removes the only way to leave it.
    const src = body();
    const earlyReturns = src.split('return').filter((chunk, i) => i > 0 && /className="p-6/.test(chunk.slice(0, 200)));
    expect(earlyReturns.length).toBeGreaterThan(1);
    for (const chunk of earlyReturns) {
      expect(chunk.slice(0, 400)).toContain('{header}');
    }
  });
});
