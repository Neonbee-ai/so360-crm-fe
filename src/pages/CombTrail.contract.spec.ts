import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * CRM back navigation contract (Comb page trail).
 *
 * Every page template carries a `trail` of ancestors; the design system renders
 * `Root › A › B` and a `←` that goes to the LAST trail item. No page rolls its own
 * back button, and nothing pops browser history (`navigate(-1)` / `history.back()`).
 * Source-level, in the style of viteConfig.contract.spec.ts.
 */

const srcDir = path.resolve(__dirname, '..');
const pagesDir = __dirname;

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
        const p = path.join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
const isProd = (f: string) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) && !f.includes(`${path.sep}test${path.sep}`);
const prodFiles = walk(srcDir).filter(isProd);
const read = (f: string) => readFileSync(f, 'utf8');

/** Detail page → the parent chain its trail must declare (root "CRM" is added by CombScope). */
const DETAIL_TRAILS: Record<string, string[]> = {
    'DealDetailPage.tsx': ["label: 'Pipeline', to: '/crm/pipeline'"],
    'PartnerDetailPage.tsx': ["label: 'Partners', to: '/crm/partners'"],
    'TaskDetailPage.tsx': ["label: 'Tasks', to: '/crm/tasks'"],
    'QuoteDetailPage.tsx': ["label: 'Quotes', to: '/crm/quotes'"],
    'LeadDetailPage.tsx': ["'Customers' : 'Leads'", "'/crm/customers' : '/crm/leads'"],
};

describe('CRM page trail contract', () => {
    describe('Given the app root', () => {
        const app = read(path.join(srcDir, 'App.tsx'));
        it('When it mounts Comb / Then one CombScope names the CRM root and routes through the router', () => {
            expect(app).toMatch(/<CombScope module="crm" root=\{\{ label: 'CRM', to: '\/crm\/dashboard' \}\} navigate=\{\(to\) => navigate\(to\)\}>/);
        });
    });

    describe.each(Object.entries(DETAIL_TRAILS))('Given %s', (file, parts) => {
        const source = read(path.join(pagesDir, file));
        it.each(parts)('Then its trail names the parent (%s)', (part) => {
            expect(source).toContain(part);
            expect(source).toMatch(/trail=\{/);
        });
        it('Then it passes no legacy onBack/backLabel to the template', () => {
            expect(source).not.toMatch(/\bonBack=|\bbackLabel=|goBackFrom/);
        });
    });

    describe('Given every page that renders a Comb page template', () => {
        const templated = prodFiles.filter((f) => f.startsWith(pagesDir) && /<(Dashboard|List|Form|Detail|Settings)PageTemplate\b/.test(read(f)));
        it('Then each declares a trail, except the module root (Dashboard)', () => {
            const missing = templated
                .filter((f) => path.basename(f) !== 'DashboardPage.tsx')
                .filter((f) => !/trail=/.test(read(f)))
                .map((f) => path.relative(pagesDir, f));
            expect(missing).toEqual([]);
        });
        it('Then the Dashboard (module root) has no trail so the root crumb never duplicates', () => {
            expect(read(path.join(pagesDir, 'DashboardPage.tsx'))).not.toMatch(/trail=/);
        });
    });

    describe('Given all production code', () => {
        it('Then nothing pops browser history', () => {
            const offenders = prodFiles.filter((f) => /navigate\(-1\)|history\.back\(|goBackFrom/.test(read(f))).map((f) => path.relative(srcDir, f));
            expect(offenders).toEqual([]);
        });
        it('Then no page hand-builds a back arrow button (ArrowLeft/ChevronLeft in a page file)', () => {
            const offenders = prodFiles
                .filter((f) => f.startsWith(pagesDir) && /\b(ArrowLeft|ChevronLeft)\b/.test(read(f)) && /<(Icon)?Button[^>]*onClick=\{[^}]*(navigate|back)/i.test(read(f)))
                .map((f) => path.relative(srcDir, f));
            expect(offenders).toEqual([]);
        });
    });
});
