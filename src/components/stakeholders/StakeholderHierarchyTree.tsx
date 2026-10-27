import React from 'react';
import { Select } from '@so360/design-system';
import { Stakeholder } from '../../types/crm';

interface Props {
    stakeholders: Stakeholder[];
    onSetManager: (stakeholderId: string, managerId: string | null) => void;
}

interface TreeNode {
    stakeholder: Stakeholder;
    children: TreeNode[];
}

function buildTree(stakeholders: Stakeholder[]): TreeNode[] {
    const byId = new Map(stakeholders.map((s) => [s.id, s]));
    const childrenOf = new Map<string, Stakeholder[]>();
    const roots: Stakeholder[] = [];

    for (const s of stakeholders) {
        const managerId = s.reports_to_stakeholder_id;
        if (managerId && byId.has(managerId)) {
            const list = childrenOf.get(managerId) || [];
            list.push(s);
            childrenOf.set(managerId, list);
        } else {
            roots.push(s);
        }
    }

    const toNode = (s: Stakeholder): TreeNode => ({
        stakeholder: s,
        children: (childrenOf.get(s.id) || []).map(toNode),
    });

    return roots.map(toNode);
}

const TreeRow: React.FC<{ node: TreeNode; depth: number; allStakeholders: Stakeholder[]; onSetManager: Props['onSetManager'] }> = ({ node, depth, allStakeholders, onSetManager }) => {
    return (
        <div style={{ marginLeft: depth * 20 }} className="mt-2">
            <div className="flex items-center gap-2 bg-surface-sunken border border-line rounded-nb px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center text-xs font-medium text-fg-subtle">
                    {(node.stakeholder.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-fg">{node.stakeholder.full_name || 'Unnamed'}</span>
                {node.stakeholder.job_title && <span className="text-xs text-fg-muted">{node.stakeholder.job_title}</span>}
                <Select
                    name={`manager-${node.stakeholder.id}`}
                    aria-label="Reports to"
                    size="sm"
                    className="ml-auto"
                    value={node.stakeholder.reports_to_stakeholder_id || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSetManager(node.stakeholder.id, e.target.value || null)}
                    options={[
                        { value: '', label: 'No manager (top level)' },
                        ...allStakeholders.filter((s) => s.id !== node.stakeholder.id).map((s) => ({ value: s.id, label: s.full_name || 'Unnamed' })),
                    ]}
                />
            </div>
            {node.children.map((child) => (
                <TreeRow key={child.stakeholder.id} node={child} depth={depth + 1} allStakeholders={allStakeholders} onSetManager={onSetManager} />
            ))}
        </div>
    );
};

const StakeholderHierarchyTree: React.FC<Props> = ({ stakeholders, onSetManager }) => {
    const tree = buildTree(stakeholders);

    if (stakeholders.length === 0) {
        return <p className="text-xs text-fg-muted italic">No stakeholders to display.</p>;
    }

    return (
        <div>
            {tree.map((node) => (
                <TreeRow key={node.stakeholder.id} node={node} depth={0} allStakeholders={stakeholders} onSetManager={onSetManager} />
            ))}
        </div>
    );
};

export default StakeholderHierarchyTree;
