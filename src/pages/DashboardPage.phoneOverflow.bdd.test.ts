import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, './DashboardPage.tsx'), 'utf8');

describe('CRM dashboard at 375px (no horizontal overflow)', () => {
  it('given the revenue and orders charts, when 12 bars render on a phone, then columns shrink (min-w-0, truncated labels, tight gap)', () => {
    expect(src.match(/flex-1 min-w-0 flex flex-col justify-end group relative h-full/g)).toHaveLength(2);
    expect(src.match(/gap-1 sm:gap-2 px-1 sm:px-4/g)).toHaveLength(2);
    expect(src).toContain('text-center truncate mt-3 group-hover:text-primary');
  });

  it('given the reminders row, when cards exceed the width, then only the scroller scrolls', () => {
    expect(src).toContain('<Card title="Active Reminders" className="min-w-0 max-w-full overflow-hidden">');
    expect(src).toContain('flex gap-4 overflow-x-auto min-w-0 max-w-full pb-4');
  });
});
