import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast, UserSelector, Card, Button, IconButton, TextField, NumberInput, Select, Checkbox, DataTable } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
    salesSettingsService,
    validateSalesSettings,
    EARN_TRIGGERS,
    type EarnTrigger,
    type OverrideScope,
    type SalesSettings,
    type SalesShareOverride,
    type UnitVisibility,
} from '../../../services/salesSettingsService';
import { useCrmFeatureFlag, RE_FLAGS } from '../../../hooks/useCrmFeatureFlag';
import { describeApiError } from '../../../utils/apiErrorMessage';
import { CombGrid } from '../CombGrid';

const LABEL_CLS = 'block text-xs font-semibold text-fg-muted mb-1.5';
const CARD_BODY_CLS = 'space-y-5';

interface Props {
    canWrite: boolean;
}

const EARN_TRIGGER_VALUES: readonly string[] = EARN_TRIGGERS.map((t) => t.value);

/** Numeric input text → number; empty reads as NaN so validation catches it. */
const toPercent = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
const pctValue = (n: number): number | null => (Number.isFinite(n) ? n : null);
const fromPct = (v: number | null): number => (v == null ? Number.NaN : v);
type OverrideRow = SalesShareOverride & { __i: number };

/**
 * Settings → Sales & commission (RE Phase C). One settings row per org:
 * when commission is earned, whether it needs approval, VAT, the default
 * agent / team-leader split with per-role or per-user overrides, and — with
 * `action:crm:unit_allocation` — whether agents see every unit or only the
 * ones allocated to them. Edited inline, saved with one PUT.
 */
const SalesCommissionSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const shell = useShellBridge() as any;
    const orgId: string = shell?.currentOrg?.id ?? '';
    const tenantId: string | undefined = shell?.currentTenant?.id ?? undefined;
    const commissionsOn = useCrmFeatureFlag(RE_FLAGS.COMMISSIONS);
    const allocationOn = useCrmFeatureFlag(RE_FLAGS.UNIT_ALLOCATION);

    const [draft, setDraft] = useState<SalesSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setDraft(await salesSettingsService.get());
        } catch (e) {
            setLoadError(describeApiError(e, 'Could not load sales settings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-fg-subtle text-sm" role="status">
                <Loader2 className="animate-spin" size={16} /> Loading sales settings…
            </div>
        );
    }
    if (loadError || !draft) {
        return (
            <div className="space-y-3">
                <p role="alert" className="text-sm text-danger">{loadError ?? 'Could not load sales settings.'}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    Retry
                </Button>
            </div>
        );
    }

    const set = (patch: Partial<SalesSettings>) => {
        setError(null);
        setDraft((d) => (d ? { ...d, ...patch } : d));
    };
    const setOverride = (i: number, patch: Partial<SalesShareOverride>) =>
        set({ overrides: draft.overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    const addOverride = () =>
        set({
            overrides: [...draft.overrides, {
                scope: 'role',
                role_key: '',
                agent_share_percent: draft.default_agent_share_percent,
                team_leader_override_percent: draft.team_leader_override_percent,
            }],
        });
    const removeOverride = (i: number) => set({ overrides: draft.overrides.filter((_, j) => j !== i) });
    const changeScope = (i: number, scope: OverrideScope) => {
        const o = draft.overrides[i];
        const next: SalesShareOverride = scope === 'role'
            ? { scope, role_key: '', agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent }
            : { scope, user_id: '', agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent };
        set({ overrides: draft.overrides.map((x, j) => (j === i ? next : x)) });
    };

    const save = async () => {
        const problem = validateSalesSettings(draft);
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            setDraft(await salesSettingsService.save(draft));
            toast.success('Sales settings saved');
        } catch (e) {
            setError(describeApiError(e, 'Could not save sales settings.'));
        } finally {
            setSaving(false);
        }
    };

    const ro = !canWrite;

    const overrideColumns: DataTableColumn<OverrideRow>[] = [
        {
            key: 'scope',
            header: 'Applies to',
            render: (o) => (
                <Select
                    name={`override-scope-${o.__i}`}
                    aria-label={`Override ${o.__i + 1} applies to`}
                    value={o.scope}
                    disabled={ro}
                    options={[{ value: 'role', label: 'Role' }, { value: 'user', label: 'Person' }]}
                    onChange={(e) => changeScope(o.__i, e.target.value === 'user' ? 'user' : 'role')}
                />
            ),
        },
        {
            key: 'who',
            header: 'Who',
            render: (o) => o.scope === 'role' ? (
                <TextField
                    name={`override-role-${o.__i}`}
                    aria-label={`Override ${o.__i + 1} role`}
                    placeholder="Role key, e.g. sales_agent"
                    value={o.role_key ?? ''}
                    disabled={ro}
                    onChange={(e) => setOverride(o.__i, { role_key: e.target.value })}
                />
            ) : ro ? (
                <span className="text-fg-subtle">{o.user_id || '—'}</span>
            ) : (
                <UserSelector
                    value={o.user_id || undefined}
                    onChange={(id: string | string[] | null) =>
                        setOverride(o.__i, { user_id: Array.isArray(id) ? (id[0] ?? '') : (id ?? '') })}
                    orgId={orgId}
                    tenantId={tenantId}
                    placeholder="Pick a person"
                />
            ),
        },
        {
            key: 'agent_share_percent',
            header: 'Agent %',
            render: (o) => (
                <NumberInput
                    name={`override-agent-${o.__i}`}
                    aria-label={`Override ${o.__i + 1} agent share`}
                    min={0}
                    max={100}
                    value={pctValue(o.agent_share_percent)}
                    disabled={ro}
                    onChange={(v) => setOverride(o.__i, { agent_share_percent: fromPct(v) })}
                />
            ),
        },
        {
            key: 'team_leader_override_percent',
            header: 'Team leader %',
            render: (o) => (
                <NumberInput
                    name={`override-tl-${o.__i}`}
                    aria-label={`Override ${o.__i + 1} team-leader override`}
                    min={0}
                    max={100}
                    value={pctValue(o.team_leader_override_percent)}
                    disabled={ro}
                    onChange={(v) => setOverride(o.__i, { team_leader_override_percent: fromPct(v) })}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (o) => canWrite ? (
                <IconButton
                    label={`Remove override ${o.__i + 1}`}
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => removeOverride(o.__i)}
                />
            ) : null,
        },
    ];

    return (
        <div className="space-y-6">
            {commissionsOn && (
                <Card title="Commission">
                  <div className={CARD_BODY_CLS}>
                    <CombGrid cols="pair">
                        <div>
                            <Select
                                id="sales-earn-trigger"
                                name="sales-earn-trigger"
                                label="Commission is earned"
                                value={draft.earn_trigger}
                                disabled={ro}
                                options={EARN_TRIGGERS.map((t) => ({ value: t.value, label: t.label }))}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (EARN_TRIGGER_VALUES.includes(v)) set({ earn_trigger: v as EarnTrigger });
                                }}
                            />
                        </div>
                        <div>
                            <NumberInput
                                id="sales-vat"
                                name="sales-vat"
                                label="VAT on commission (%)"
                                min={0}
                                max={100}
                                step={0.01}
                                value={pctValue(draft.vat_percent)}
                                disabled={ro}
                                onChange={(v) => set({ vat_percent: fromPct(v) })}
                            />
                        </div>
                        <div>
                            <NumberInput
                                id="sales-agent-share"
                                name="sales-agent-share"
                                label="Default agent share (%)"
                                min={0}
                                max={100}
                                step={0.01}
                                value={pctValue(draft.default_agent_share_percent)}
                                disabled={ro}
                                onChange={(v) => set({ default_agent_share_percent: fromPct(v) })}
                            />
                        </div>
                        <div>
                            <NumberInput
                                id="sales-tl-override"
                                name="sales-tl-override"
                                label="Team-leader override (%)"
                                min={0}
                                max={100}
                                step={0.01}
                                value={pctValue(draft.team_leader_override_percent)}
                                disabled={ro}
                                onChange={(v) => set({ team_leader_override_percent: fromPct(v) })}
                            />
                        </div>
                    </CombGrid>
                    <Checkbox
                        name="sales-approval-required"
                        label="Commission needs manager approval before it becomes payable"
                        checked={draft.approval_required}
                        disabled={ro}
                        onChange={(e) => set({ approval_required: e.target.checked })}
                    />
                    <p className="text-xs text-fg-muted">The company keeps whatever is left after the agent and team-leader shares.</p>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={LABEL_CLS}>Overrides by role or person</span>
                            {canWrite && (
                                <Button type="button" variant="secondary" size="sm" onClick={addOverride}>
                                    <Plus size={14} /> Add override
                                </Button>
                            )}
                        </div>
                        {draft.overrides.length === 0 ? (
                            <p className="text-xs text-fg-muted">No overrides — everyone uses the default split.</p>
                        ) : (
                            <DataTable<OverrideRow>
                                name="share-overrides"
                                data-testid="share-overrides"
                                rows={draft.overrides.map((o, i) => ({ ...o, __i: i }))}
                                rowKey={(o) => String(o.__i)}
                                columns={overrideColumns}
                            />
                        )}
                    </div>
                  </div>
                </Card>
            )}

            {allocationOn && (
                <Card title="Unit visibility">
                  <div className={CARD_BODY_CLS}>
                    <div className="flex gap-1 bg-surface-sunken p-1 rounded-nb border border-line w-fit" role="radiogroup" aria-label="Agents can book">
                        {([['all', 'Any available unit'], ['assigned_only', 'Only units allocated to them']] as const).map(([v, label]) => (
                            <Button variant={draft.unit_visibility === v ? "primary" : "secondary"} size="sm" key={v} type="button" role="radio" aria-checked={draft.unit_visibility === v} disabled={ro} onClick={() => set({ unit_visibility: v as UnitVisibility })}>
                                {label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-fg-muted">Managers can always see and book every unit.</p>
                  </div>
                </Card>
            )}

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            {canWrite ? (
                <div className="flex items-center justify-end gap-nb-2">
                    <Button type="button" variant="secondary" onClick={() => void load()} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" variant="primary" onClick={() => void save()} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save sales settings
                    </Button>
                </div>
            ) : (
                <p className="text-xs text-fg-muted">You can view these settings but not change them.</p>
            )}
        </div>
    );
};

export default SalesCommissionSettingsTab;
