import * as crmServiceModule from './crmService';

/**
 * Thin wrappers over the Core routes added for Sales-to-Service. The FE talks
 * to Core directly (same as reImportService), so there is no CRM BE proxy.
 *
 *  GET  /v1/entity-links/:type/:id/grouped?org_id=
 *  GET  /v1/products/price-lists/:org_id/filter/all
 *  POST /v1/products/price-lists/:org_id/resolve
 *  POST /v1/documents/layouts/:org_id/render
 *
 * Every call degrades to an empty result on failure so the host page keeps
 * working when a flag is on but Core is unreachable.
 */

export const S2S_FLAGS = {
    CONTACT_FEED: 'submodule:core:contact_feed',
    PRICE_LISTS: 'submodule:core:price_lists',
    DOCUMENT_LAYOUTS: 'submodule:core:document_layouts',
} as const;

/** doc_type key of the quotation layout (matches shell printDocument('sales_quote')). */
export const QUOTE_DOC_TYPE = 'sales_quote';

export interface FeedItem {
    id: string;
    rel?: string;
    direction?: 'in' | 'out';
    metadata?: Record<string, unknown> | null;
    source_module?: string;
    updated_at?: string;
}
export interface FeedGroups { entity?: { type: string; id: string }; total: number; groups: Record<string, { count: number; items: FeedItem[] }> }

export interface PriceListOption { id: string; name: string; currency?: string; is_active?: boolean }
export interface ResolvedPrice { item_id: string; price: number | null; currency?: string; source?: string; price_list_id?: string | null }
export interface ResolveInput { item_ids: string[]; price_list_id?: string; customer_id?: string; segment?: string; qty?: number; date?: string }

const core = () => (crmServiceModule as any).crmCoreClient;

export const contactFeed = {
    async grouped(entityType: string, entityId: string): Promise<FeedGroups> {
        try {
            const c = core();
            const orgId = c.getOrgId();
            const res = await c.get(`/v1/entity-links/${entityType}/${entityId}/grouped?org_id=${orgId}`);
            return { total: res?.total ?? 0, groups: res?.groups ?? {}, entity: res?.entity };
        } catch {
            return { total: 0, groups: {} };
        }
    },
};

export const priceLists = {
    async list(customerId?: string): Promise<PriceListOption[]> {
        try {
            const c = core();
            const qs = new URLSearchParams({ active: 'true', ...(customerId ? { customer_id: customerId } : {}) });
            const res = await c.get(`/v1/products/price-lists/${c.getOrgId()}/filter/all?${qs}`);
            return Array.isArray(res) ? res : [];
        } catch {
            return [];
        }
    },
    /** Price for one item, or null when nothing resolves (caller keeps the catalogue price). */
    async resolveOne(itemId: string, opts: Omit<ResolveInput, 'item_ids'> = {}): Promise<ResolvedPrice | null> {
        try {
            const c = core();
            const res = await c.post(`/v1/products/price-lists/${c.getOrgId()}/resolve`, { item_ids: [itemId], ...opts });
            const hit = (res?.prices ?? []).find((p: ResolvedPrice) => p.item_id === itemId);
            return hit && hit.price != null ? hit : null;
        } catch {
            return null;
        }
    },
};

export const documentLayouts = {
    /** Rendered HTML using the org default layout for the doc type, or null on failure. */
    async render(docType: string, document: Record<string, unknown>): Promise<string | null> {
        try {
            const c = core();
            const res = await c.post(`/v1/documents/layouts/${c.getOrgId()}/render`, { doc_type: docType, document });
            return typeof res?.html === 'string' ? res.html : null;
        } catch {
            return null;
        }
    },
};
