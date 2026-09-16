import { describe, test, expect } from 'vitest';
import { buildCategoryTree, flattenCategoryTree, categoryPath, indentLabel, FlatCategory } from './categoryTree';

const CATEGORIES: FlatCategory[] = [
    { id: 'living', name: 'Living', parent_id: null },
    { id: 'seating', name: 'Seating', parent_id: 'living' },
    { id: 'accent-chairs', name: 'Accent Chairs', parent_id: 'seating' },
    { id: 'sofas', name: 'Sofas', parent_id: 'seating' },
    { id: 'outdoor', name: 'Outdoor', parent_id: null },
    { id: 'outdoor-sofas', name: 'Sofas', parent_id: 'outdoor' },
];

describe('Given a flat list of Inventory categories with parent_id references', () => {
    test('When buildCategoryTree() is called, Then top-level categories become roots and children nest under their parent', () => {
        const tree = buildCategoryTree(CATEGORIES);
        expect(tree.map(n => n.id)).toEqual(['living', 'outdoor']);
        const living = tree.find(n => n.id === 'living')!;
        expect(living.children.map(c => c.id)).toEqual(['seating']);
        expect(living.children[0].children.map(c => c.id)).toEqual(['accent-chairs', 'sofas']);
    });

    test('When buildCategoryTree() is called, Then each node carries its correct depth', () => {
        const tree = buildCategoryTree(CATEGORIES);
        const living = tree.find(n => n.id === 'living')!;
        expect(living.depth).toBe(0);
        expect(living.children[0].depth).toBe(1); // Seating
        expect(living.children[0].children[0].depth).toBe(2); // Accent Chairs
    });

    test('When flattenCategoryTree() is called, Then it produces a depth-first ordering with parent immediately before children', () => {
        const flat = flattenCategoryTree(buildCategoryTree(CATEGORIES));
        expect(flat.map(n => n.id)).toEqual(['living', 'seating', 'accent-chairs', 'sofas', 'outdoor', 'outdoor-sofas']);
        expect(flat.find(n => n.id === 'accent-chairs')?.depth).toBe(2);
    });
});

describe('Given a category referencing a parent_id that does not exist in the list', () => {
    test('When buildCategoryTree() is called, Then the orphaned category is treated as a root rather than dropped', () => {
        const withOrphan: FlatCategory[] = [...CATEGORIES, { id: 'orphan', name: 'Orphan', parent_id: 'missing-parent' }];
        const tree = buildCategoryTree(withOrphan);
        expect(tree.map(n => n.id)).toContain('orphan');
    });
});

describe('Given two categories share the same name under different parents (Living > Sofas vs Outdoor > Sofas)', () => {
    test('When categoryPath() is resolved for each id, Then the full paths are distinct even though the leaf name matches', () => {
        expect(categoryPath(CATEGORIES, 'sofas')).toBe('Living / Seating / Sofas');
        expect(categoryPath(CATEGORIES, 'outdoor-sofas')).toBe('Outdoor / Sofas');
    });
});

describe('Given a category id with a circular parent_id chain', () => {
    test('When categoryPath() is resolved, Then it terminates instead of looping forever', () => {
        const circular: FlatCategory[] = [
            { id: 'a', name: 'A', parent_id: 'b' },
            { id: 'b', name: 'B', parent_id: 'a' },
        ];
        expect(categoryPath(circular, 'a')).toBe('B / A');
    });
});

describe('Given a category name and its nesting depth', () => {
    test('When indentLabel() is called for a root (depth 0), Then the name is returned unchanged', () => {
        expect(indentLabel('Living', 0)).toBe('Living');
    });

    test('When indentLabel() is called for a depth-2 child, Then it is prefixed with two indent markers', () => {
        expect(indentLabel('Accent Chairs', 2)).toBe('—— Accent Chairs');
    });
});
