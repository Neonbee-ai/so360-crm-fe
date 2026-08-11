import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Plus, Trash2, ChevronDown, Loader2, Search, AlertCircle, Check } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { LeadProduct, ProductInterestStatus, InventoryItem } from '../../types/crm';
import { useCRMFormatters } from '../../utils/formatters';

const STATUS_OPTIONS: { value: ProductInterestStatus; label: string; color: string }[] = [
    { value: 'interested', label: 'Interested', color: 'bg-blue-500/15 text-blue-400' },
    { value: 'quoted', label: 'Quoted', color: 'bg-amber-500/15 text-amber-400' },
    { value: 'approved', label: 'Approved', color: 'bg-emerald-500/15 text-emerald-400' },
    { value: 'ordered', label: 'Ordered', color: 'bg-purple-500/15 text-purple-400' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-rose-500/15 text-rose-400' },
];

function statusStyle(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.color ?? 'bg-slate-700 text-slate-400';
}

const PAGE_SIZE = 25;

/** Case-insensitive match on name / SKU / barcode — used to filter the already
 *  loaded page instantly, so typing never waits on a round trip. */
function matchesQuery(item: InventoryItem, q: string): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const barcode = String((item.metadata as any)?.barcode ?? '');
    return (
        (item.name || '').toLowerCase().includes(needle) ||
        (item.sku || '').toLowerCase().includes(needle) ||
        barcode.toLowerCase().includes(needle)
    );
}

interface AddProductModalProps {
    onClose: () => void;
    onAdd: (item: InventoryItem, qty: number) => void;
    /** item_ids already associated with this record — shown as "Added" and not selectable. */
    existingItemIds: Set<string>;
}

function AddProductModal({ onClose, onAdd, existingItemIds }: AddProductModalProps) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [selected, setSelected] = useState<InventoryItem | null>(null);
    const [qty, setQty] = useState(1);
    const listRef = useRef<HTMLDivElement>(null);
    // Bumped by "Retry" to re-run the current search without touching `query`.
    const [reloadToken, setReloadToken] = useState(0);

    const search = useCallback(async (q: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await crmService.searchInventoryItems(q, undefined, {
                limit: PAGE_SIZE,
                offset: 0,
            });
            setItems(result.items ?? []);
            setHasMore(result.has_more);
        } catch (e: any) {
            setItems([]);
            setHasMore(false);
            setError(e?.message || 'Could not load products.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore || loading || !hasMore) return;
        setLoadingMore(true);
        try {
            const result = await crmService.searchInventoryItems(query, undefined, {
                limit: PAGE_SIZE,
                offset: items.length,
            });
            setItems(prev => [...prev, ...(result.items ?? [])]);
            setHasMore(result.has_more);
        } catch (e: any) {
            setError(e?.message || 'Could not load more products.');
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, loading, hasMore, query, items.length]);

    // Initial browse list loads with an empty term, so the modal opens showing
    // inventory instead of demanding a keyword first.
    useEffect(() => {
        const t = setTimeout(() => search(query), query ? 300 : 0);
        return () => clearTimeout(t);
    }, [query, search, reloadToken]);

    // Infinite scroll — fetch the next page as the list nears its end.
    const handleScroll = () => {
        const el = listRef.current;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore();
    };

    // Filter locally first: results already on screen react to every keystroke,
    // while the debounced request above widens the set beyond the loaded page.
    const visibleItems = items.filter(item => matchesQuery(item, query));

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Add Product</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
                </div>

                {!selected ? (
                    <>
                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search product name or SKU…"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={20} className="animate-spin text-blue-400" />
                            </div>
                        )}
                        {!loading && error && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <AlertCircle size={24} className="text-rose-400" />
                                <p className="text-xs text-slate-400 max-w-xs">{error}</p>
                                <button
                                    onClick={() => setReloadToken(t => t + 1)}
                                    className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                        {/* Empty state is for "nothing matched" only — a failed load
                            shows the error/retry block above instead. */}
                        {!loading && !error && visibleItems.length === 0 && (
                            <p className="text-center text-slate-500 text-xs py-8 uppercase font-bold tracking-widest">
                                {query.trim() ? 'No products match your search' : 'No products in inventory'}
                            </p>
                        )}
                        <div ref={listRef} onScroll={handleScroll} className="space-y-2 max-h-64 overflow-y-auto">
                            {!error && visibleItems.map(item => {
                                const alreadyAdded = existingItemIds.has(item.id);
                                const stock = item.available_stock;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => !alreadyAdded && setSelected(item)}
                                        disabled={alreadyAdded}
                                        title={alreadyAdded ? 'Already added to this record' : undefined}
                                        className={`w-full text-left p-3 bg-slate-800 border rounded-xl transition-all group ${
                                            alreadyAdded
                                                ? 'border-slate-800 opacity-50 cursor-not-allowed'
                                                : 'border-slate-700 hover:border-blue-500/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    {item.sku && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">SKU: {item.sku}</span>}
                                                    {stock != null && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {item.price > 0 && (
                                                    <span className="text-xs font-black text-emerald-400">₹{item.price.toLocaleString()}</span>
                                                )}
                                                {alreadyAdded && <Check size={12} className="text-slate-500" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            {loadingMore && (
                                <div className="flex items-center justify-center py-3">
                                    <Loader2 size={14} className="animate-spin text-blue-400" />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
                            <p className="text-xs font-bold text-slate-100">{selected.name}</p>
                            {selected.sku && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">SKU: {selected.sku}</p>}
                            <button onClick={() => setSelected(null)} className="mt-2 text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors">← Change Product</button>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Quantity</label>
                            <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 border border-slate-700 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-slate-500 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onAdd(selected, qty)}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all"
                            >
                                Add Product
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface Props {
    leadId: string;
    onStatsChange?: (count: number, value: number) => void;
}

export default function LeadProductsTab({ leadId, onStatsChange }: Props) {
    const formatters = useCRMFormatters();
    const [products, setProducts] = useState<LeadProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await crmService.getLeadProducts(leadId);
            setProducts(data);
            const totalValue = data.reduce((s, p) => s + p.quantity * p.unit_price, 0);
            onStatsChange?.(data.length, totalValue);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [leadId, onStatsChange]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (item: InventoryItem, qty: number) => {
        setShowAddModal(false);
        try {
            await crmService.addLeadProduct(leadId, {
                item_id: item.id,
                item_name: item.name,
                item_sku: item.sku,
                quantity: qty,
                unit_price: item.price ?? 0,
            });
            load();
        } catch { /* ignore */ }
    };

    const handleStatusChange = async (product: LeadProduct, status: ProductInterestStatus) => {
        setUpdatingId(product.id);
        try {
            await crmService.updateLeadProduct(leadId, product.id, { status });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status } : p));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleQtyChange = async (product: LeadProduct, quantity: number) => {
        if (quantity < 1) return;
        setUpdatingId(product.id);
        try {
            await crmService.updateLeadProduct(leadId, product.id, { quantity });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity } : p));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleRemove = async (productId: string) => {
        try {
            await crmService.removeLeadProduct(leadId, productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch { /* ignore */ }
    };

    const totalValue = products.reduce((s, p) => s + p.quantity * p.unit_price, 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Products ({products.length})</p>
                    {products.length > 0 && (
                        <p className="text-xs text-emerald-400 font-bold mt-0.5">
                            Est. Value: {formatters.formatCurrency(totalValue)}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    <Plus size={12} /> Add Product
                </button>
            </div>

            {/* Product list */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <Package size={32} className="mx-auto mb-3 text-slate-700 opacity-40" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No products added yet</p>
                    <p className="text-xs text-slate-600 mt-1">Add products from inventory to track interest</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {products.map(product => {
                        const lineTotal = product.quantity * product.unit_price;
                        return (
                            <div key={product.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 group hover:border-slate-700 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-100 truncate">{product.item_name}</p>
                                        {product.item_sku && (
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">SKU: {product.item_sku}</p>
                                        )}
                                        {product.category_name && (
                                            <p className="text-[9px] text-slate-600 mt-0.5">{product.category_name}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemove(product.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-rose-400 transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                    {/* Quantity */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Qty</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={product.quantity}
                                            disabled={updatingId === product.id}
                                            onChange={e => handleQtyChange(product, parseInt(e.target.value) || 1)}
                                            onBlur={e => handleQtyChange(product, parseInt(e.target.value) || 1)}
                                            className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 text-center focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Unit price */}
                                    {product.unit_price > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">@ {formatters.formatCurrency(product.unit_price)}</span>
                                        </div>
                                    )}

                                    {/* Line total */}
                                    {lineTotal > 0 && (
                                        <span className="text-xs font-black text-emerald-400 ml-auto">
                                            {formatters.formatCurrency(lineTotal)}
                                        </span>
                                    )}

                                    {/* Status */}
                                    <div className="relative ml-auto">
                                        <select
                                            value={product.status}
                                            disabled={updatingId === product.id}
                                            onChange={e => handleStatusChange(product, e.target.value as ProductInterestStatus)}
                                            className={`appearance-none text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-0 cursor-pointer focus:outline-none pr-6 ${statusStyle(product.status)}`}
                                        >
                                            {STATUS_OPTIONS.map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showAddModal && (
                <AddProductModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAdd}
                    existingItemIds={new Set(products.map(p => p.item_id))}
                />
            )}
        </div>
    );
}
