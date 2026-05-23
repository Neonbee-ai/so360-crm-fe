import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { Modal } from './common/Modal';
import { Skeleton } from './common/Skeleton';
import { crmService } from '../services/crmService';
import { InventoryItem, InventoryVariant, ProductPickerSelection } from '../types/crm';

interface ProductPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selection: ProductPickerSelection) => void;
}

export const ProductPickerModal = ({ isOpen, onClose, onSelect }: ProductPickerModalProps) => {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = useCallback(async (q: string) => {
        setIsLoading(true);
        try {
            const result = await crmService.searchInventoryItems(q);
            setItems(result.items);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) { setItems([]); setIsLoading(false); return; }
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, isOpen, search]);

    useEffect(() => {
        if (!isOpen) { setQuery(''); setItems([]); setExpandedIds(new Set()); }
    }, [isOpen]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectItem = (item: InventoryItem) => {
        onSelect({
            item_id: item.id,
            variant_id: item.id,
            name: item.name,
            sku: item.sku,
            sub_sku: 'NIL',
            unit_price: item.price,
            image_url: item.image_url,
        });
        onClose();
    };

    const selectVariant = (item: InventoryItem, variant: InventoryVariant) => {
        onSelect({
            item_id: item.id,
            variant_id: variant.id,
            name: item.name,
            sku: item.sku,
            sub_sku: variant.sku,
            unit_price: variant.price,
            image_url: variant.image_url ?? item.image_url,
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Product" size="xl">
            <div className="space-y-4">
                {/* Search input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by product name or SKU..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>

                {/* Results */}
                <div className="min-h-[200px] max-h-[420px] overflow-y-auto -mx-2 px-2">
                    {isLoading && (
                        <div className="space-y-2 pt-2">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    )}

                    {!isLoading && !query.trim() && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Search className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">Search for products by name or SKU</p>
                        </div>
                    )}

                    {!isLoading && query.trim() && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Package className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">No products found for "{query}"</p>
                        </div>
                    )}

                    {!isLoading && items.length > 0 && (
                        <div className="space-y-1">
                            {items.map(item => {
                                const isExpanded = expandedIds.has(item.id);
                                return (
                                    <div key={item.id}>
                                        {/* Parent item row */}
                                        <button
                                            onClick={() => item.has_variants ? toggleExpand(item.id) : selectItem(item)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-left group"
                                        >
                                            {/* Thumbnail */}
                                            <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-700 flex-shrink-0 flex items-center justify-center">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-slate-500" />
                                                )}
                                            </div>

                                            {/* Name + SKU */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                                                <p className="text-xs text-slate-500">{item.sku}</p>
                                            </div>

                                            {/* Price */}
                                            <span className="text-sm text-slate-300 flex-shrink-0">
                                                {item.price.toFixed(2)}
                                            </span>

                                            {/* Expand chevron or select arrow */}
                                            {item.has_variants ? (
                                                isExpanded
                                                    ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                            )}
                                        </button>

                                        {/* Variant rows */}
                                        {item.has_variants && isExpanded && (
                                            <div className="ml-10 space-y-0.5 mb-1">
                                                {(item.variants || []).map(variant => (
                                                    <button
                                                        key={variant.id}
                                                        onClick={() => selectVariant(item, variant)}
                                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left group"
                                                    >
                                                        {/* Variant thumbnail */}
                                                        <div className="w-8 h-8 rounded overflow-hidden bg-slate-700/80 flex-shrink-0 flex items-center justify-center">
                                                            {variant.image_url ? (
                                                                <img src={variant.image_url} alt={variant.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className="w-4 h-4 text-slate-600" />
                                                            )}
                                                        </div>

                                                        {/* Variant name + attributes + sku */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {Object.entries(variant.variant_attributes || {}).map(([k, v]) => (
                                                                    <span
                                                                        key={k}
                                                                        className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded"
                                                                    >
                                                                        {v}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5">{variant.sku}</p>
                                                        </div>

                                                        {/* Variant price */}
                                                        <span className="text-sm text-slate-300 flex-shrink-0">
                                                            {variant.price.toFixed(2)}
                                                        </span>

                                                        <ChevronRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
