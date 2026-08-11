import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Cross-page contract for CRM back navigation.
 *
 * Every record detail page used to ship its own back button, hard-wired to the
 * module's list route and labelled after it — "Back to Leads" even when the user
 * had arrived from Tasks. The fix is one shared control (DetailBackLink) that
 * returns to the previous history entry and always reads "Back".
 *
 * Per-page behaviour is covered by each page's own specs; this file guards the
 * property that is easy to lose when a *new* detail page is added — that it
 * reaches for the shared control rather than rolling its own. Source-level, in
 * the style of viteConfig.contract.spec.ts.
 */

const pagesDir = __dirname;

const read = (file: string) => readFileSync(path.join(pagesDir, file), 'utf8');

/** Every detail page that shows a back control in its header. */
const DETAIL_PAGES = [
    'LeadDetailPage.tsx',
    'DealDetailPage.tsx',
    'PartnerDetailPage.tsx',
    'TaskDetailPage.tsx',
    'QuoteDetailPage.tsx',
    'MarketingCampaignDetailPage.tsx',
    'MarketingAbandonedCartDetailPage.tsx',
];

/**
 * A page's not-found branch keeps a link that names its destination — there is
 * no history to return to there, so "Back to Leads" is the honest wording.
 * Strip that branch before asserting on the header.
 */
function withoutNotFoundBranch(source: string): string {
    const lines = source.split('\n');
    const kept: string[] = [];
    // The recovery link always follows its "<record> not found" message closely;
    // a short window after that message is enough to cover the whole button.
    let skipRemaining = 0;
    for (const line of lines) {
        if (/not found/i.test(line)) {
            skipRemaining = 8;
            continue;
        }
        if (skipRemaining > 0) {
            skipRemaining -= 1;
            continue;
        }
        kept.push(line);
    }
    return kept.join('\n');
}

describe('CRM detail pages — back navigation contract', () => {
    describe.each(DETAIL_PAGES)('Given %s', (file) => {
        const source = read(file);

        it('When it renders a back control / Then it uses the shared DetailBackLink', () => {
            expect(source).toContain("from '../components/common/DetailBackLink'");
            expect(source).toContain('<DetailBackLink');
        });

        it('Then it does not hand-roll its own back button', () => {
            // The old shape: a bare button whose click handler pushes the module
            // list route, bypassing history entirely.
            const header = withoutNotFoundBranch(source);
            expect(header).not.toMatch(/←\s*Back/);
            expect(header).not.toMatch(/>\s*Back to \w+/);
        });

        it('Then the header back control carries no module-specific label', () => {
            const header = withoutNotFoundBranch(source);
            expect(header).not.toMatch(/<DetailBackLink[^>]*label=/);
        });

        it('Then it still declares a fallback route for deep links and bookmarks', () => {
            expect(source).toMatch(/<DetailBackLink[^>]*fallbackTo=/);
        });
    });

    describe('Given a new detail page is added later', () => {
        it('Then no CRM page ships an unmanaged back control outside its not-found branch', () => {
            const offenders = readdirSync(pagesDir)
                .filter(f => f.endsWith('DetailPage.tsx'))
                .filter(f => {
                    const header = withoutNotFoundBranch(read(f));
                    return /←\s*Back/.test(header) || />\s*Back to \w+/.test(header);
                });
            expect(offenders).toEqual([]);
        });

        it('Then every detail page is listed in this contract', () => {
            const found = readdirSync(pagesDir).filter(f => f.endsWith('DetailPage.tsx'));
            expect([...found].sort()).toEqual([...DETAIL_PAGES].sort());
        });
    });
});
