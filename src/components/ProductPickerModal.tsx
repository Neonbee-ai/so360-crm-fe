import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { Button, TextField } from '@so360/design-system';
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
    /** False until a fetch has completed, so "nothing found" can never precede "nothing asked". */
    const [hasResolved, setHasResolved] = useState(false);
    const [error, setError] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeq = useRef(0);

    const search = useCallback(async (q: string) => {
        const seq = ++requestSeq.current;
        setIsLoading(true);
        setError(false);
        try {
            const result = await crmService.searchInventoryItems(q, undefined, { limit: 50 });
            // A slower earlier keystroke must not overwrite a newer result.
            if (seq !== requestSeq.current) return;
            setItems(result.items);
        } catch {
            if (seq !== requestSeq.current) return;
            setItems([]);
            setError(true);
        } finally {
            if (seq === requestSeq.current) {
                setIsLoading(false);
                setHasResolved(true);
            }
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        // The catalogue loads the moment the dialog opens. Requiring a search
        // term first left users staring at an empty panel and concluding the
        // Inventory had no products at all.
        if (!query.trim()) { search(''); return; }
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, isOpen, search]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setItems([]);
            setExpandedIds(new Set());
            setHasResolved(false);
            setError(false);
            setIsLoading(false);
        }
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
                    <TextField
                        name="product-search"
                        aria-label="Search products"
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                        placeholder="Search by product name or SKU..."
                        leadingIcon={Search}
                    />
                </div>

                {/* Results */}
                <div className="min-h-48 max-h-96 overflow-y-auto -mx-2 px-2">
                    {isLoading && (
                        <div className="space-y-2 pt-2">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-16 text-fg-muted">
                            <Package className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">Couldn't load products.</p>
                            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => search(query)}>
                                Retry
                            </Button>
                        </div>
                    )}

                    {/* Only a *completed* search with nothing in it is "no products". */}
                    {!isLoading && !error && hasResolved && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-fg-muted">
                            <Package className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">
                                {query.trim() ? `No products found for "${query}"` : 'No products in Inventory yet'}
                            </p>
                        </div>
                    )}

                    {!isLoading && items.length > 0 && (
                        <div className="space-y-1">
                            {items.map(item => {
                                const isExpanded = expandedIds.has(item.id);
                                return (
                                    <div key={item.id}>
                                        {/* Parent item row */}
                                        <Button variant="secondary" size="sm" className="w-full group"
                                            onClick={() => item.has_variants ? toggleExpand(item.id) : selectItem(item)}
                                        >
                                            {/* Thumbnail */}
                                            <div className="w-10 h-10 rounded-md overflow-hidden bg-line flex-shrink-0 flex items-center justify-center">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-fg-muted" />
                                                )}
                                            </div>

                                            {/* Name + SKU */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-fg truncate">{item.name}</p>
                                                <p className="text-xs text-fg-muted">{item.sku}</p>
                                            </div>

                                            {/* Price */}
                                            {item.price > 0 ? (
                                                <span className="text-sm text-fg-subtle flex-shrink-0">
                                                    {item.price.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-warning/90 font-medium bg-warning/10 border border-warning/20 px-2 py-0.5 rounded flex-shrink-0">
                                                    No price configured
                                                </span>
                                            )}

                                            {/* Expand chevron or select arrow */}
                                            {item.has_variants ? (
                                                isExpanded
                                                    ? <ChevronDown className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                                                    : <ChevronRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-info opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                            )}
                                        </Button>

                                        {/* Variant rows */}
                                        {item.has_variants && isExpanded && (
                                            <div className="ml-10 space-y-0.5 mb-1">
                                                {(item.variants || []).map(variant => (
                                                    <Button variant="secondary" size="sm" className="w-full group"
                                                        key={variant.id}
                                                        onClick={() => selectVariant(item, variant)}
                                                    >
                                                        {/* Variant thumbnail */}
                                                        <div className="w-8 h-8 rounded overflow-hidden bg-surface-high flex-shrink-0 flex items-center justify-center">
                                                            {variant.image_url ? (
                                                                <img src={variant.image_url} alt={variant.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className="w-4 h-4 text-fg-muted" />
                                                            )}
                                                        </div>

                                                        {/* Variant name + attributes + sku */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {Object.entries(variant.variant_attributes || {}).map(([k, v]) => (
                                                                    <span
                                                                        key={k}
                                                                        className="text-xs px-1.5 py-0.5 bg-line text-fg-subtle rounded"
                                                                    >
                                                                        {v}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-xs text-fg-muted mt-0.5">{variant.sku}</p>
                                                        </div>

                                                        {/* Variant price */}
                                                        {variant.price > 0 ? (
                                                            <span className="text-sm text-fg-subtle flex-shrink-0">
                                                                {variant.price.toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-warning/90 font-medium bg-warning/10 border border-warning/20 px-2 py-0.5 rounded flex-shrink-0">
                                                                No price configured
                                                            </span>
                                                        )}

                                                        <ChevronRight className="w-4 h-4 text-info opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                                    </Button>
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
