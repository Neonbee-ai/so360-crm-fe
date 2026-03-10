import React, { useEffect, useState } from 'react';
import { Plus, Trash2, MailX, Search, Mail, Loader2 } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { ToastContainer, useToast } from '../components/common/Toast';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingNewsletterPage: React.FC = () => {
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const { toasts, showSuccess, showError, dismissToast } = useToast();

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await crmService.getNewsletterSubscribers(storeId);
      setSubscribers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showError(e.message || 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const handleAdd = async () => {
    if (!email || !storeId) return;
    try {
      await crmService.addNewsletterSubscriber(storeId, { email });
      showSuccess('Subscriber added successfully');
      setEmail('');
      load();
    } catch (e: any) {
      showError(e.message || 'Failed to add subscriber');
    }
  };

  const handleUnsubscribe = async (id: string) => {
    try {
      await crmService.unsubscribeNewsletter(storeId, id);
      showSuccess('Subscriber unsubscribed');
      load();
    } catch (e: any) {
      showError(e.message || 'Failed to unsubscribe');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) return;
    try {
      await crmService.deleteNewsletterSubscriber(storeId, id);
      showSuccess('Subscriber deleted');
      load();
    } catch (e: any) {
      showError(e.message || 'Failed to delete');
    }
  };

  const filtered = search
    ? subscribers.filter(s => s.email.toLowerCase().includes(search.toLowerCase()))
    : subscribers;

  return (
    <div className="p-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">Newsletter Subscribers</h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Manage storefront newsletter audience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Context</h3>
            <MarketingStorePicker storeId={storeId} onChange={applyStore} />
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Add Subscriber</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
              <button
                onClick={handleAdd}
                disabled={!email || !storeId}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add Subscriber
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subscriber List ({filtered.length})</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="Search email..."
                />
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                  <Loader2 className="animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Fetching audience...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                  <Mail className="mx-auto mb-4 text-slate-700 w-12 h-12 opacity-20" />
                  <p className="text-sm font-bold uppercase text-slate-500 tracking-widest">No subscribers found</p>
                  <p className="text-[10px] text-slate-600 uppercase mt-1 italic font-bold">Try selecting a different store or adjust search</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filtered.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${s.unsubscribed_at ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                          <Mail size={18} />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${s.unsubscribed_at ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{s.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${s.unsubscribed_at ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                              {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
                            </span>
                            <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">• {s.source || 'Manual'}</span>
                            <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">• Subscribed {new Date(s.subscribed_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!s.unsubscribed_at && (
                          <button
                            onClick={() => handleUnsubscribe(s.id)}
                            className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                            title="Unsubscribe"
                          >
                            <MailX size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MarketingNewsletterPage;
