import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, formatMoney } from './marketing/marketingMappers';
import { useBusinessSettings, useShell } from '@so360/shell-context';
import { Button } from '@so360/design-system';

const STORE_KEY = 'crm_marketing_store_id';

type SegmentMemberType = 'lead' | 'customer';

const MarketingSegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const shell = useShell();
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const dailystoreEnabled = shell.isModuleEnabled('dailystore');

  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<any>(null);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [inactive, setInactive] = useState<any[]>([]);
  const [manualSegments, setManualSegments] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [activeSegment, setActiveSegment] = useState<any | null>(null);
  const [memberType, setMemberType] = useState<SegmentMemberType>('customer');
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [segmentMembers, setSegmentMembers] = useState<any[]>([]);
  const [memberCandidates, setMemberCandidates] = useState<any[]>([]);

  const [segmentForm, setSegmentForm] = useState({
    name: '',
    description: '',
    q: '',
    channel: '',
    category: '',
    preset: '',
  });

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const loadManualSegments = async () => {
    setManualLoading(true);
    try {
      const manual = await crmService.getCustomerSegments();
      setManualSegments(Array.isArray(manual) ? manual : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load manual segments');
    } finally {
      setManualLoading(false);
    }
  };

  const loadStorefrontSections = async () => {
    if (!dailystoreEnabled || !storeId) {
      setSegments(null);
      setTopBuyers([]);
      setInactive([]);
      return;
    }

    setLoading(true);
    try {
      const [seg, buyers, inactiveRes] = await Promise.all([
        crmService.getMarketingSegments(storeId),
        crmService.getMarketingTopBuyers(storeId, { limit: 20 }),
        crmService.getMarketingInactiveCustomers(storeId, { limit: 20 }),
      ]);
      setSegments(seg);
      setTopBuyers(Array.isArray(buyers?.data) ? buyers.data : []);
      setInactive(Array.isArray(inactiveRes?.data) ? inactiveRes.data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load storefront segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
    loadManualSegments();
  }, []);

  useEffect(() => {
    setError(null);
    loadStorefrontSections();
  }, [dailystoreEnabled, storeId]);

  const segmentEntries = Object.entries(segments?.segments || {});
  const mappedSummarySegments = useMemo(() => {
    const mapRule = (key: string) => {
      if (key === 'b2b') return { category: 'b2b' };
      if (key === 'b2c') return { category: 'b2c' };
      if (['storefront_web', 'storefront_mobile', 'pos', 'manual'].includes(key)) return { channel: key };
      return null;
    };

    return segmentEntries.map(([key, value]) => ({
      key,
      value,
      rule: mapRule(key),
      label: key.replaceAll('_', ' '),
    }));
  }, [segmentEntries]);

  const navigateToCustomers = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    navigate(`/crm/customers${search.toString() ? `?${search.toString()}` : ''}`);
  };

  const navigateToLeads = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    navigate(`/crm/leads${search.toString() ? `?${search.toString()}` : ''}`);
  };

  const getRulesPreview = (rules: any) => {
    if (!rules || typeof rules !== 'object') return '-';
    const chunks: string[] = [];
    if (rules.q) chunks.push(`q: ${rules.q}`);
    if (rules.channel) chunks.push(`channel: ${rules.channel}`);
    if (rules.category) chunks.push(`category: ${rules.category}`);
    if (rules.preset) chunks.push(`preset: ${rules.preset}`);
    if (Array.isArray(rules.customer_ids) && rules.customer_ids.length > 0) {
      chunks.push(`ids: ${rules.customer_ids.length}`);
    }
    return chunks.length > 0 ? chunks.join(' | ') : '-';
  };

  const createManualSegment = async () => {
    if (!segmentForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const rules: any = {};
      if (segmentForm.q.trim()) rules.q = segmentForm.q.trim();
      if (segmentForm.channel) rules.channel = segmentForm.channel;
      if (segmentForm.category) rules.category = segmentForm.category;
      if (segmentForm.preset) {
        rules.preset = segmentForm.preset;
        if (storeId) rules.store_id = storeId;
      }

      await crmService.createCustomerSegment({
        name: segmentForm.name.trim(),
        description: segmentForm.description.trim() || undefined,
        rules,
      });

      setSegmentForm({
        name: '',
        description: '',
        q: '',
        channel: '',
        category: '',
        preset: '',
      });
      setShowCreate(false);
      await loadManualSegments();
    } catch (e: any) {
      setError(e?.message || 'Failed to create segment');
    } finally {
      setCreating(false);
    }
  };

  const loadMemberPanel = async (segment: any, type: SegmentMemberType, q: string) => {
    setMembersLoading(true);
    setError(null);
    try {
      const [membersRes, candidatesRes] = await Promise.all([
        crmService.getCustomerSegmentMembers(segment.id, { type }),
        type === 'customer'
          ? crmService.getCustomers({ q: q || undefined, take: 50 })
          : crmService.getLeads({ q: q || undefined, take: 50 }),
      ]);

      setSegmentMembers(Array.isArray(membersRes?.members) ? membersRes.members : []);
      setMemberCandidates(Array.isArray(candidatesRes) ? candidatesRes : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load segment members');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSegment) return;
    const timer = setTimeout(() => {
      loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [activeSegment?.id, memberType, memberSearch]);

  const existingMemberIds = useMemo(
    () => new Set(segmentMembers.map((m: any) => m?.lead_record?.id || m.id).filter(Boolean)),
    [segmentMembers],
  );

  const addMember = async (id: string) => {
    if (!activeSegment) return;
    try {
      await crmService.addCustomerSegmentMembers(activeSegment.id, [{ id, type: memberType }]);
      await loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    } catch (e: any) {
      setError(e?.message || 'Failed to add member');
    }
  };

  const removeMember = async (id: string) => {
    if (!activeSegment) return;
    try {
      await crmService.removeCustomerSegmentMembers(activeSegment.id, [{ id, type: memberType }]);
      await loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    } catch (e: any) {
      setError(e?.message || 'Failed to remove member');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Customer Segments</h1>
        <p className="text-slate-400">Create CRM segments for leads/customers. Storefront segments are read-only.</p>
      </div>

      <div className="mb-6">
        {dailystoreEnabled && <MarketingStorePicker storeId={storeId} onChange={applyStore} />}
      </div>
      {loading && <p className="text-slate-400 text-sm mb-4">Loading Storefront insights...</p>}
      {manualLoading && <p className="text-slate-400 text-sm mb-4">Loading CRM segments...</p>}
      {error && <p className="text-rose-400 mb-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-sm">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-100 font-bold text-lg">Segments</h3>
            <Button
              variant="primary"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Close Form' : 'Create Segment'}
            </Button>
          </div>

          {showCreate && (
            <div className="mb-6 border border-slate-700/50 rounded-xl p-5 bg-slate-900/80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Segment name"
                  value={segmentForm.name}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description (optional)"
                  value={segmentForm.description}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, description: e.target.value }))}
                />
                <input
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
                  placeholder="Search query (name/email/phone/company)"
                  value={segmentForm.q}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, q: e.target.value }))}
                />
                <select
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer w-full"
                  value={segmentForm.channel}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, channel: e.target.value }))}
                >
                  <option value="">All Channels</option>
                  <option value="storefront_web">Web</option>
                  <option value="storefront_mobile">Mobile</option>
                  <option value="pos">POS</option>
                  <option value="manual">Manual</option>
                </select>
                <select
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer w-full"
                  value={segmentForm.category}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">All Categories</option>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                </select>
                <select
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer w-full md:col-span-2"
                  value={segmentForm.preset}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, preset: e.target.value }))}
                  disabled={!dailystoreEnabled}
                >
                  <option value="">No Preset</option>
                  <option value="top_buyer">Top Buyer</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  variant="primary"
                  onClick={createManualSegment}
                  disabled={creating || !segmentForm.name.trim()}
                >
                  {creating ? 'Creating...' : 'Save Segment'}
                </Button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Rules</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 border-t border-slate-800/50">
                  {manualSegments.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-slate-400">{row.description || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400 text-xs font-mono bg-slate-900 border border-slate-800 rounded px-2.5 py-1 whitespace-nowrap">
                          {getRulesPreview(row.rules)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveSegment(row)}
                          >
                            Manage Members
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigateToLeads({ segmentId: row.id, segmentName: row.name })}
                          >
                            Leads
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigateToCustomers({ segmentId: row.id, segmentName: row.name })}
                          >
                            Customers
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={async () => {
                              await crmService.deleteCustomerSegment(row.id);
                              setManualSegments((prev) => prev.filter((seg) => seg.id !== row.id));
                              if (activeSegment?.id === row.id) {
                                setActiveSegment(null);
                                setSegmentMembers([]);
                                setMemberCandidates([]);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {manualSegments.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No segments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {activeSegment && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 lg:col-span-3">
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap pb-4 border-b border-slate-800/50">
              <h3 className="text-slate-100 font-bold text-lg">
                Manage Members: <span className="text-slate-300 font-normal">{activeSegment.name}</span>
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveSegment(null);
                  setSegmentMembers([]);
                  setMemberCandidates([]);
                }}
              >
                Close Panel
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-900 border border-slate-800 p-2 rounded-xl">
              <button
                className={`text-sm px-4 py-2.5 rounded-lg font-medium transition-all ${memberType === 'customer' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                onClick={() => setMemberType('customer')}
              >
                Customers
              </button>
              <button
                className={`text-sm px-4 py-2.5 rounded-lg font-medium transition-all ${memberType === 'lead' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                onClick={() => setMemberType('lead')}
              >
                Leads
              </button>
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={`Search ${memberType}s...`}
                className="ml-auto bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow w-full md:w-72"
              />
            </div>

            {membersLoading && <div className="flex items-center justify-center p-4"><div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div></div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl">
                <h4 className="text-slate-100 font-bold mb-4">Current Members</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {segmentMembers.map((member: any) => {
                    const row = member.lead_record;
                    return (
                      <div key={`${member.type}-${row?.id || member.id}`} className="flex items-center justify-between border-b border-slate-800/50 pb-2 mb-2">
                        <div className="overflow-hidden">
                          <p className="text-slate-200 text-sm font-medium truncate">{row?.contact_name || row?.company_name || row?.email || row?.id}</p>
                          <p className="text-slate-500 text-xs truncate mt-0.5">{row?.email || row?.phone || '-'}</p>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          className="shrink-0"
                          onClick={() => removeMember(row?.id || member.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                  {segmentMembers.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No current members found.</p>}
                </div>
              </div>

              <div className="bg-slate-900 p-5 border border-slate-800 rounded-xl">
                <h4 className="text-slate-100 font-bold mb-4">Add {memberType === 'customer' ? 'Customers' : 'Leads'}</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {memberCandidates.map((candidate: any) => {
                    const id = candidate.id;
                    const exists = existingMemberIds.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between border-b border-slate-800/50 pb-2 mb-2">
                        <div className="overflow-hidden">
                          <p className="text-slate-200 text-sm font-medium truncate">{candidate.contact_name || candidate.company_name || candidate.email || id}</p>
                          <p className="text-slate-500 text-xs truncate mt-0.5">{candidate.email || candidate.phone || '-'}</p>
                        </div>
                        <Button
                          variant={exists ? "secondary" : "primary"}
                          size="sm"
                          className="shrink-0"
                          onClick={() => !exists && addMember(id)}
                          disabled={exists}
                        >
                          {exists ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                  {memberCandidates.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No records available to add.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {dailystoreEnabled && (
          <>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-fit">
              <h3 className="text-slate-100 font-bold mb-4">Storefront Summary</h3>
              <div className="space-y-2">
                {mappedSummarySegments.map((entry) => (
                  <button
                    key={entry.key}
                    onClick={() => entry.rule && navigateToCustomers({
                      channel: (entry.rule as any).channel,
                      category: (entry.rule as any).category,
                    })}
                    disabled={!entry.rule}
                    className={`w-full flex justify-between items-center bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg p-3 text-left transition-colors ${entry.rule ? 'group' : 'opacity-60 cursor-not-allowed'}`}
                    title={entry.rule ? 'Open matching customers' : 'No filter mapping for this segment'}
                  >
                    <span className="text-slate-300 font-medium capitalize">{entry.label}</span>
                    <span className="text-slate-200 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{String(entry.value)}</span>
                  </button>
                ))}
                {mappedSummarySegments.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No segment data.</p>}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 lg:col-span-2">
              <h3 className="text-slate-100 font-bold mb-4">Top Buyers</h3>
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-400 font-medium">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Orders</th>
                        <th className="px-4 py-3 font-semibold">Spent</th>
                        <th className="px-4 py-3 font-semibold">Last Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 border-t border-slate-800/50">
                      {topBuyers.map((row) => (
                        <tr
                          key={row.customerId}
                          className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => navigateToCustomers({
                            customer_ids: row.customerId,
                            preset: 'top_buyer',
                            storeId,
                          })}
                          title="Open in Customers"
                        >
                          <td className="px-4 py-4 text-slate-200 font-medium">{row.name || row.email || row.customerId || '-'}</td>
                          <td className="px-4 py-4 text-slate-300">{row.orderCount || 0}</td>
                          <td className="px-4 py-4 text-emerald-400 font-semibold">{formatMoney(row.totalSpent, currencyCode, locale)}</td>
                          <td className="px-4 py-4 text-slate-500 text-xs font-medium">{formatDateTime(row.lastOrderAt)}</td>
                        </tr>
                      ))}
                      {topBuyers.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No buyer data.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 lg:col-span-3">
              <h3 className="text-slate-100 font-bold mb-4">Inactive Customers</h3>
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-400 font-medium">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Total Spent</th>
                        <th className="px-4 py-3 font-semibold">Days Inactive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 border-t border-slate-800/50">
                      {inactive.map((row) => (
                        <tr
                          key={row.customerId}
                          className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => navigateToCustomers({
                            customer_ids: row.customerId,
                            preset: 'inactive',
                            storeId,
                          })}
                          title="Open in Customers"
                        >
                          <td className="px-4 py-4 text-slate-200 font-medium">{row.name || row.customerId || '-'}</td>
                          <td className="px-4 py-4 text-slate-300">{row.email || '-'}</td>
                          <td className="px-4 py-4 text-slate-300 font-medium">{formatMoney(row.totalSpent, currencyCode, locale)}</td>
                          <td className="px-4 py-4">
                            <span className="text-slate-400 text-xs font-semibold">{row.daysSinceLastOrder || 0} days</span>
                          </td>
                        </tr>
                      ))}
                      {inactive.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No inactive customers identified.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarketingSegmentsPage;
