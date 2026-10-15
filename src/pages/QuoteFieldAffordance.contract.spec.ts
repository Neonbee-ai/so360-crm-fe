import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
    EDITABLE_FIELD_CLASS,
    EDITABLE_FIELD_SM_CLASS,
    EDITABLE_FIELD_SM_NUMERIC_CLASS,
} from '../components/common/fieldStyles';

/**
 * Source-level contract for "editable Quote fields look disabled".
 *
 * Title, Valid Until, every line-item cell and the whole Notes & Terms block
 * were filled with `bg-surface-raised` — lighter than the `bg-surface` card behind
 * them, which is this app's treatment for *disabled* controls. Users read the
 * form as read-only and stopped trying to edit it.
 *
 * Asserted on the source rather than the DOM because the property at risk is
 * "no future field reintroduces the disabled-looking fill", which no single
 * rendered case can cover. Same style as viteConfig.contract.spec.ts.
 */
const source = readFileSync(path.join(__dirname, 'QuoteDetailPage.tsx'), 'utf8');

describe('Given the editable-field style tokens', () => {
    it('When applied / Then they sit darker than the card, so the field reads as a well to type into', () => {
        for (const token of [EDITABLE_FIELD_CLASS, EDITABLE_FIELD_SM_CLASS]) {
            expect(token).toContain('bg-bg');
            // `disabled:bg-surface-raised` is fine and wanted; an *unqualified* one is
            // the disabled-looking fill this fix removed.
            expect(token).not.toMatch(/(^|\s)bg-surface-raised\b/);
        }
    });

    it('When applied / Then they carry a visible border with hover and focus feedback', () => {
        for (const token of [EDITABLE_FIELD_CLASS, EDITABLE_FIELD_SM_CLASS]) {
            expect(token).toContain('border-line');
            expect(token).toContain('hover:border-line');
            expect(token).toContain('focus:ring-primary/50');
            expect(token).toContain('focus:border-primary');
        }
    });

    it('When a control is disabled / Then it keeps the greyed, non-interactive treatment', () => {
        for (const token of [EDITABLE_FIELD_CLASS, EDITABLE_FIELD_SM_CLASS]) {
            expect(token).toContain('disabled:bg-surface-raised');
            expect(token).toContain('disabled:text-fg-subtle');
            expect(token).toContain('disabled:cursor-not-allowed');
        }
    });

    it('When used for a numeric line-item cell / Then it is the same language, right-aligned', () => {
        expect(EDITABLE_FIELD_SM_NUMERIC_CLASS.startsWith(EDITABLE_FIELD_SM_CLASS)).toBe(true);
        expect(EDITABLE_FIELD_SM_NUMERIC_CLASS).toContain('text-right');
    });
});

describe('Given the Quote page', () => {
    it('When it renders an editable control / Then it uses the shared tokens', () => {
        expect(source).toContain("from '../components/common/fieldStyles'");
        expect(source).toContain('className={EDITABLE_FIELD_CLASS}');
        expect(source).toContain('className={EDITABLE_FIELD_SM_NUMERIC_CLASS}');
    });

    it('Then no control is left with the old disabled-looking fill', () => {
        expect(source).not.toMatch(/bg-surface-raised border border-slate-600/);
    });

    it('Then the whole form — details, line items and notes & terms — is restyled, not just one section', () => {
        // 16 controls carried the disabled-looking fill: Title and Valid Until,
        // the line-item cells, and every Notes & Terms field.
        const usages =
            source.split('className={EDITABLE_FIELD_CLASS}').length - 1 +
            (source.split('className={EDITABLE_FIELD_SM_CLASS}').length - 1) +
            (source.split('className={EDITABLE_FIELD_SM_NUMERIC_CLASS}').length - 1);
        expect(usages).toBeGreaterThanOrEqual(16);
    });
});
