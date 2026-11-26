import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Pinned (sticky) body cells must sit on their own layer. Without a z-index, positioned
// descendants of later cells (DS Select inline wrapper, IconButton state layer) paint
// over them on horizontal scroll, so Status/Owner slide over the checkbox and Company.
const src = readFileSync(resolve(__dirname, 'LeadsDataGrid.tsx'), 'utf8');

describe('LeadsDataGrid pinned columns (BDD)', () => {
  it('Given the select column, When a row renders, Then its sticky cell is layered above scrolling cells', () => {
    expect(src).toMatch(/shrink-0 sticky z-toolbar \$\{cellPy\}/);
  });
  it('Given a pinned data column, When a row renders, Then its sticky cell is layered above scrolling cells', () => {
    expect(src).toMatch(/\? `sticky z-toolbar \$\{isSelected/);
  });
  it('Given the header, When pinned cells render, Then they stay above the body layer', () => {
    expect(src).toMatch(/sticky bg-surface z-toolbar/);
    expect(src).toMatch(/'sticky z-toolbar bg-surface'/);
  });
  it('Given the header row, When body pinned cells share z-toolbar, Then the header row sits on the higher z-chrome layer', () => {
    expect(src).toMatch(/flex sticky top-0 z-chrome bg-surface/);
  });
});
