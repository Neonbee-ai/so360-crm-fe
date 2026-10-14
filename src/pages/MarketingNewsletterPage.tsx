import React, { useEffect, useState } from 'react';
import { Plus, Trash2, MailX, Search, Mail, Loader2 } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, useConfirm, ListPageTemplate } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingNewsletterPage: React.FC = () => {
  const [confirm, confirmDialog] = useConfirm();
  const formatters = useCRMFormatters();
  const shell = useShellBridge();
  const canCreateMarketing = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:marketing:create') ?? true);
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');

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
      toast.error(e.message || 'Failed to load subscribers');
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
      toast.success('Subscriber added successfully');
      setEmail('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add subscriber');
    }
  };

  const handleUnsubscribe = async (id: string) => {
    try {
      await crmService.unsubscribeNewsletter(storeId, id);
      toast.success('Subscriber unsubscribed');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to unsubscribe');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Please confirm', message: 'Are you sure you want to delete this subscriber?', intent: 'danger', confirmLabel: 'Continue' })) return;
    try {
      await crmService.deleteNewsletterSubscriber(storeId, id);
      toast.success('Subscriber deleted');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  const filtered = search
    ? subscribers.filter(s => s.email.toLowerCase().includes(search.toLowerCase()))
    : subscribers;

  return (
    <ListPageTemplate
      title="Newsletter Subscribers"
      description="Manage storefront newsletter audience"
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      {confirmDialog}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-surface border border-line rounded-2xl p-6">
            <h3 className="text-xs font-semibold text-fg-muted mb-4">Add Subscriber</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg border border-line rounded-xl py-3 pl-10 pr-4 text-sm text-fg focus:border-primary outline-none transition-all font-bold"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
              {canCreateMarketing && <button
                onClick={handleAdd}
                disabled={!email || !storeId}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary/90 text-primary-fg font-semibold text-xs py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add Subscriber
              </button>}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-line flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-sunken">
              <h3 className="text-xs font-semibold text-fg-muted">Subscriber List ({filtered.length})</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-bg border border-line rounded-xl py-2 pl-10 pr-4 text-xs text-fg focus:border-primary outline-none transition-all font-bold"
                  placeholder="Search email..."
                />
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-fg-muted gap-3">
                  <Loader2 className="animate-spin" />
                  <span className="text-xs font-semibold">Fetching audience...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-line rounded-2xl bg-surface-sunken">
                  <Mail className="mx-auto mb-4 text-fg w-12 h-12 opacity-20" />
                  <p className="text-sm font-bold text-fg-muted">No subscribers found</p>
                  <p className="text-xs text-fg-muted mt-1 italic font-bold">Try selecting a different store or adjust search</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filtered.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-bg border border-line rounded-xl group hover:border-line transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${s.unsubscribed_at ? 'bg-surface border-line text-fg-muted' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                          <Mail size={18} />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${s.unsubscribed_at ? 'text-fg-muted line-through' : 'text-fg'}`}>{s.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${s.unsubscribed_at ? 'bg-danger/10 text-danger border-danger/20' : 'bg-success/10 text-success border-success/20'}`}>
                              {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
                            </span>
                            <span className="text-xs text-fg-muted font-bold">• {s.source || 'Manual'}</span>
                            <span className="text-xs text-fg-muted font-bold">• Subscribed {formatters.formatDate(s.subscribed_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!s.unsubscribed_at && (
                          <button
                            onClick={() => handleUnsubscribe(s.id)}
                            className="p-2 text-fg-muted hover:text-warning hover:bg-warning/10 rounded-lg transition-all"
                            title="Unsubscribe"
                          >
                            <MailX size={16} />
                          </button>
                        )}
                        {canCreateMarketing && <button
                          onClick={() => handleDelete(s.id)}
                          className="p-2 text-fg-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingNewsletterPage;
