import React, { useEffect, useState } from 'react';
import { Plus, Trash2, MailX, Search, Mail, Loader2, MoreVertical } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, useConfirm, ListPageTemplate, Card, Button, Badge, EmptyState, Menu } from '@so360/design-system';
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
        <div className="lg:col-span-4">
          <Card title="Add Subscriber">
            <div className="space-y-nb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg border border-line rounded-nb py-2 pl-10 pr-4 text-sm text-fg focus:border-primary outline-none transition-all"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
              {canCreateMarketing && (
                <Button variant="primary" onClick={handleAdd} disabled={!email || !storeId} className="w-full">
                  <Plus size={14} /> Add Subscriber
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card
            title={`Subscriber List (${filtered.length})`}
            padding="none"
            actions={
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-bg border border-line rounded-nb py-2 pl-10 pr-4 text-xs text-fg focus:border-primary outline-none transition-all"
                  placeholder="Search email..."
                />
              </div>
            }
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-nb-6 text-fg-muted gap-3">
                <Loader2 className="animate-spin" />
                <span className="text-xs font-semibold">Fetching audience...</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No subscribers found"
                description="Try selecting a different store or adjust search"
              />
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-nb-3 px-nb-4 py-nb-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${s.unsubscribed_at ? 'text-fg-muted line-through' : 'text-fg'}`}>{s.email}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <Badge tone={s.unsubscribed_at ? 'danger' : 'success'} size="sm">
                          {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
                        </Badge>
                        <span className="text-xs text-fg-muted">• {s.source || 'Manual'}</span>
                        <span className="text-xs text-fg-muted">• Subscribed {formatters.formatDate(s.subscribed_at)}</span>
                      </div>
                    </div>
                    {(!s.unsubscribed_at || canCreateMarketing) && (
                      <Menu
                        name={`subscriber-${s.id}`}
                        trigger={
                          <button
                            type="button"
                            aria-label={`Actions for ${s.email}`}
                            className="p-2 text-fg-muted hover:text-fg hover:bg-surface-raised rounded-nb transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>
                        }
                        items={[
                          ...(!s.unsubscribed_at
                            ? [{ label: 'Unsubscribe', icon: <MailX size={14} />, onSelect: () => handleUnsubscribe(s.id) }]
                            : []),
                          ...(canCreateMarketing
                            ? [{ label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => handleDelete(s.id) }]
                            : []),
                        ]}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingNewsletterPage;
