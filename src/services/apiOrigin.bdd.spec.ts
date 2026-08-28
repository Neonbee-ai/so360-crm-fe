import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guards the CRM API base-URL resolution in the service clients.
 *
 * This is a source-level assertion rather than a runtime one, and deliberately
 * so: the defect it protects against only appears in a PRODUCTION BUILD. Vite
 * substitutes `import.meta.env.VITE_X` by matching that exact expression, so
 * capturing `const env = import.meta.env` and reading `env.VITE_X` leaves
 * `undefined` in the bundle while behaving perfectly in dev and in unit tests.
 * A runtime spec would pass either way and prove nothing.
 *
 * What that cost us: the chain ended in `VITE_API_BASE_URL`, which resolves to
 * the CORE origin. With the CRM value missing, every Targets & Performance call
 * was sent to Core, which replied `Cannot GET /v1/target-plans/...` — a 404 that
 * looked like a missing backend route rather than a misdirected client.
 */

const SERVICES = ['targetPlanService.ts', 'salesTargetService.ts'];

// `import.meta.url` rather than __dirname: these specs run as ESM under jsdom,
// where __dirname does not exist.
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe.each(SERVICES)('Given %s', (file) => {
  it('When the CRM origin is resolved / Then it reads the LITERAL import.meta.env expression', () => {
    // Anything else is not substituted by Vite at build time.
    expect(read(`./${file}`)).toContain('import.meta.env.VITE_SO360_CRM_API');
  });

  it('When the CRM origin is resolved / Then it never falls back to a non-CRM origin', () => {
    // VITE_API_BASE_URL points at Core. A CRM client silently addressing another
    // service is worse than failing: the 404 blames the wrong system.
    const body = read(`./${file}`).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(body).not.toContain('VITE_API_BASE_URL');
  });

  it('When the value is missing entirely / Then the fallback is localhost, so it fails loudly', () => {
    expect(read(`./${file}`)).toContain('http://localhost:3003');
  });

  it('When a deployed MFE must be repointed / Then a window override still wins', () => {
    // The shell injects window.VITE_SO360_CRM_API so an origin can change
    // without rebuilding the remote.
    expect(read(`./${file}`)).toMatch(/win\.VITE_SO360_CRM_API\s*\|\|/);
  });

  it('When the origin is used / Then a trailing slash cannot produce a double slash', () => {
    expect(read(`./${file}`)).toContain("replace(/\\/$/, '')");
  });
});

describe('Given the env type declarations', () => {
  it('When a service reads the literal / Then the key is declared, so tsc does not reject it', () => {
    const dts = read('../vite-env.d.ts');
    expect(dts).toContain('VITE_SO360_CRM_API');
  });
});
