/**
 * MFE Tailwind layout-collision guard — BDD spec.
 *
 * Every MFE remote injects its own compiled Tailwind sheet after the shell's.
 * Media queries add no specificity, so a remote whose sheet contains the plain
 * base utility (`.flex-col`) but NOT the matching responsive variant
 * (`.md\:flex-row`) outranks ours purely by source order: our desktop row
 * silently becomes a mobile column in real accounts, while looking fine in a
 * sparse one.
 *
 * That alone is cosmetic. It turns into a defect when the same container also
 * pins the cross axis WITHOUT a breakpoint prefix (`items-center`, `items-end`,
 * `items-start`). In column direction that stops children stretching, so a
 * `flex-1` search wrapper shrink-wraps — and a search wrapper's only in-flow
 * child is typically a `w-full` input with no intrinsic width, its icon being
 * absolutely positioned. The control collapses to the width of the magnifier.
 * That is the reported "search box is an icon-only square" bug.
 *
 * This scans source rather than rendering, deliberately: jsdom has no cascade
 * and no competing remote sheets, so the symptom is unreproducible there — only
 * the cause is. Scanning also covers every page in the repo, including ones
 * added after this spec was written.
 *
 * Two safe ways to write such a bar:
 *   - prefix the alignment to match the direction (`md:flex-row md:items-center`),
 *     so the pair fails safe together; or
 *   - use this module's collision-proof `*-filter-bar` / `*-filter-search`
 *     classes, which no other remote's sheet can define and win on source order.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const SRC = resolve(__dirname, '..');

function tsxFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) tsxFiles(full, acc);
        else if (entry.endsWith('.tsx') && !/\.(spec|test)\.tsx$/.test(entry)) acc.push(full);
    }
    return acc;
}

const CLASS_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\})/;
const CROSS_AXIS_PINS = ['items-center', 'items-end', 'items-start'];

/** Containers that flatten to a column AND shrink-wrap a widthless flex child. */
function collapsibleBars(): string[] {
    const hits: string[] = [];
    for (const file of tsxFiles(SRC)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
            const m = CLASS_RE.exec(line);
            if (!m) return;
            const cls = (m[1] ?? m[2] ?? '').split(/\s+/).filter(Boolean);
            if (!cls.includes('flex-col')) return;
            if (!cls.some((c) => c.endsWith(':flex-row'))) return;
            // A prefixed pin (md:items-center) is safe: when the row is
            // flattened the pin is flattened too, and stretch resumes.
            if (!cls.some((c) => CROSS_AXIS_PINS.includes(c))) return;

            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const m2 = CLASS_RE.exec(lines[j]);
                if (!m2) continue;
                const child = (m2[1] ?? m2[2] ?? '').split(/\s+/).filter(Boolean);
                const hasOwnWidth = child.some(
                    (c) => c.startsWith('w-') || c.startsWith('min-w-') || c.startsWith('basis-'),
                );
                if (child.includes('flex-1') && !hasOwnWidth) {
                    hits.push(`${file.slice(SRC.length + 1)}:${i + 1} → child line ${j + 1}`);
                }
                break;
            }
        });
    }
    return hits;
}

describe('MFE Tailwind layout-collision guard', () => {
    describe('Given this module ships as a federated remote alongside other remotes', () => {
        it('When any flex container flattens to a column, Then no widthless flex-1 child is left to shrink-wrap', () => {
            const offenders = collapsibleBars();

            expect(
                offenders,
                `These containers combine \`flex-col\` + \`*:flex-row\` with an UNPREFIXED ` +
                `cross-axis pin, over a \`flex-1\` child that has no width of its own. ` +
                `If another remote's sheet flattens the row, the child shrink-wraps and a ` +
                `search box collapses to its icon. Fix by prefixing the alignment to match ` +
                `the direction (\`md:items-center\`), giving the child \`w-full\`, or using ` +
                `this module's collision-proof filter-bar classes.\n  ` +
                offenders.join('\n  '),
            ).toEqual([]);
        });
    });
});
