import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Tag, X, Loader2, Calendar, Clock } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, useConfirm, ListPageTemplate, Button, Card, EmptyState, DataTable, DatePicker, IconButton, NumberInput, SearchInput, Select, TextField, Textarea, Grid, GridItem } from '@so360/design-system';
import type { DataTableColumn, FilterValues, MenuItem } from '@so360/design-system';
import { useBusinessSettings, useActivity, useShellBridge } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { formatMoney } from './marketing/marketingMappers';
import { validateCouponForm, CouponFormErrors } from '../utils/couponValidation';

const STORE_KEY = 'crm_marketing_store_id';

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

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
  const [filters, setFilters] = useState<FilterValues>({});
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

  const filtered = coupons.filter((c) => {
    if (filters.status && (c.is_active === false ? 'inactive' : 'active') !== filters.status) return false;
    if (filters.discount_type && c.discount_type !== filters.discount_type) return false;
    return !search || String(c.code ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const columns: DataTableColumn<any>[] = [
    {
      key: 'code',
      header: 'Code & Info',
      sortable: true,
      render: (coupon) => (
        <div className="flex items-center gap-nb-3">
          <div className={`flex h-nb-control-md w-nb-control-md items-center justify-center rounded-nb border ${coupon.is_active ? 'border-primary bg-surface-raised text-primary' : 'border-line bg-surface-raised text-fg-muted'}`}>
            <Tag size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-fg">{coupon.code}</p>
            <p className="max-w-xs truncate text-xs text-fg-muted">{coupon.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'discount_value',
      header: 'Discount',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.discount_value ?? 0,
      render: (coupon) => (
        <div>
          <span className="text-sm font-medium text-success">
            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatMoney(coupon.discount_value, currencyCode, locale)}
          </span>
          {coupon.min_order_amount > 0 && (
            <p className="mt-nb-1 text-xs text-fg-muted">Min: {formatMoney(coupon.min_order_amount, currencyCode, locale)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'usage_count',
      header: 'Usage',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.usage_count ?? 0,
      render: (coupon) => (
        <div className="flex flex-col items-end gap-nb-1">
          <span className="text-xs text-fg-muted">{coupon.usage_count || 0} / {coupon.usage_limit || '∞'}</span>
          <div className="h-1 w-16 overflow-hidden rounded-nb bg-surface-raised">
            <div
              className="h-full bg-primary"
              style={{ width: coupon.usage_limit ? `${(coupon.usage_count / coupon.usage_limit) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'valid_until',
      header: 'Validity',
      render: (coupon) => (
        <div className="flex flex-col gap-nb-1 text-xs">
          <div className="flex items-center gap-nb-1 text-fg-muted">
            <Calendar size={10} />
            {coupon.valid_from ? formatters.formatDate(coupon.valid_from) : 'Start'}
          </div>
          <div className="flex items-center gap-nb-1 text-fg-muted">
            <Clock size={10} />
            {coupon.valid_until ? formatters.formatDate(coupon.valid_until) : 'Never Expires'}
          </div>
        </div>
      ),
    },
  ];

  const rowActions = (coupon: any): MenuItem[] =>
    canCreateMarketing
      ? [
          { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => handleEdit(coupon) },
          { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => handleDelete(coupon) },
        ]
      : [];

  return (
    <ListPageTemplate
      title="Discount Coupons"
      description="Manage promotional codes and offers"
      count={filtered.length}
      primaryAction={canCreateMarketing ? (
        <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} />
          Create Coupon
        </Button>
      ) : undefined}
      search={<SearchInput placeholder="Search by coupon code..." value={search} onChange={setSearch} data-testid="coupons-search" />}
      filterConfig={{
        fields: [
          { key: 'status', label: 'Status', type: 'select', quick: true, options: STATUS_OPTIONS },
          { key: 'discount_type', label: 'Discount type', type: 'select', options: DISCOUNT_TYPE_OPTIONS },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({}),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      {confirmDialog}

      <div className="flex flex-col gap-nb-3">
        {showForm && (
          <Card
            title={editingId ? 'Edit Coupon' : 'New Discount Code'}
            actions={
              <IconButton label="Close form" icon={<X size={20} />} variant="ghost" onClick={() => setShowForm(false)} />
            }
          >
              <Grid gap="lg">
                <GridItem span="full"><div>
                  <TextField
                    name="coupon_code"
                    label="Coupon Code *"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="WELCOME20"
                    error={fieldErrors.code}
                  />
                </div></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><Select
                  name="coupon_type"
                  label="Type"
                  options={DISCOUNT_TYPE_OPTIONS}
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><NumberInput
                  name="coupon_discount_value"
                  label="Value"
                  data-testid="coupon-discount-value"
                  value={form.discount_value}
                  onChange={(v) => setForm({ ...form, discount_value: v ?? 0 })}
                  error={fieldErrors.discount_value}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><NumberInput
                  name="coupon_min_order"
                  label="Min Order"
                  value={form.min_order_amount}
                  onChange={(v) => setForm({ ...form, min_order_amount: v ?? 0 })}
                  error={fieldErrors.min_order_amount}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><NumberInput
                  name="coupon_usage_limit"
                  label="Usage Limit"
                  value={form.usage_limit}
                  onChange={(v) => setForm({ ...form, usage_limit: Math.trunc(v ?? 0) })}
                  placeholder="0 = Unlimited"
                  error={fieldErrors.usage_limit}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><DatePicker
                  name="coupon_valid_from"
                  label="Valid From"
                  value={form.valid_from}
                  onChange={(iso: string) => setForm({ ...form, valid_from: iso })}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 3 }}><DatePicker
                  name="coupon_valid_until"
                  label="Valid Until"
                  value={form.valid_until}
                  onChange={(iso: string) => setForm({ ...form, valid_until: iso })}
                  error={fieldErrors.valid_until}
                /></GridItem>
                <GridItem span="full"><div>
                  <Textarea
                    name="coupon_description"
                    label="Description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the offer..."
                    rows={3}
                  />
                </div></GridItem>
              </Grid>
              <div className="flex justify-end gap-nb-2 mt-nb-6 pt-nb-4 border-t border-line">
                <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update Coupon' : 'Create Coupon'}
                </Button>
              </div>
          </Card>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(c: any) => c.id}
          loading={loading}
          rowActions={canCreateMarketing ? rowActions : undefined}
          getRowProps={(c: any) => ({ 'data-testid': `coupon-row-${c.id}` })}
          emptyState={<EmptyState icon={Tag} title="No coupons found" />}
        />
      </div>
    </ListPageTemplate>
  );
};

export default MarketingCouponsPage;
