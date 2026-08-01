import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, ChevronDown, Loader2, Search } from 'lucide-react';
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

interface AddProductModalProps {
    onClose: () => void;
    onAdd: (item: InventoryItem, qty: number) => void;
}

function AddProductModal({ onClose, onAdd }: AddProductModalProps) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<InventoryItem | null>(null);
    const [qty, setQty] = useState(1);

    const search = useCallback(async (q: string) => {
        if (!q.trim()) { setItems([]); return; }
        setLoading(true);
        try {
            const result = await crmService.searchInventoryItems(q);
            setItems(result.items ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => search(query), 300);
        return () => clearTimeout(t);
    }, [query, search]);

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
                        {!loading && items.length === 0 && query.trim() && (
                            <p className="text-center text-slate-500 text-xs py-8 uppercase font-bold tracking-widest">No products found</p>
                        )}
                        {!loading && items.length === 0 && !query.trim() && (
                            <p className="text-center text-slate-600 text-xs py-8 italic">Start typing to search inventory…</p>
                        )}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelected(item)}
                                    className="w-full text-left p-3 bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">{item.name}</p>
                                            {item.sku && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">SKU: {item.sku}</p>}
                                        </div>
                                        {item.price > 0 && (
                                            <span className="text-xs font-black text-emerald-400">₹{item.price.toLocaleString()}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
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
                />
            )}
        </div>
    );
}
