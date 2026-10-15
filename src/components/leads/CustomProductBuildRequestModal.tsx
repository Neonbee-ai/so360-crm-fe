import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button, TextField, Select, NumberInput, Textarea } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { buildCategoryTree, flattenCategoryTree, indentLabel } from '../../utils/categoryTree';

interface CategoryOption {
    id: string;
    name: string;
    parent_id?: string | null;
}

interface CustomProductBuildRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        item_name: string;
        category_id: string;
        category_name: string;
        is_custom_build: boolean;
        quantity: number;
        unit_price: number;
        notes?: string;
    }) => Promise<void>;
}

export const CustomProductBuildRequestModal: React.FC<CustomProductBuildRequestModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState<string>('');
    const [specifications, setSpecifications] = useState('');

    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categorySearch, setCategorySearch] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setName('');
            setCategoryId('');
            setQuantity(1);
            setUnitPrice('');
            setSpecifications('');
            setError(null);
            setCategorySearch('');
            return;
        }

        let mounted = true;
        setLoadingCategories(true);
        crmService.getProductCategories()
            .then(cats => {
                if (mounted) {
                    setCategories(cats);
                }
            })
            .catch(() => {
                if (mounted) {
                    setCategories([]);
                }
            })
            .finally(() => {
                if (mounted) {
                    setLoadingCategories(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, [isOpen]);

    // Same hierarchy Inventory owns — parent immediately followed by its
    // children, depth-first, so the flat <select> still reads as a tree via
    // indentation instead of an alphabetical dump with no structure.
    const hierarchicalCategories = useMemo(
        () => flattenCategoryTree(buildCategoryTree(categories)),
        [categories]
    );

    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return hierarchicalCategories;
        const q = categorySearch.toLowerCase();
        return hierarchicalCategories.filter(c => c.name.toLowerCase().includes(q));
    }, [hierarchicalCategories, categorySearch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('Product name is required.');
            return;
        }

        if (!categoryId) {
            setError('Product category is required for custom product build requests.');
            return;
        }

        const selectedCat = categories.find(c => c.id === categoryId);
        const categoryName = selectedCat ? selectedCat.name : categorySearch.trim() || 'Custom';

        const parsedPrice = parseFloat(unitPrice) || 0;
        const parsedQty = Math.max(1, quantity || 1);

        setSubmitting(true);
        try {
            await onSubmit({
                item_name: name.trim(),
                category_id: categoryId,
                category_name: categoryName,
                is_custom_build: true,
                quantity: parsedQty,
                unit_price: parsedPrice,
                notes: specifications.trim() || undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to create custom product build request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Custom Product Build Request" size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-info/10 border border-info/20 rounded-xl text-info text-xs">
                    <Sparkles className="w-4 h-4 flex-shrink-0 text-primary" />
                    <span>
                        Configure a custom build request for non-catalog items. Category selection from the master is required.
                    </span>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Product Name */}
                <TextField
                    name="name"
                    label="Product / Build Name"
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Bespoke Teak Boardroom Table"
                    disabled={submitting}
                    autoFocus
                />

                {/* Product Category (Mandatory) */}
                <div>
                    <Select
                        name="category_id"
                        label="Product Category"
                        required
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        disabled={submitting || loadingCategories}
                        placeholder="-- Select Product Category --"
                        options={filteredCategories.map(cat => ({ value: cat.id, label: indentLabel(cat.name, cat.depth) }))}
                    />
                    {loadingCategories && (
                        <span className="text-xs text-fg-subtle flex items-center gap-1 mt-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading categories...
                        </span>
                    )}
                    {categories.length === 0 && !loadingCategories && (
                        <p className="text-xs text-warning/90 mt-1">
                            No categories found in Inventory. Please ensure categories are configured in Inventory Settings.
                        </p>
                    )}
                </div>

                {/* Quantity & Target Unit Price */}
                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                    <NumberInput
                        name="quantity"
                        label="Quantity"
                        min={1}
                        required
                        value={quantity}
                        onChange={v => setQuantity(Math.max(1, Math.trunc(v ?? 0) || 1))}
                        disabled={submitting}
                    />
                    <NumberInput
                        name="unit_price"
                        label="Est. Target Unit Price"
                        min={0}
                        step={0.01}
                        value={unitPrice === '' || unitPrice == null ? null : Number(unitPrice)}
                        onChange={v => setUnitPrice(v === null ? '' : String(v))}
                        placeholder="0.00"
                        disabled={submitting}
                    />
                </div>

                {/* Specifications / Notes */}
                <Textarea
                    name="specifications"
                    label="Build Specifications & Requirements"
                    rows={3}
                    value={specifications}
                    onChange={e => setSpecifications(e.target.value)}
                    placeholder="Add dimensions, materials, finishes, or custom customer requirements..."
                    disabled={submitting}
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={submitting || !name.trim() || !categoryId}>
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Submit Build Request</span>
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
