import { EmptyState } from '@so360/design-system';
import React, { useState, useEffect, useCallback } from 'react';
import { Button, IconButton, TextField, NumberInput, Select, Checkbox } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';
import { Package, Plus, Trash2, Loader2, Search, Copy } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { DealProduct, LeadProduct, ProductInterestStatus, InventoryItem } from '../../types/crm';
import { useCRMFormatters } from '../../utils/formatters';
import { useCrmFeatureFlag, RE_FLAGS } from '../../hooks/useCrmFeatureFlag';
import { UnitBookingControls } from '../../components/unitBooking/UnitBookingControls';
import { ReservationChip } from '../../components/unitBooking/ReservationChip';
import { DEFAULT_HOLD_HOURS, filterAvailable, unitBookingErrorMessage } from '../../components/unitBooking/unitBooking';
import { MatchingUnitsPanel } from '../../components/matching/MatchingUnitsPanel';
import { MatchingUnit, unitLabel } from '../../services/matchingUnitsService';

const STATUS_OPTIONS: { value: ProductInterestStatus; label: string; color: string }[] = [
    { value: 'interested', label: 'Interested', color: 'bg-info/15 text-info' },
    { value: 'quoted', label: 'Quoted', color: 'bg-warning/15 text-warning' },
    { value: 'approved', label: 'Approved', color: 'bg-success/15 text-success' },
    { value: 'ordered', label: 'Ordered', color: 'bg-primary/15 text-primary' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-danger/15 text-danger' },
];

function statusStyle(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status)?.color ?? 'bg-line text-fg-subtle';
}

interface AddProductModalProps {
    dealId: string;
    leadId?: string;
    onClose: () => void;
    onAdd: (item: InventoryItem, qty: number, holdHours?: number) => void;
    onImportFromLead: (products: LeadProduct[]) => void;
    /** Unit booking (flag `submodule:crm:unit_booking`): project filter, availability, hold. */
    unitBooking?: boolean;
}

function AddProductModal({ dealId, leadId, onClose, onAdd, onImportFromLead, unitBooking = false }: AddProductModalProps) {
    const [tab, setTab] = useState<'search' | 'from-lead'>(leadId ? 'from-lead' : 'search');
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<InventoryItem | null>(null);
    const [qty, setQty] = useState(1);
    const [leadProducts, setLeadProducts] = useState<LeadProduct[]>([]);
    const [leadLoading, setLeadLoading] = useState(false);
    const [selectedLeadProducts, setSelectedLeadProducts] = useState<Set<string>>(new Set());
    const [projectId, setProjectId] = useState('');
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [holdHours, setHoldHours] = useState<number>(DEFAULT_HOLD_HOURS);
    const categoryId = unitBooking && projectId ? projectId : undefined;

    useEffect(() => {
        if (tab === 'from-lead' && leadId) {
            setLeadLoading(true);
            crmService.getLeadProducts(leadId)
                .then(data => setLeadProducts(data))
                .catch(() => setLeadProducts([]))
                .finally(() => setLeadLoading(false));
        }
    }, [tab, leadId]);

    const search = useCallback(async (q: string) => {
        // With a project picked, list its units even before typing.
        if (!q.trim() && !categoryId) { setItems([]); return; }
        setLoading(true);
        try {
            const result = categoryId
                ? await crmService.searchInventoryItems(q, categoryId)
                : await crmService.searchInventoryItems(q);
            setItems(result.items ?? []);
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    const visibleItems = filterAvailable(items, unitBooking && onlyAvailable);
    const hasCriteria = !!query.trim() || !!categoryId;

    useEffect(() => {
        if (tab !== 'search') return;
        const t = setTimeout(() => search(query), 300);
        return () => clearTimeout(t);
    }, [query, search, tab]);

    const toggleLeadProduct = (id: string) => {
        setSelectedLeadProducts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add Product to Deal"
            size="lg"
            footer={tab === 'from-lead' ? (
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={selectedLeadProducts.size === 0}
                        onClick={() => onImportFromLead(leadProducts.filter(lp => selectedLeadProducts.has(lp.id)))}
                    >
                        Add {selectedLeadProducts.size > 0 ? `(${selectedLeadProducts.size})` : ''}
                    </Button>
                </>
            ) : selected ? (
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={() => onAdd(selected, qty, unitBooking ? holdHours : undefined)}>Add Product</Button>
                </>
            ) : undefined}
        >
                {/* Tabs */}
                {leadId && (
                    <div className="flex gap-1 mb-4 bg-surface-high rounded-nb-lg p-1">
                        <Button variant={tab === 'from-lead' ? 'primary' : 'secondary'} size="sm" className="flex-1" onClick={() => setTab('from-lead')}>
                            <Copy size={10} className="inline mr-1" />From Lead
                        </Button>
                        <Button variant={tab === 'search' ? 'primary' : 'secondary'} size="sm" className="flex-1" onClick={() => setTab('search')}>
                            <Search size={10} className="inline mr-1" />Search Inventory
                        </Button>
                    </div>
                )}

                {/* From-lead tab */}
                {tab === 'from-lead' && (
                    <>
                        {leadLoading ? (
                            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-info" /></div>
                        ) : leadProducts.length === 0 ? (
                            <p className="text-center text-fg-muted text-xs py-8 font-bold">No products on lead</p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                                {leadProducts.map(lp => (
                                    <div key={lp.id} className="flex items-center gap-3 p-3 bg-surface-raised border border-line rounded-nb-lg hover:border-info/50 transition-all">
                                        <Checkbox
                                            name={`lead-product-${lp.id}`}
                                            label={lp.item_name}
                                            checked={selectedLeadProducts.has(lp.id)}
                                            onChange={() => toggleLeadProduct(lp.id)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-fg-muted font-bold mt-0.5">
                                                Qty: {lp.quantity} · {lp.unit_price > 0 ? `₹${lp.unit_price.toLocaleString()}` : 'No price'}
                                            </p>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${statusStyle(lp.status)}`}>{lp.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Search inventory tab */}
                {tab === 'search' && (
                    <>
                        {!selected ? (
                            <>
                                <div className="relative mb-4">
                                    <TextField
                                        name="product-search"
                                        aria-label="Search products"
                                        leadingIcon={Search}
                                        autoFocus
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Search product name or SKU…"
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
                                {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-info" /></div>}
                                {!loading && visibleItems.length === 0 && hasCriteria && (
                                    <p className="text-center text-fg-muted text-xs py-8 font-bold">No products found</p>
                                )}
                                {!loading && !hasCriteria && (
                                    <p className="text-center text-fg-muted text-xs py-8 italic">Start typing to search inventory…</p>
                                )}
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {visibleItems.map(item => (
                                        <Button variant="secondary" size="sm" className="w-full text-left h-auto justify-start" key={item.id} onClick={() => setSelected(item)}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold text-fg group-hover:text-info transition-colors">{item.name}</p>
                                                    {item.sku && <p className="text-xs text-fg-muted font-bold mt-0.5">SKU: {item.sku}</p>}
                                                </div>
                                                {item.price > 0 && <span className="text-xs font-semibold text-success">₹{item.price.toLocaleString()}</span>}
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-surface-raised border border-line rounded-nb-lg">
                                    <p className="text-xs font-bold text-fg">{selected.name}</p>
                                    {selected.sku && <p className="text-xs text-fg-muted font-bold mt-0.5">SKU: {selected.sku}</p>}
                                    <Button variant="secondary" size="sm" type="button" onClick={() => setSelected(null)}>← Change</Button>
                                </div>
                                <div>
                                    <NumberInput name="product-qty" label="Quantity" min={1} value={qty} onChange={v => setQty(Math.max(1, Math.floor(v || 1)))} />
                                </div>
                            </div>
                        )}
                    </>
                )}
        </Modal>
    );
}

interface Props {
    dealId: string;
    leadId?: string;
}

export default function DealProductsTab({ dealId, leadId }: Props) {
    const formatters = useCRMFormatters();
    const unitBooking = useCrmFeatureFlag(RE_FLAGS.UNIT_BOOKING);
    const propertyMatching = useCrmFeatureFlag(RE_FLAGS.PROPERTY_MATCHING);
    const [products, setProducts] = useState<DealProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await crmService.getDealProducts(dealId);
            setProducts(data);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [dealId]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (item: InventoryItem, qty: number, holdHours?: number) => {
        setShowAddModal(false);
        setAddError(null);
        try {
            await crmService.addDealProduct(dealId, {
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

    const handleImportFromLead = async (selected: LeadProduct[]) => {
        setShowAddModal(false);
        try {
            await Promise.all(selected.map(lp =>
                crmService.addDealProduct(dealId, {
                    item_id: lp.item_id,
                    item_name: lp.item_name,
                    item_sku: lp.item_sku,
                    category_name: lp.category_name,
                    quantity: lp.quantity,
                    unit_price: lp.unit_price,
                    status: lp.status,
                    lead_product_id: lp.id,
                })
            ));
            load();
        } catch { /* ignore */ }
    };

    // A9: attach a matched unit through the same add-product call (and the
    // same default hold when unit booking is on).
    const handleAttachMatch = async (unit: MatchingUnit) => {
        setAddError(null);
        try {
            await crmService.addDealProduct(dealId, {
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

    const handleStatusChange = async (product: DealProduct, status: ProductInterestStatus) => {
        setUpdatingId(product.id);
        try {
            await crmService.updateDealProduct(dealId, product.id, { status });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status } : p));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleQtyChange = async (product: DealProduct, quantity: number) => {
        if (quantity < 1) return;
        setUpdatingId(product.id);
        try {
            await crmService.updateDealProduct(dealId, product.id, { quantity });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity } : p));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleRemove = async (productId: string) => {
        try {
            await crmService.removeDealProduct(dealId, productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch { /* ignore */ }
    };

    const totalValue = products.reduce((s, p) => s + p.quantity * p.unit_price, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold text-fg-muted">Products ({products.length})</p>
                    {products.length > 0 && (
                        <p className="text-xs text-success font-bold mt-0.5">
                            Deal Value: {formatters.formatCurrency(totalValue)}
                        </p>
                    )}
                </div>
                <Button variant="primary" size="sm" type="button" onClick={() => setShowAddModal(true)}>
                    <Plus size={12} /> Add Product
                </Button>
            </div>

            {addError && (
                <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-nb-lg px-3 py-2">
                    {addError}
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-info" /></div>
            ) : products.length === 0 ? (
                <EmptyState title="No products in this deal" description={leadId ? 'Import from lead or add from inventory' : 'Add products from inventory'} />
            ) : (
                <div className="space-y-3">
                    {products.map(product => {
                        const lineTotal = product.quantity * product.unit_price;
                        return (
                            <div key={product.id} className="bg-surface-sunken border border-line rounded-nb-lg p-4 group hover:border-line transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <p className="text-xs font-bold text-fg truncate">{product.item_name}</p>
                                            {unitBooking && (
                                                <ReservationChip
                                                    status={product.reservation_status}
                                                    expiresAt={product.reservation_expires_at}
                                                />
                                            )}
                                        </div>
                                        {product.item_sku && (
                                            <p className="text-xs font-semibold text-fg-muted mt-0.5">SKU: {product.item_sku}</p>
                                        )}
                                    </div>
                                    <IconButton
                                        label="Remove product"
                                        variant="danger"
                                        className="opacity-0 group-hover:opacity-100"
                                        icon={<Trash2 size={12} />}
                                        onClick={() => handleRemove(product.id)}
                                    />
                                </div>

                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-fg-muted">Qty</span>
                                        <NumberInput
                                            name={`product-qty-${product.id}`}
                                            aria-label="Quantity"
                                            size="sm"
                                            min={1}
                                            value={product.quantity}
                                            disabled={updatingId === product.id}
                                            onChange={v => handleQtyChange(product, Math.floor(v || 1))}
                                        />
                                    </div>
                                    {product.unit_price > 0 && (
                                        <span className="text-xs font-semibold text-fg-muted">@ {formatters.formatCurrency(product.unit_price)}</span>
                                    )}
                                    {lineTotal > 0 && (
                                        <span className="text-xs font-semibold text-success ml-auto">{formatters.formatCurrency(lineTotal)}</span>
                                    )}
                                    <div className="ml-auto">
                                        <Select
                                            name={`product-status-${product.id}`}
                                            aria-label="Status"
                                            size="sm"
                                            value={product.status}
                                            disabled={updatingId === product.id}
                                            options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                                            onChange={e => handleStatusChange(product, e.target.value as ProductInterestStatus)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {propertyMatching && (
                <MatchingUnitsPanel
                    entity="deal"
                    id={dealId}
                    existingItemIds={new Set(products.map(p => p.item_id).filter(Boolean) as string[])}
                    onAttach={handleAttachMatch}
                />
            )}

            {showAddModal && (
                <AddProductModal
                    dealId={dealId}
                    leadId={leadId}
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAdd}
                    onImportFromLead={handleImportFromLead}
                    unitBooking={unitBooking}
                />
            )}
        </div>
    );
}
