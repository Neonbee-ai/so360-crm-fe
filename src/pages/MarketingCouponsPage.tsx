import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Search, Tag, X, Loader2, Calendar, DollarSign, Percent, Clock } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { ToastContainer, useToast } from '../components/common/Toast';
import { useBusinessSettings } from '@so360/shell-context';
import { formatMoney } from './marketing/marketingMappers';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingCouponsPage: React.FC = () => {
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency || 'INR';
  const locale = settings?.document_language || 'en-IN';

  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, showSuccess, showError, dismissToast } = useToast();

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
      showError(e.message || 'Failed to load coupons');
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
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!storeId || !form.code) {
      showError('Coupon code is required');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await crmService.updateCoupon(storeId, editingId, form);
        showSuccess(`Coupon "${form.code}" updated`);
      } else {
        await crmService.createCoupon(storeId, form);
        showSuccess(`Coupon "${form.code}" created`);
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (e: any) {
      showError(e.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coupon: any) => {
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await crmService.deleteCoupon(storeId, coupon.id);
      showSuccess(`Coupon "${coupon.code}" deleted`);
      load();
    } catch (e: any) {
      showError(e.message || 'Failed to delete coupon');
    }
  };

  const filtered = search
    ? coupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()))
    : coupons;

  return (
    <div className="p-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Discount Coupons</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Manage promotional codes and offers</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
        >
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Context & Search</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-64">
                  <MarketingStorePicker storeId={storeId} onChange={applyStore} />
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                    placeholder="Search by coupon code..."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {showForm && (
          <section className="bg-slate-900 border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-blue-500/5">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{editingId ? 'Edit Coupon' : 'New Discount Code'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Coupon Code *</label>
                  <input 
                    type="text" 
                    value={form.code} 
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                    placeholder="WELCOME20" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Type</label>
                  <select 
                    value={form.discount_type} 
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold appearance-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Value</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {form.discount_type === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                    </div>
                    <input 
                      type="number" 
                      value={form.discount_value} 
                      onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Min Order</label>
                  <input 
                    type="number" 
                    value={form.min_order_amount} 
                    onChange={(e) => setForm({ ...form, min_order_amount: parseFloat(e.target.value) || 0 })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Usage Limit</label>
                  <input 
                    type="number" 
                    value={form.usage_limit} 
                    onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                    placeholder="0 = Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Valid From</label>
                  <input 
                    type="date" 
                    value={form.valid_from} 
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Valid Until</label>
                  <input 
                    type="date" 
                    value={form.valid_until} 
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold" 
                  />
                </div>
                <div className="lg:col-span-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">Description</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold h-20 resize-none" 
                    placeholder="Describe the offer..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-800">
                <button 
                  onClick={() => setShowForm(false)} 
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active & Scheduled Coupons ({filtered.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Code & Info</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Discount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Usage</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Validity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Loading coupons...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <Tag size={48} className="text-slate-500" />
                        <p className="text-sm font-bold uppercase tracking-widest">No coupons found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((coupon) => (
                    <tr key={coupon.id} className="group hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${coupon.is_active ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                            <Tag size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-white tracking-tight uppercase">{coupon.code}</p>
                            <p className="text-[10px] text-slate-500 font-bold truncate max-w-xs">{coupon.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-sm font-black text-emerald-400">
                          {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatMoney(coupon.discount_value, currencyCode, locale)}
                        </span>
                        {coupon.min_order_amount > 0 && (
                          <p className="text-[8px] text-slate-600 font-black uppercase mt-1">Min: {formatMoney(coupon.min_order_amount, currencyCode, locale)}</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-slate-300">{coupon.usage_count || 0} / {coupon.usage_limit || '∞'}</span>
                          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: coupon.usage_limit ? `${(coupon.usage_count / coupon.usage_limit) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1 text-[10px] font-bold">
                          <div className="flex items-center gap-1 text-slate-400">
                            <Calendar size={10} />
                            {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString() : 'Start'}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock size={10} />
                            {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : 'Never Expires'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(coupon)}
                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(coupon)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingCouponsPage;
