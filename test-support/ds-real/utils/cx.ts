/**
 * Dependency-free Tailwind class merge.
 *
 * Tailwind decides which of two conflicting utilities wins by their order in the
 * generated CSS, not by their order in the class attribute. So `h-9 h-auto` is
 * not "h-auto wins" — it is whichever rule the stylesheet emitted last. A DS
 * component that concatenates a caller's `className` after its own base classes
 * therefore cannot promise the caller's override wins.
 *
 * `cx` fixes that: within the same conflict group and the same variant prefix
 * (`hover:`, `sm:`, `aria-pressed:` …), the LAST class wins and the earlier ones
 * are dropped. Anything it does not recognise is kept untouched, `!important`
 * classes are never dropped and never drop others, and classes in different
 * groups (`text-sm` vs `text-primary`, `border` vs `border-line`) are both kept.
 *
 * `mergeClassName(base, override)` is the form DS components use: the base is
 * returned byte-for-byte when there is no override (default looks unchanged), and
 * only base classes that conflict with the override are removed.
 */

export type ClassValue = string | number | false | null | undefined;

const SIZES = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']);
const DISPLAY = new Set([
    'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'contents', 'flow-root',
    'list-item', 'table', 'inline-table', 'table-caption', 'table-cell', 'table-column', 'table-column-group',
    'table-footer-group', 'table-header-group', 'table-row-group', 'table-row',
]);
const POSITION = new Set(['static', 'fixed', 'absolute', 'relative', 'sticky']);
const WEIGHTS = new Set(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']);
const ALIGN = new Set(['left', 'center', 'right', 'justify', 'start', 'end']);
const BORDER_STYLE = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);
const SIDES = ['t', 'r', 'b', 'l', 's', 'e', 'x', 'y'];
const CORNERS = ['t', 'r', 'b', 'l', 's', 'e', 'tl', 'tr', 'br', 'bl', 'ss', 'se', 'es', 'ee'];
const SHADOW_SIZES = new Set(['', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none']);

/** Groups a later class also overrides (e.g. a later `p-4` overrides an earlier `px-2`). */
const COVERS: Record<string, string[]> = {
    p: ['px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
    px: ['pr', 'pl', 'ps', 'pe'],
    py: ['pt', 'pb'],
    m: ['mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'],
    mx: ['mr', 'ml', 'ms', 'me'],
    my: ['mt', 'mb'],
    size: ['w', 'h'],
    gap: ['gap-x', 'gap-y'],
    overflow: ['overflow-x', 'overflow-y'],
    inset: ['inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end'],
    'inset-x': ['left', 'right'],
    'inset-y': ['top', 'bottom'],
    rounded: CORNERS.map((c) => `rounded-${c}`),
    'rounded-t': ['rounded-tl', 'rounded-tr'],
    'rounded-r': ['rounded-tr', 'rounded-br'],
    'rounded-b': ['rounded-br', 'rounded-bl'],
    'rounded-l': ['rounded-tl', 'rounded-bl'],
    'rounded-s': ['rounded-ss', 'rounded-es'],
    'rounded-e': ['rounded-se', 'rounded-ee'],
    'border-w': SIDES.map((s) => `border-w-${s}`),
    'border-w-x': ['border-w-l', 'border-w-r'],
    'border-w-y': ['border-w-t', 'border-w-b'],
    'border-color': SIDES.map((s) => `border-color-${s}`),
    'border-color-x': ['border-color-l', 'border-color-r'],
    'border-color-y': ['border-color-t', 'border-color-b'],
};

const isArbitrary = (v: string) => v.startsWith('[') && v.endsWith(']');
const isLengthArbitrary = (v: string) =>
    isArbitrary(v) && /^\[(length:)?-?[\d.]+(px|r?em|%|vh|vw|svh|dvh|lvh|ch|ex|pt)?\]$|^\[(length:|calc\(|clamp\(|min\(|max\()/.test(v);
const isNumber = (v: string) => /^\d+$/.test(v);
const isColorArbitrary = (v: string) => isArbitrary(v) && /^\[(color:|#|rgb|hsl|oklch|oklab)/.test(v);

/** Conflict group for one utility (no variant prefix, no `!`), or null when unknown (kept as-is). */
export function classGroup(utility: string): string | null {
    const u = utility.startsWith('-') ? utility.slice(1) : utility;
    const slash = u.indexOf('/');
    const bare = slash > 0 && !u.includes('[') ? u.slice(0, slash) : u; // `bg-primary/60` → `bg-primary`, `text-sm/6` → `text-sm`
    if (DISPLAY.has(u)) return 'display';
    if (POSITION.has(u)) return 'position';
    if (/^flex-(row|col)(-reverse)?$/.test(u)) return 'flex-direction';
    if (/^flex-(wrap|wrap-reverse|nowrap)$/.test(u)) return 'flex-wrap';
    if (/^flex-(1|auto|initial|none|\[.+\])$/.test(u)) return 'flex';
    if (/^(grow|shrink)(-\d+)?$/.test(u)) return u.replace(/-\d+$/, '');
    if (/^whitespace-/.test(u)) return 'whitespace';
    if (/^overflow-[xy]-/.test(u)) return u.slice(0, 10);
    if (/^overflow-/.test(u)) return 'overflow';
    if (/^justify-(items|self)-/.test(u)) return u.startsWith('justify-items') ? 'justify-items' : 'justify-self';
    if (/^justify-/.test(u)) return 'justify-content';
    if (/^items-/.test(u)) return 'align-items';
    if (/^self-/.test(u)) return 'align-self';
    if (/^content-(normal|center|start|end|between|around|evenly|baseline|stretch)$/.test(u)) return 'align-content';
    if (/^place-(content|items|self)-/.test(u)) return u.split('-').slice(0, 2).join('-');
    if (/^gap-[xy]-/.test(u)) return u.slice(0, 5);
    if (/^gap-/.test(u)) return 'gap';
    const sp = /^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me)-(.+)$/.exec(u);
    if (sp) return sp[1];
    const dim = /^(min-w|max-w|min-h|max-h|w|h|size)-(.+)$/.exec(u);
    if (dim) return dim[1];
    const pos = /^(inset-x|inset-y|inset|top|right|bottom|left|start|end|z)-(.+)$/.exec(u);
    if (pos) return pos[1];
    if (u === 'rounded') return 'rounded';
    const rd = /^rounded-(.+)$/.exec(u);
    if (rd) {
        const [first, ...rest] = rd[1].split('-');
        return CORNERS.includes(first) && (rest.length <= 2) ? `rounded-${first}` : 'rounded';
    }
    if (/^font-/.test(u)) {
        const v = u.slice(5);
        if (WEIGHTS.has(v) || (isArbitrary(v) && /^\[\d+\]$/.test(v))) return 'font-weight';
        if (/^(sans|serif|mono|nb-[\w-]+)$/.test(v)) return 'font-family';
        return null;
    }
    if (/^text-/.test(u)) {
        const v = bare.slice(5);
        if (SIZES.has(v) || /^nb-[\w-]+$/.test(v) || isLengthArbitrary(v)) return 'font-size';
        if (ALIGN.has(v)) return 'text-align';
        if (v === 'ellipsis' || v === 'clip') return 'text-overflow';
        if (/^(wrap|nowrap|balance|pretty)$/.test(v)) return 'text-wrap';
        if (/^opacity-/.test(v)) return 'text-opacity';
        if (isArbitrary(v) && !isColorArbitrary(v)) return null;
        return 'text-color';
    }
    if (/^leading-/.test(u)) return 'leading';
    if (/^tracking-/.test(u)) return 'tracking';
    if (/^opacity-/.test(u)) return 'opacity';
    if (/^cursor-/.test(u)) return 'cursor';
    if (/^shadow(-|$)/.test(u)) return SHADOW_SIZES.has(u.slice(7)) || /^shadow-nb-/.test(u) ? 'shadow' : null;
    if (/^bg-/.test(u)) {
        const v = bare.slice(3);
        if (/^(fixed|local|scroll)$/.test(v)) return 'bg-attachment';
        if (/^(clip|origin|blend|opacity)-/.test(v)) return `bg-${v.split('-')[0]}`;
        if (/^(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(v)) return 'bg-repeat';
        if (/^(auto|cover|contain)$/.test(v)) return 'bg-size';
        if (/^(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top)$/.test(v)) return 'bg-position';
        if (v === 'none' || /^gradient-/.test(v) || /^\[url\(/.test(v)) return 'bg-image';
        if (isArbitrary(v) && !isColorArbitrary(v)) return null;
        return 'bg-color';
    }
    if (u === 'border' || /^border-(\d+|\[(length:)?[\d.]+px\])$/.test(u)) return 'border-w';
    if (/^border-/.test(u)) {
        const v = bare.slice(7);
        if (BORDER_STYLE.has(v)) return 'border-style';
        if (/^(collapse|separate)$/.test(v) || /^(spacing|opacity)-/.test(v)) return null;
        const side = /^([trblsexy])(?:-(.+))?$/.exec(v);
        if (side) {
            const [, s, rest] = side;
            if (rest === undefined || isNumber(rest) || /^\[(length:)?[\d.]+px\]$/.test(rest)) return `border-w-${s}`;
            if (isArbitrary(rest) && !isColorArbitrary(rest)) return null;
            return `border-color-${s}`;
        }
        if (isArbitrary(v) && !isColorArbitrary(v)) return null;
        return 'border-color';
    }
    return null;
}

/** Split on `:` outside brackets → [variants…, utility]. */
function splitVariants(cls: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < cls.length; i++) {
        const ch = cls[i];
        if (ch === '[' || ch === '(') depth++;
        else if (ch === ']' || ch === ')') depth--;
        else if (ch === ':' && depth === 0) {
            parts.push(cls.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(cls.slice(start));
    return parts;
}

interface Parsed { cls: string; prefix: string; group: string | null }

function parse(cls: string): Parsed {
    const parts = splitVariants(cls);
    const utility = parts.pop() ?? '';
    const important = utility.startsWith('!') || utility.endsWith('!');
    // Variant order does not change meaning for conflict purposes (`hover:focus:` ≡ `focus:hover:`).
    const prefix = parts.slice().sort().join(':');
    return { cls, prefix, group: important ? null : classGroup(utility) };
}

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

/** Groups that a later class in `group` overrides, including itself. */
function claims(group: string): string[] {
    const out = [group];
    for (const g of COVERS[group] ?? []) out.push(...claims(g));
    return out;
}

function mergeTokens(list: string[]): string[] {
    const claimed = new Set<string>();
    const keep: string[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
        const p = parse(list[i]);
        if (p.group === null) {
            keep.push(p.cls);
            continue;
        }
        const key = `${p.prefix}|${p.group}`;
        if (claimed.has(key)) continue;
        for (const g of claims(p.group)) claimed.add(`${p.prefix}|${g}`);
        keep.push(p.cls);
    }
    return keep.reverse();
}

/** Join truthy class values; later Tailwind classes win over earlier ones in the same conflict group. */
export function cx(...values: ClassValue[]): string {
    const list: string[] = [];
    for (const v of values) if (v || v === 0) list.push(...tokens(String(v)));
    return mergeTokens(list).join(' ');
}

/**
 * DS component form: `base` unchanged when there is no override; otherwise base classes that conflict
 * with `override` are dropped and `override` (itself merged) is appended. Base-internal classes are never
 * merged against each other, so a component's own look is exactly what it was.
 */
export function mergeClassName(base: string, override?: ClassValue): string {
    const o = override || override === 0 ? tokens(String(override)) : [];
    if (o.length === 0) return base;
    const merged = mergeTokens(o);
    const claimed = new Set<string>();
    for (const cls of merged) {
        const p = parse(cls);
        if (p.group !== null) for (const g of claims(p.group)) claimed.add(`${p.prefix}|${g}`);
    }
    const kept = tokens(base).filter((cls) => {
        const p = parse(cls);
        return p.group === null || !claimed.has(`${p.prefix}|${p.group}`);
    });
    return [...kept, ...merged].join(' ');
}
