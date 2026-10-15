import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, MoreVertical, Search, Tag, X, Loader2, Calendar, DollarSign, Percent, Clock } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, useConfirm, ListPageTemplate, Button, Card, EmptyState, Menu } from '@so360/design-system';
import { useBusinessSettings, useActivity, useShellBridge } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { formatMoney } from './marketing/marketingMappers';
import { validateCouponForm, CouponFormErrors } from '../utils/couponValidation';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingCouponsPage: React.FC = () => {
  const [confirm, confirmDialog] = useConfirm();
  const formatters = useCRMFormatters();
  const { settings } = useBusinessSettings();
  const { recordActivity } = useActivity();
  const shell = useShellBridge();
  const canCreateMarketing = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:marketing:create') ?? true);
  const currencyCode = settings?.base_currency || 'INR';
  const locale = settings?.document_language || 'en-IN';

  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CouponFormErrors>({});

  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_amount: 0,
    usage_limit: 0,
    valid_from: '',
    valid_until: '',
    is_active: true
  });

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await crmService.getCoupons(storeId);
      setCoupons(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const resetForm = () => {
    setForm({ 
      code: '', 
      description: '', 
      discount_type: 'percentage', 
      discount_value: 0, 
      min_order_amount: 0, 
      usage_limit: 0, 
      valid_from: '', 
      valid_until: '',
      is_active: true
    });
    setEditingId(null);
    setFieldErrors({});
  };

  const handleEdit = (coupon: any) => {
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || 0,
      usage_limit: coupon.usage_limit || 0,
      valid_from: coupon.valid_from ? coupon.valid_from.slice(0, 10) : '',
      valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 10) : '',
      is_active: coupon.is_active ?? true
    });
    setEditingId(coupon.id);
    setFieldErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!storeId) {
      toast.error('Select a store first');
      return;
    }
    const errors = validateCouponForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0] as string);
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await crmService.updateCoupon(storeId, editingId, form);
        toast.success(`Coupon "${form.code}" updated`);
      } else {
        const newCoupon = await crmService.createCoupon(storeId, form);
        toast.success(`Coupon "${form.code}" created`);
        recordActivity({ eventType: 'coupon.created', eventCategory: 'crm', description: `Created coupon "${form.code}"`, resourceType: 'coupon', resourceId: newCoupon?.id || form.code }).catch(() => {});
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coupon: any) => {
    if (!await confirm({ title: 'Delete?', message: `Delete coupon "${coupon.code}"?`, intent: 'danger', confirmLabel: 'Delete' })) return;
    try {
      await crmService.deleteCoupon(storeId, coupon.id);
      toast.success(`Coupon "${coupon.code}" deleted`);
      recordActivity({ eventType: 'coupon.deactivated', eventCategory: 'crm', description: `Deleted coupon "${coupon.code}"`, resourceType: 'coupon', resourceId: coupon.id }).catch(() => {});
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete coupon');
    }
  };

  const filtered = search
    ? coupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()))
    : coupons;

  return (
    <ListPageTemplate
      title="Discount Coupons"
      description="Manage promotional codes and offers"
      primaryAction={canCreateMarketing ? (
        <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} />
          Create Coupon
        </Button>
      ) : undefined}
      filters={
        <div className="relative w-full wc-medium:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-nb-control-md w-full rounded-nb border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-primary"
            placeholder="Search by coupon code..."
          />
        </div>
      }
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      {confirmDialog}

      <div className="flex flex-col gap-nb-3">
        {showForm && (
          <Card
            title={editingId ? 'Edit Coupon' : 'New Discount Code'}
            actions={
              <button onClick={() => setShowForm(false)} aria-label="Close form" className="text-fg-muted hover:text-fg transition-colors">
                <X size={20} />
              </button>
            }
          >
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Coupon Code *</label>
                  <input 
                    type="text" 
                    value={form.code} 
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} 
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold" 
                    placeholder="WELCOME20"
                  />
                  {fieldErrors.code && (
                    <p className="text-xs font-bold text-danger mt-1 ml-1">{fieldErrors.code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Type</label>
                  <select 
                    value={form.discount_type} 
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })} 
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold appearance-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Value</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                      {form.discount_type === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                    </div>
                    <input
                      type="number"
                      data-testid="coupon-discount-value"
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-bg border border-line rounded-xl py-3 pl-8 pr-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                    />
                  </div>
                  {fieldErrors.discount_value && (
                    <p className="text-xs font-bold text-danger mt-1 ml-1">{fieldErrors.discount_value}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Min Order</label>
                  <input
                    type="number"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                  />
                  {fieldErrors.min_order_amount && (
                    <p className="text-xs font-bold text-danger mt-1 ml-1">{fieldErrors.min_order_amount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Usage Limit</label>
                  <input
                    type="number"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                    placeholder="0 = Unlimited"
                  />
                  {fieldErrors.usage_limit && (
                    <p className="text-xs font-bold text-danger mt-1 ml-1">{fieldErrors.usage_limit}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Valid From</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Valid Until</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                  />
                  {fieldErrors.valid_until && (
                    <p className="text-xs font-bold text-danger mt-1 ml-1">{fieldErrors.valid_until}</p>
                  )}
                </div>
                <div className="lg:col-span-4">
                  <label className="block text-xs font-semibold text-fg-muted mb-2 ml-1">Description</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    className="w-full bg-bg border border-line rounded-xl py-3 px-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold h-20 resize-none" 
                    placeholder="Describe the offer..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-nb-2 mt-6 pt-4 border-t border-line">
                <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update Coupon' : 'Create Coupon'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card title={`Active & Scheduled Coupons (${filtered.length})`} padding="none">
          <div className="w-full overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-line">
                  <th className="px-6 py-4 text-xs font-semibold text-fg-muted">Code & Info</th>
                  <th className="px-6 py-4 text-xs font-semibold text-fg-muted text-center">Discount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-fg-muted text-center">Usage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-fg-muted text-center">Validity</th>
                  <th className="px-6 py-4 text-xs font-semibold text-fg-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-fg-muted">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-xs font-semibold">Loading coupons...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={Tag} title="No coupons found" />
                    </td>
                  </tr>
                ) : (
                  filtered.map((coupon) => (
                    <tr key={coupon.id} className="group hover:bg-surface-high transition-all">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${coupon.is_active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-raised border-line text-fg-muted'}`}>
                            <Tag size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-fg ">{coupon.code}</p>
                            <p className="text-xs text-fg-muted font-bold truncate max-w-xs">{coupon.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-sm font-semibold text-success">
                          {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatMoney(coupon.discount_value, currencyCode, locale)}
                        </span>
                        {coupon.min_order_amount > 0 && (
                          <p className="text-xs text-fg-muted font-semibold mt-1">Min: {formatMoney(coupon.min_order_amount, currencyCode, locale)}</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-fg-subtle">{coupon.usage_count || 0} / {coupon.usage_limit || '∞'}</span>
                          <div className="w-16 h-1 bg-surface-raised rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: coupon.usage_limit ? `${(coupon.usage_count / coupon.usage_limit) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1 text-xs font-bold">
                          <div className="flex items-center gap-1 text-fg-subtle">
                            <Calendar size={10} />
                            {coupon.valid_from ? formatters.formatDate(coupon.valid_from) : 'Start'}
                          </div>
                          <div className="flex items-center gap-1 text-fg-muted">
                            <Clock size={10} />
                            {coupon.valid_until ? formatters.formatDate(coupon.valid_until) : 'Never Expires'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {canCreateMarketing && (
                          <Menu
                            name={`coupon-${coupon.id}`}
                            trigger={
                              <button
                                type="button"
                                aria-label={`Actions for ${coupon.code}`}
                                className="p-2 text-fg-muted hover:text-fg hover:bg-surface-raised rounded-nb transition-colors"
                              >
                                <MoreVertical size={16} />
                              </button>
                            }
                            items={[
                              { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => handleEdit(coupon) },
                              { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => handleDelete(coupon) },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingCouponsPage;
