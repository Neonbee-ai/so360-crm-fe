import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, MailX, Mail } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, useConfirm, ListPageTemplate, Card, Button, Badge, DataTable, EmptyState, SearchInput, TextField } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
];

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
  const [filters, setFilters] = useState<FilterValues>({ status: '', source: '' });

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

  const sourceOptions = useMemo(
    () => Array.from(new Set(subscribers.map((s) => s.source || 'Manual'))).map((v) => ({ value: v, label: v })),
    [subscribers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (q && !(s.email || '').toLowerCase().includes(q)) return false;
      if (filters.status === 'active' && s.unsubscribed_at) return false;
      if (filters.status === 'unsubscribed' && !s.unsubscribed_at) return false;
      if (filters.source && (s.source || 'Manual') !== filters.source) return false;
      return true;
    });
  }, [subscribers, search, filters]);

  const columns: DataTableColumn<any>[] = [
    {
      key: 'email', header: 'Email', sortable: true, sortValue: (s) => s.email || '',
      render: (s) => <span className={`text-sm font-medium ${s.unsubscribed_at ? 'text-fg-muted line-through' : 'text-fg'}`}>{s.email}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (s) => (
        <Badge tone={s.unsubscribed_at ? 'danger' : 'success'} size="sm">
          {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
        </Badge>
      ),
    },
    { key: 'source', header: 'Source', render: (s) => <span className="text-fg-muted">{s.source || 'Manual'}</span> },
    {
      key: 'subscribed_at', header: 'Subscribed', sortable: true, sortValue: (s) => s.subscribed_at || '',
      render: (s) => <span className="text-fg-muted text-xs">{formatters.formatDate(s.subscribed_at)}</span>,
    },
  ];

  const rowActions = (s: any) => [
    ...(!s.unsubscribed_at ? [{ label: 'Unsubscribe', icon: <MailX size={14} />, onSelect: () => handleUnsubscribe(s.id) }] : []),
    ...(canCreateMarketing ? [{ label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => handleDelete(s.id) }] : []),
  ];

  return (
    <ListPageTemplate
      title="Newsletter Subscribers"
      description="Manage storefront newsletter audience"
      count={filtered.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search email..." />}
      filterConfig={{
        fields: [
          { key: 'status', label: 'Status', type: 'select', quick: true, options: STATUS_OPTIONS },
          { key: 'source', label: 'Source', type: 'select', options: sourceOptions },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ status: '', source: '' }),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      {confirmDialog}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
        <div className="lg:col-span-4">
          <Card title="Add Subscriber">
            <div className="space-y-nb-3">
              <TextField
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
              {canCreateMarketing && (
                <Button variant="primary" onClick={handleAdd} disabled={!email || !storeId} className="w-full">
                  <Plus size={14} /> Add Subscriber
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(s: any) => s.id}
            loading={loading}
            rowActions={rowActions}
            getRowProps={(s: any) => ({ 'data-testid': `subscriber-row-${s.id}` })}
            emptyState={
              <EmptyState
                icon={Mail}
                title="No subscribers found"
                description="Try selecting a different store or adjust search"
              />
            }
          />
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingNewsletterPage;
