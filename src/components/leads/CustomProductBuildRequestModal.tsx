import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { RequiredMark } from '../common/RequiredMark';
import { EDITABLE_FIELD_CLASS } from '../common/fieldStyles';
import { crmService } from '../../services/crmService';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface CategoryOption {
    id: string;
    name: string;
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

    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return categories;
        const q = categorySearch.toLowerCase();
        return categories.filter(c => c.name.toLowerCase().includes(q));
    }, [categories, categorySearch]);

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
                <div className="flex items-center gap-2 p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-blue-300 text-xs">
                    <Sparkles className="w-4 h-4 flex-shrink-0 text-blue-400" />
                    <span>
                        Configure a custom build request for non-catalog items. Category selection from the master is required.
                    </span>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Product Name */}
                <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Product / Build Name <RequiredMark />
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g., Bespoke Teak Boardroom Table"
                        className={`${EDITABLE_FIELD_CLASS} w-full text-sm`}
                        disabled={submitting}
                        autoFocus
                    />
                </div>

                {/* Product Category (Mandatory) */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                            Product Category <RequiredMark />
                        </label>
                        {loadingCategories && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading categories...
                            </span>
                        )}
                    </div>
                    <select
                        required
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className={`${EDITABLE_FIELD_CLASS} w-full text-sm`}
                        disabled={submitting || loadingCategories}
                    >
                        <option value="">-- Select Product Category --</option>
                        {filteredCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                    {categories.length === 0 && !loadingCategories && (
                        <p className="text-[11px] text-amber-400/90 mt-1">
                            No categories found in Inventory. Please ensure categories are configured in Inventory Settings.
                        </p>
                    )}
                </div>

                {/* Quantity & Target Unit Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Quantity <RequiredMark />
                        </label>
                        <input
                            type="number"
                            min={1}
                            required
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className={`${EDITABLE_FIELD_CLASS} w-full text-sm`}
                            disabled={submitting}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Est. Target Unit Price
                        </label>
                        <input
                            type="number"
                            step="any"
                            min={0}
                            value={unitPrice}
                            onChange={e => setUnitPrice(e.target.value)}
                            placeholder="0.00"
                            className={`${EDITABLE_FIELD_CLASS} w-full text-sm`}
                            disabled={submitting}
                        />
                    </div>
                </div>

                {/* Specifications / Notes */}
                <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Build Specifications & Requirements
                    </label>
                    <textarea
                        rows={3}
                        value={specifications}
                        onChange={e => setSpecifications(e.target.value)}
                        placeholder="Add dimensions, materials, finishes, or custom customer requirements..."
                        className={`${EDITABLE_FIELD_CLASS} w-full text-sm resize-none`}
                        disabled={submitting}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !name.trim() || !categoryId}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-blue-600/20"
                    >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Submit Build Request</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};
