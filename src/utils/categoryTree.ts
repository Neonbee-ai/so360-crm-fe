/**
 * Mirrors so360-inventory-fe/src/utils/categoryTree.ts. CRM is a separate MFE
 * remote and can't import Inventory's src directly, so this is a small,
 * intentionally-duplicated port of the same tree-building algorithm — CRM's
 * Custom Product category picker must reflect the same hierarchy Inventory
 * owns, not a second, disconnected one.
 */
export interface FlatCategory {
    id: string;
    name: string;
    parent_id?: string | null;
}

export interface CategoryTreeNode extends FlatCategory {
    children: CategoryTreeNode[];
    depth: number;
}

export function buildCategoryTree(categories: FlatCategory[]): CategoryTreeNode[] {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const cat of categories) {
        map.set(cat.id, { ...cat, children: [], depth: 0 });
    }

    for (const cat of categories) {
        const node = map.get(cat.id)!;
        if (cat.parent_id && map.has(cat.parent_id)) {
            map.get(cat.parent_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    function setDepths(nodes: CategoryTreeNode[], depth: number) {
        for (const node of nodes) {
            node.depth = depth;
            setDepths(node.children, depth + 1);
        }
    }
    setDepths(roots, 0);

    return roots;
}

export interface FlatIndentedCategory {
    id: string;
    name: string;
    depth: number;
}

/** Depth-first flatten: parent immediately followed by its children, in order. */
export function flattenCategoryTree(roots: CategoryTreeNode[]): FlatIndentedCategory[] {
    const result: FlatIndentedCategory[] = [];
    function walk(nodes: CategoryTreeNode[]) {
        for (const node of nodes) {
            result.push({ id: node.id, name: node.name, depth: node.depth });
            walk(node.children);
        }
    }
    walk(roots);
    return result;
}

/** "Living / Seating / Sofas" — used for search matching and display. */
export function categoryPath(categories: FlatCategory[], id: string): string {
    const byId = new Map(categories.map(c => [c.id, c]));
    const parts: string[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return parts.join(' / ');
}

/** "— — Sofas" style indentation prefix, safe for a plain <select><option>. */
export function indentLabel(name: string, depth: number): string {
    return depth > 0 ? `${'—'.repeat(depth)} ${name}` : name;
}
