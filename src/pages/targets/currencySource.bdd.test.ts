import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatValue } from './targetUi';

/**
 * Guards where the Targets screens get their currency from.
 *
 * These pages read `businessSettings.currency` for months. Core returns
 * `base_currency`, so the key did not exist, `undefined` reached formatValue,
 * and every revenue target on every screen rendered as USD regardless of the
 * org's configured currency.
 *
 * Nothing failed. No error, no empty state — just the wrong currency symbol in
 * front of a correct number, which is the kind of defect that survives review
 * and gets quoted to a customer. A source-level guard is the only thing that
 * catches reading a key that does not exist, because a runtime test would have
 * to assert against a fixture that could carry the wrong shape too.
 */

// Resolved from cwd, not import.meta.url: under jsdom the latter is not
// guaranteed to carry the `file:` scheme and fileURLToPath throws.
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

const pageFiles = readdirSync(targetsDir)
  .filter((f) => f.endsWith('.tsx') && !/\.(spec|test)\.tsx$/.test(f))
  .map((f) => ({ name: f, body: readFileSync(join(targetsDir, f), 'utf8') }));

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('Given a Targets screen that formats money', () => {
  it('When it resolves the org currency / Then it reads base_currency', () => {
    const readers = pageFiles.filter((f) =>
      stripComments(f.body).includes('businessSettings?.'),
    );
    // Guard the guard: if the pages stop reading business settings entirely
    // this spec would pass vacuously.
    expect(readers.length).toBeGreaterThan(0);

    for (const f of readers) {
      expect(stripComments(f.body), f.name).toContain(
        'businessSettings?.base_currency',
      );
    }
  });

  it('When it resolves the org currency / Then it never reads the key that does not exist', () => {
    for (const f of pageFiles) {
      expect(
        /businessSettings\?\.currency\b/.test(stripComments(f.body)),
        f.name,
      ).toBe(false);
    }
  });
});

describe('Given a currency-valued metric', () => {
  it('When the org currency is known / Then it is used rather than a default', () => {
    const inr = formatValue(1500, 'currency', 'INR');
    const usd = formatValue(1500, 'currency', 'USD');
    expect(inr).not.toBe(usd);
    expect(inr).toMatch(/₹|INR/);
  });

  it('When the org currency is missing / Then it still renders a number rather than throwing', () => {
    // The fallback exists so a slow business-settings fetch does not blank the
    // screen. It is a stopgap, not the source of truth — hence the guards above.
    expect(formatValue(1500, 'currency', undefined)).toMatch(/1,500|1500/);
  });

  it('When the currency code is invalid / Then it degrades to a plain number', () => {
    // Intl throws on an unknown code; an unformatted number beats a blank page.
    expect(formatValue(1500, 'currency', 'NOTACODE')).toMatch(/1,500|1500/);
  });

  it('When the value is absent / Then it renders a dash, not zero', () => {
    // Zero and "no data" are different answers to "how am I doing".
    expect(formatValue(null, 'currency', 'INR')).toBe('—');
    expect(formatValue(undefined, 'currency', 'INR')).toBe('—');
  });

  it('When the metric is not money / Then no currency symbol is applied', () => {
    expect(formatValue(12, 'count', 'INR')).not.toMatch(/₹|INR/);
  });
});
