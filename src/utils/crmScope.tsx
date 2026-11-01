import React from 'react';

/**
 * CRM's Tailwind utilities are emitted as `.crm-scope .x` (tailwind.config.js
 * `important`). Every remote injects its own full utility build into the same
 * document, so an unscoped `.flex-col` from a remote loaded later (e.g. the
 * Inbox softphone) overrides CRM's `wc-medium:flex-row` at equal specificity.
 * The scope selector raises CRM's utilities above any other remote's inside
 * the CRM subtree, without touching anything outside it.
 *
 * Anything rendered outside the App tree (portals, DS Modal bodies) must sit
 * under this class too, or it loses CRM's utilities.
 */
export const CRM_SCOPE = 'crm-scope';

/** Box-less wrapper that only establishes the scope. */
export const CrmScope = ({ children }: { children: React.ReactNode }) => (
    <div className={CRM_SCOPE} style={{ display: 'contents' }}>
        {children}
    </div>
);

/** Portal target under body that carries the CRM scope. */
export function crmPortalRoot(): HTMLElement {
    let root = document.getElementById('crm-portal-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'crm-portal-root';
        root.className = CRM_SCOPE;
        document.body.appendChild(root);
    }
    return root;
}
