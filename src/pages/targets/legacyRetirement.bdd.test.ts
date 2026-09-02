import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * BDD specs for retiring the original Sales Target Engine.
 *
 * Four `sales-targets/*` pages shipped on 2026-06-30 with routes and guards but
 * no nav entry anywhere — `git log -S` on the shell's moduleNavConfig proves the
 * entries were never removed, they were never written. The pages were reachable
 * only by typing the URL, and the tenant data says nobody ever did: 11 activity
 * types and 1 target seeded, and ZERO rows in the activity log the scorecard and
 * leaderboard both read.
 *
 * Three of them are superseded by Targets & Performance and are retired here.
 * The fourth is NOT: Target Plans and Target Templates both call
 * `listTaskTypes()`, and the activity-types page is the only UI that can create
 * or edit those rows. Retiring it would have left the metrics every plan is
 * built from permanently read-only — and Target Plans' own empty state tells the
 * user to "add a task type first".
 *
 * That asymmetry is the whole point of this file: "legacy" described how the
 * code arrived, not whether anything still depends on it.
 */

const pkgRoot = (() => {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'src', 'App.tsx'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`crm-fe root not found above ${process.cwd()}`);
    dir = parent;
  }
})();

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const app = () => stripComments(readFileSync(join(pkgRoot, 'src', 'App.tsx'), 'utf8'));

const RETIRED = [
  { route: 'sales-targets/targets', page: 'AdminTargetsPage', supersededBy: 'targets/plans' },
  { route: 'sales-targets/scorecard', page: 'MyScorecardPage', supersededBy: 'targets/mine' },
  { route: 'sales-targets/leaderboard', page: 'LeaderboardPage', supersededBy: null },
];

describe('Given the superseded Sales Target Engine pages', () => {
  it.each(RETIRED)('When the router is read / Then $route is no longer registered', ({ route }) => {
    expect(app()).not.toContain(`path="${route}"`);
  });

  it.each(RETIRED)('When the router is read / Then $page is no longer imported', ({ page }) => {
    // A lazy import left behind still pulls the chunk into the build graph.
    expect(app()).not.toContain(page);
  });

  it.each(RETIRED.filter((r) => r.supersededBy))(
    'When $route is retired / Then its replacement $supersededBy is still routed',
    ({ supersededBy }) => {
      // Retiring a page is only safe if the capability survived somewhere.
      expect(app()).toContain(`path="${supersededBy}"`);
    },
  );
});

describe('Given the activity types Target Plans depends on', () => {
  it('When the router is read / Then the admin page is STILL routed', () => {
    expect(app()).toContain('path="sales-targets/task-types"');
  });

  it('When the plan builder loads / Then it reads those same rows', () => {
    // This is the dependency that makes the page non-retirable. If this
    // assertion ever fails, the page is free to go.
    const plans = stripComments(
      readFileSync(join(pkgRoot, 'src', 'pages', 'targets', 'TargetPlansPage.tsx'), 'utf8'),
    );
    expect(plans).toContain('listTaskTypes');
  });

  it('When no types exist / Then the plan builder still points the user at that page', () => {
    // The guidance and the nav entry have to stay in step; if the wording
    // changes, whoever changes it should see this and check the nav too.
    const plans = readFileSync(
      join(pkgRoot, 'src', 'pages', 'targets', 'TargetPlansPage.tsx'),
      'utf8',
    );
    expect(plans).toMatch(/add a\s+task type/i);
  });
});
