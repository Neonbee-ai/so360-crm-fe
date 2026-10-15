import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Badge, EmptyState } from '@so360/design-system';
import { Package, Plus, Trash2, ChevronDown, Loader2, Search, AlertCircle, Check, Sparkles } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { LeadProduct, ProductInterestStatus, InventoryItem } from '../../types/crm';
import { useCRMFormatters } from '../../utils/formatters';
import { CustomProductBuildRequestModal } from '../../components/leads/CustomProductBuildRequestModal';
import { useCrmFeatureFlag, RE_FLAGS } from '../../hooks/useCrmFeatureFlag';
import { UnitBookingControls } from '../../components/unitBooking/UnitBookingControls';
import { ReservationChip } from '../../components/unitBooking/ReservationChip';
import { DEFAULT_HOLD_HOURS, filterAvailable, unitBookingErrorMessage } from '../../components/unitBooking/unitBooking';
import { MatchingUnitsPanel } from '../../components/matching/MatchingUnitsPanel';
import { MatchingUnit, unitLabel } from '../../services/matchingUnitsService';

const STATUS_OPTIONS: { value: ProductInterestStatus; label: string; color: string }[] = [
    { value: 'interested', label: 'Interested', color: 'bg-primary/15 text-primary' },
    { value: 'quoted', label: 'Quoted', color: 'bg-warning/15 text-warning' },
    { value: 'approved', label: 'Approved', color: 'bg-success/15 text-success' },
    { value: 'ordered', label: 'Ordered', color: 'bg-info/15 text-info' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-danger/15 text-danger' },
];

function statusStyle(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.color ?? 'bg-line text-fg-subtle';
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
    onAdd: (item: InventoryItem, qty: number, holdHours?: number) => void;
    /** item_ids already associated with this record — shown as "Added" and not selectable. */
    existingItemIds: Set<string>;
    /** Unit booking (flag `submodule:crm:unit_booking`): project filter, availability, hold. */
    unitBooking?: boolean;
}

function AddProductModal({ onClose, onAdd, existingItemIds, unitBooking = false }: AddProductModalProps) {
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
    const [projectId, setProjectId] = useState('');
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [holdHours, setHoldHours] = useState<number>(DEFAULT_HOLD_HOURS);
    const categoryId = unitBooking && projectId ? projectId : undefined;

    const search = useCallback(async (q: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await crmService.searchInventoryItems(q, categoryId, {
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
    }, [categoryId]);

    const loadMore = useCallback(async () => {
        if (loadingMore || loading || !hasMore) return;
        setLoadingMore(true);
        try {
            const result = await crmService.searchInventoryItems(query, categoryId, {
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
    }, [loadingMore, loading, hasMore, query, items.length, categoryId]);

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
    const visibleItems = filterAvailable(
        items.filter(item => matchesQuery(item, query)),
        unitBooking && onlyAvailable,
    );

    return (
        <div className="fixed inset-0 z-dialog flex items-center justify-center bg-overlay backdrop-blur-sm">
            <div className="bg-surface border border-line rounded-nb-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-medium text-fg">Add Product</h3>
                    <button onClick={onClose} className="text-fg-muted hover:text-fg-subtle transition-colors">✕</button>
                </div>

                {!selected ? (
                    <>
                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search product name or SKU…"
                                className="w-full bg-surface-raised border border-line rounded-nb pl-9 pr-4 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                            />
                        </div>
                        {unitBooking && (
                            <UnitBookingControls
                                projectId={projectId}
                                onProjectChange={setProjectId}
                                onlyAvailable={onlyAvailable}
                                onOnlyAvailableChange={setOnlyAvailable}
                                holdHours={holdHours}
                                onHoldHoursChange={setHoldHours}
                            />
                        )}
                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={20} className="animate-spin text-primary" />
                            </div>
                        )}
                        {!loading && error && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <AlertCircle size={24} className="text-danger" />
                                <p className="text-xs text-fg-subtle max-w-xs">{error}</p>
                                <button
                                    onClick={() => setReloadToken(t => t + 1)}
                                    className="px-4 py-2 bg-surface-raised border border-line hover:border-primary/50 rounded-nb text-xs font-medium text-fg-subtle transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                        {/* Empty state is for "nothing matched" only — a failed load
                            shows the error/retry block above instead. */}
                        {!loading && !error && visibleItems.length === 0 && (
                            <p className="text-center text-fg-muted text-xs py-8 font-medium">
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
                                        className={`w-full text-left p-3 bg-surface-raised border rounded-nb transition-all group ${
 alreadyAdded
 ? 'border-line opacity-50 cursor-not-allowed'
 : 'border-line hover:border-primary/50'
 }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-fg group-hover:text-primary transition-colors truncate">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    {item.sku && <span className="text-xs text-fg-muted font-medium">SKU: {item.sku}</span>}
                                                    {stock != null && (
                                                        <span className={`text-xs font-medium ${stock > 0 ? 'text-success' : 'text-danger'}`}>
                                                            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {item.price > 0 && (
                                                    <span className="text-xs font-medium text-success">₹{item.price.toLocaleString()}</span>
                                                )}
                                                {alreadyAdded && <Check size={12} className="text-fg-muted" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            {loadingMore && (
                                <div className="flex items-center justify-center py-3">
                                    <Loader2 size={14} className="animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-surface-raised border border-line rounded-nb">
                            <p className="text-xs font-medium text-fg">{selected.name}</p>
                            {selected.sku && <p className="text-xs text-fg-muted font-medium mt-0.5">SKU: {selected.sku}</p>}
                            <button onClick={() => setSelected(null)} className="mt-2 text-xs text-fg-muted hover:text-primary font-medium transition-colors">← Change Product</button>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">Quantity</label>
                            <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-surface-raised border border-line rounded-nb px-4 py-2.5 text-sm text-fg focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 border border-line rounded-nb text-xs font-medium text-fg-subtle hover:border-line transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onAdd(selected, qty, unitBooking ? holdHours : undefined)}
                                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 rounded-nb text-xs font-medium text-primary-fg transition-all"
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
    const unitBooking = useCrmFeatureFlag(RE_FLAGS.UNIT_BOOKING);
    const propertyMatching = useCrmFeatureFlag(RE_FLAGS.PROPERTY_MATCHING);
    const [products, setProducts] = useState<LeadProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCustomBuildModal, setShowCustomBuildModal] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

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

    const handleAdd = async (item: InventoryItem, qty: number, holdHours?: number) => {
        setShowAddModal(false);
        setAddError(null);
        try {
            await crmService.addLeadProduct(leadId, {
                item_id: item.id,
                item_name: item.name,
                item_sku: item.sku,
                quantity: qty,
                unit_price: item.price ?? 0,
                ...(holdHours != null ? { hold_hours: holdHours } : {}),
            });
            load();
        } catch (e: any) {
            // e.g. the backend rejecting a non-sellable item, or a 409 for a
            // unit already held/sold — say why instead of the product
            // silently not appearing.
            setAddError(unitBookingErrorMessage(e, 'Could not add the product.'));
        }
    };

    const handleCustomBuildSubmit = async (data: {
        item_name: string;
        category_id: string;
        category_name: string;
        is_custom_build: boolean;
        quantity: number;
        unit_price: number;
        notes?: string;
    }) => {
        await crmService.addLeadProduct(leadId, data);
        load();
    };

    // A9: attach a matched unit through the same add-product call (and the
    // same default hold when unit booking is on).
    const handleAttachMatch = async (unit: MatchingUnit) => {
        setAddError(null);
        try {
            await crmService.addLeadProduct(leadId, {
                item_id: unit.item_id,
                item_name: unitLabel(unit),
                quantity: 1,
                unit_price: unit.price ?? 0,
                ...(unitBooking ? { hold_hours: DEFAULT_HOLD_HOURS } : {}),
            });
            load();
        } catch (e: any) {
            setAddError(unitBookingErrorMessage(e, 'Could not attach the unit.'));
        }
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
                    <p className="text-xs font-medium text-fg-muted">Products ({products.length})</p>
                    {products.length > 0 && (
                        <p className="text-xs text-success font-medium mt-0.5">
                            Est. Value: {formatters.formatCurrency(totalValue)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setShowCustomBuildModal(true)}>
                        <Sparkles size={12} /> Custom build request
                    </Button>
                    <Button variant="primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={12} /> Add product
                    </Button>
                </div>
            </div>

            {addError && (
                <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-nb px-3 py-2">
                    {addError}
                </p>
            )}

            {/* Product list */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
                </div>
            ) : products.length === 0 ? (
                <EmptyState icon={Package} title="No products added yet" description="Add products from inventory or create a custom build request." />
            ) : (
                <div className="divide-y divide-line">
                    {products.map(product => {
                        const lineTotal = product.quantity * product.unit_price;
                        return (
                            <div key={product.id} className="py-nb-3 first:pt-0 last:pb-0 group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-xs font-medium text-fg truncate">{product.item_name}</p>
                                            {product.is_custom_build && (
                                                <Badge tone="warning" size="sm">Custom build</Badge>
                                            )}
                                            {unitBooking && (
                                                <ReservationChip
                                                    status={product.reservation_status}
                                                    expiresAt={product.reservation_expires_at}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {product.item_sku && (
                                                <p className="text-xs font-medium text-fg-muted">SKU: {product.item_sku}</p>
                                            )}
                                            {product.category_name && (
                                                <Badge size="sm">{product.category_name}</Badge>
                                            )}
                                        </div>
                                        {product.notes && (
                                            <p className="text-xs text-fg-subtle mt-1.5">
                                                {product.notes}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemove(product.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-fg-muted hover:text-danger transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                    {/* Quantity */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-fg-muted">Qty</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={product.quantity}
                                            disabled={updatingId === product.id}
                                            onChange={e => handleQtyChange(product, parseInt(e.target.value) || 1)}
                                            onBlur={e => handleQtyChange(product, parseInt(e.target.value) || 1)}
                                            className="w-16 bg-surface-raised border border-line rounded-nb px-2 py-1 text-xs text-fg text-center focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Unit price */}
                                    {product.unit_price > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-medium text-fg-muted">@ {formatters.formatCurrency(product.unit_price)}</span>
                                        </div>
                                    )}

                                    {/* Line total */}
                                    {lineTotal > 0 && (
                                        <span className="text-xs font-medium text-success ml-auto">
                                            {formatters.formatCurrency(lineTotal)}
                                        </span>
                                    )}

                                    {/* Status */}
                                    <div className="relative ml-auto">
                                        <select
                                            value={product.status}
                                            disabled={updatingId === product.id}
                                            onChange={e => handleStatusChange(product, e.target.value as ProductInterestStatus)}
                                            className={`appearance-none text-xs font-medium px-2.5 py-1 rounded-nb border-0 cursor-pointer focus:outline-none pr-6 ${statusStyle(product.status)}`}
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

            {propertyMatching && (
                <MatchingUnitsPanel
                    entity="lead"
                    id={leadId}
                    existingItemIds={new Set(products.map(p => p.item_id).filter(Boolean) as string[])}
                    onAttach={handleAttachMatch}
                />
            )}

            {showAddModal && (
                <AddProductModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAdd}
                    existingItemIds={new Set(products.map(p => p.item_id).filter(Boolean) as string[])}
                    unitBooking={unitBooking}
                />
            )}

            {showCustomBuildModal && (
                <CustomProductBuildRequestModal
                    isOpen={showCustomBuildModal}
                    onClose={() => setShowCustomBuildModal(false)}
                    onSubmit={handleCustomBuildSubmit}
                />
            )}
        </div>
    );
}
