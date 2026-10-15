import React, { useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { salesTargetService } from '../../services/salesTargetService';
import { Modal } from '../../components/common/Modal';
import { useConfirm, ListPageTemplate, Button, DataTable, EmptyState, Badge, Switch, TextField, Select, Checkbox } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';
import { Trash2 } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  FLOW_TRANSITION: 'Flow Transition',
  CRM_TABLE: 'CRM Auto',
};

const INDUSTRY_OPTIONS = [
  'all', 'professional_services', 'ecommerce', 'trading', 'construction', 'services',
];

const CRM_TABLE_RULES = [
  { label: 'New Lead Created', rule: { table: 'leads', owner_col: 'owner_person_id', date_col: 'created_at' } },
  { label: 'Deal Created', rule: { table: 'deals', owner_col: 'owner_person_id', date_col: 'created_at' } },
  { label: 'Deal Won', rule: { table: 'deals', owner_col: 'owner_person_id', date_col: 'won_at' } },
];

const EMPTY_FORM = {
  name: '',
  source: 'MANUAL',
  industry_tags: [] as string[],
  unit: '',
  flow_trigger: { entity_type: '', transition_key: '' },
  crm_table_rule_preset: '',
};

export default function AdminTaskTypesPage() {
  const [confirm, confirmDialog] = useConfirm();
  const shell = useShellBridge();
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState('all');

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = () => {
    setLoading(true);
    salesTargetService.listTaskTypes()
      .then(setTaskTypes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const preset = CRM_TABLE_RULES.find(r => r.label === form.crm_table_rule_preset);
      const body: any = {
        name: form.name,
        source: form.source,
        industry_tags: form.industry_tags,
        unit: form.unit || 'activities',
      };
      if (form.source === 'FLOW_TRANSITION') body.flow_trigger = form.flow_trigger;
      if (form.source === 'CRM_TABLE' && preset) body.crm_table_rule = preset.rule;

      await salesTargetService.createTaskType(body);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tt: any) => {
    try {
      await salesTargetService.updateTaskType(tt.id, { active: !tt.active });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (tt: any) => {
    if (!await confirm({ title: 'Delete?', message: `Delete "${tt.name}"?`, intent: 'danger', confirmLabel: 'Delete' })) return;
    try {
      await salesTargetService.deleteTaskType(tt.id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const visible = taskTypes.filter(tt =>
    filterIndustry === 'all' || (tt.industry_tags ?? []).includes(filterIndustry)
  );

  const columns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name', sortable: true, sortValue: (tt) => tt.name || '', render: (tt) => (
      <span className="text-fg font-medium">
        {tt.name}
        {tt.is_predefined && <span className="ml-nb-2 text-xs text-fg-muted font-normal">(predefined)</span>}
      </span>
    ) },
    { key: 'source', header: 'Source', render: (tt) => (
      <Badge tone={tt.source === 'MANUAL' ? 'neutral' : tt.source === 'FLOW_TRANSITION' ? 'info' : 'success'}>
        {SOURCE_LABELS[tt.source] ?? tt.source}
      </Badge>
    ) },
    { key: 'unit', header: 'Unit', render: (tt) => <span className="text-fg-subtle">{tt.unit}</span> },
    { key: 'industries', header: 'Industries', render: (tt) => <span className="text-fg-subtle text-xs">{(tt.industry_tags ?? []).join(', ') || '—'}</span> },
    { key: 'status', header: 'Status', render: (tt) => (
      <Switch
        aria-label={`Toggle ${tt.name}`}
        checked={!!tt.active}
        onCheckedChange={() => handleToggleActive(tt)}
      />
    ) },
  ];

  return (
    <ListPageTemplate
      title="Sales Activity Types"
      description="Define what activities reps track — auto-counted or manual"
      primaryAction={<Button onClick={() => setShowModal(true)}>+ New Type</Button>}
      filterConfig={{
        fields: [{
          key: 'industry',
          label: 'Industry',
          type: 'select',
          quick: true,
          options: INDUSTRY_OPTIONS.filter(i => i !== 'all').map(i => ({ value: i, label: i.replace(/_/g, ' ') })),
        }],
        values: { industry: filterIndustry === 'all' ? '' : filterIndustry } as FilterValues,
        onChange: (v: FilterValues) => setFilterIndustry(String(v.industry || '') || 'all'),
        onClear: () => setFilterIndustry('all'),
      }}
    >
      {confirmDialog}

      {error && (
        <div className="mb-4 p-3 bg-danger/30 border border-danger rounded text-danger text-sm">{error}</div>
      )}

      {(
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(tt: any) => tt.id}
          loading={loading}
          rowActions={(tt: any) => tt.is_predefined ? [] : [
            { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => handleDelete(tt) },
          ]}
          getRowProps={(tt: any) => ({ 'data-testid': `task-type-row-${tt.id}` })}
          emptyState={<EmptyState title="No task types yet" />}
        />
      )}

      {/* Create modal */}
      {showModal && (
        <Modal
          isOpen
          size="md"
          title="New Activity Type"
          dismissible={!saving}
          data-testid="new-activity-type-modal"
          onClose={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); }}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); }}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleSave} disabled={saving || !form.name}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <TextField
                name="task_type_name"
                label="Name"
                placeholder="e.g. LinkedIn DM Sent"
                value={form.name}
                onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))}
              />

              <Select
                name="task_type_source"
                label="Source"
                value={form.source}
                onChange={(e: any) => setForm(f => ({ ...f, source: e.target.value }))}
                options={[
                  { value: 'MANUAL', label: 'Manual (off-platform — rep taps +1)' },
                  { value: 'FLOW_TRANSITION', label: 'Flow Transition (auto-counted from workflow)' },
                  { value: 'CRM_TABLE', label: 'CRM Auto (counted from leads/deals table)' },
                ]}
              />

              {form.source === 'FLOW_TRANSITION' && (
                <div className="space-y-nb-2">
                  <TextField
                    name="task_type_entity"
                    label="Entity Type"
                    placeholder="e.g. deal"
                    value={form.flow_trigger.entity_type}
                    onChange={(e: any) => setForm(f => ({ ...f, flow_trigger: { ...f.flow_trigger, entity_type: e.target.value } }))}
                  />
                  <TextField
                    name="task_type_transition"
                    label="Transition Key"
                    placeholder="e.g. sent_proposal"
                    value={form.flow_trigger.transition_key}
                    onChange={(e: any) => setForm(f => ({ ...f, flow_trigger: { ...f.flow_trigger, transition_key: e.target.value } }))}
                  />
                </div>
              )}

              {form.source === 'CRM_TABLE' && (
                <Select
                  name="task_type_rule"
                  label="Count Rule"
                  value={form.crm_table_rule_preset}
                  onChange={(e: any) => setForm(f => ({ ...f, crm_table_rule_preset: e.target.value }))}
                  options={[{ value: '', label: 'Select…' }, ...CRM_TABLE_RULES.map(r => ({ value: r.label, label: r.label }))]}
                />
              )}

              <TextField
                name="task_type_unit"
                label="Unit (display label)"
                placeholder="e.g. DMs, proposals, leads"
                value={form.unit}
                onChange={(e: any) => setForm(f => ({ ...f, unit: e.target.value }))}
              />

              <div>
                <label className="block text-xs text-fg-subtle mb-1">Industries</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_OPTIONS.filter(i => i !== 'all').map(ind => (
                    <Checkbox
                      key={ind}
                      label={ind.replace(/_/g, ' ')}
                      checked={form.industry_tags.includes(ind)}
                      onChange={(e: any) => setForm(f => ({
                        ...f,
                        industry_tags: e.target.checked
                          ? [...f.industry_tags, ind]
                          : f.industry_tags.filter(t => t !== ind),
                      }))}
                    />
                  ))}
                </div>
              </div>
            </div>
        </Modal>
      )}
    </ListPageTemplate>
  );
}
