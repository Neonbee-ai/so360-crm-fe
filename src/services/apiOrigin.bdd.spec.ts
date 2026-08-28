import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

const SERVICES = [
  'targetPlanService.ts',
  'salesTargetService.ts',
  'crmService.ts',
];

// Paths are resolved from the package root, found by walking up from cwd.
//
// Not `import.meta.url`: these specs run under jsdom, where `import.meta.url`
// is not guaranteed to carry the `file:` scheme, and `fileURLToPath` then
// throws during collection. Not `__dirname` either — this is ESM.
const pkgRoot = (() => {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'src', 'services', 'crmService.ts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`crm-fe package root not found above ${process.cwd()}`);
    }
    dir = parent;
  }
})();

const srcDir = join(pkgRoot, 'src');
const servicesDir = join(srcDir, 'services');

const read = (relative: string) =>
  readFileSync(resolve(servicesDir, relative), 'utf8');

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

// ─── Repo-wide guards ──────────────────────────────────────────────────────
//
// The two above pin the individual files. These pin the PATTERN, so the next
// service added to this app cannot reintroduce the defect.

const sourceFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .filter((p) => /\.tsx?$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p))
  .map((p) => join(srcDir, p));

describe('Given every source file in the app', () => {
  it('When it reads build-time env / Then it never optional-chains import.meta', () => {
    // `(import.meta as any)?.env` compiles to `import.meta?.env`, which Vite's
    // textual substitution does not match. The capture is then `{}` and every
    // origin silently degrades to its localhost fallback in the built bundle —
    // invisible in dev, in unit tests, and in code review.
    const offenders = sourceFiles.filter((f) =>
      /import\.meta(\s+as\s+any)?\s*\)?\s*\?\./.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('Given the module API origins this app resolves at build time', () => {
  const usedKeys = [
    ...new Set(
      sourceFiles.flatMap((f) =>
        [
          ...readFileSync(f, 'utf8').matchAll(
            /import\.meta\.env\.(VITE_SO360_[A-Z_]+_API)/g,
          ),
        ].map((m) => m[1]),
      ),
    ),
  ].sort();

  it('When a key is read / Then it is declared in vite-env.d.ts', () => {
    const dts = read('../vite-env.d.ts');
    expect(usedKeys.filter((k) => !dts.includes(k))).toEqual([]);
  });

  it('When a key is read / Then production supplies a value for it', () => {
    // A key with no value in .env.production builds cleanly and ships localhost.
    // That is exactly how six CRM origins reached production pointing at the
    // developer's own machine.
    const envProd = read('../../.env.production');
    expect(usedKeys.filter((k) => !new RegExp(`^${k}=\\S`, 'm').test(envProd))).toEqual([]);
  });
});
