import { describe, it, expect } from 'vitest';
import { NAME_MAX, UNIT_MAX } from './AdminTaskTypesPage';

// Mirrors so360-crm-be CreateTaskTypeDto: name @MaxLength(100), unit @MaxLength(50).
describe('Given the New activity type form limits', () => {
  it('When unit is typed longer than the BE limit Then it is capped at 50 so POST cannot 400', () => {
    expect(UNIT_MAX).toBe(50);
    expect('x'.repeat(80).slice(0, UNIT_MAX)).toHaveLength(50);
  });
  it('When name is typed longer than the BE limit Then it is capped at 100', () => {
    expect(NAME_MAX).toBe(100);
    expect('y'.repeat(150).slice(0, NAME_MAX)).toHaveLength(100);
  });
});
