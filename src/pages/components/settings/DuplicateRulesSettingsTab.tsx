import React, { useCallback, useEffect, useState } from 'react';
import { toast, Card, Button, Select, Checkbox } from '@so360/design-system';
import { duplicateRulesService, DuplicateRule, DuplicateAction, DUPLICATE_FIELDS, DUPLICATE_FIELD_LABELS } from '../../../services/salesConfigService';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean }

const ACTIONS = [
    { value: 'warn', label: 'Warn (allow create anyway)' },
    { value: 'block', label: 'Block' },
];

/** Fills any field the server has no row for, so all three always show. */
export function withAllFields(rules: DuplicateRule[]): DuplicateRule[] {
    return DUPLICATE_FIELDS.map((field) => rules.find((r) => r.field === field) ?? { field, action: 'warn' as const, is_active: false });
}

/** Settings -> Duplicate rules. Which fields mark a lead as a duplicate, and what happens. */
const DuplicateRulesSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [rules, setRules] = useState<DuplicateRule[]>(withAllFields([]));
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setRules(withAllFields(await duplicateRulesService.get())); }
        catch (err) { toast.error(describeApiError(err, 'Could not load duplicate rules.')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const set = (field: string, body: Partial<DuplicateRule>) =>
        setRules((rs) => rs.map((r) => (r.field === field ? { ...r, ...body } : r)));

    const save = async () => {
        setBusy(true);
        try {
            setRules(withAllFields(await duplicateRulesService.put(rules)));
            toast.success('Duplicate rules saved');
        } catch (err) { toast.error(describeApiError(err, 'Could not save the rules.')); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-nb-4" data-testid="duplicate-rules-tab">
            <Card title="Duplicate rules" actions={canWrite ? <Button type="button" variant="primary" onClick={save} disabled={busy || loading}>Save</Button> : undefined}>
                <p className="text-xs text-fg-muted mb-nb-3">Applied when a lead is created or imported. Email is always unique per organisation.</p>
                <ul className="divide-y divide-line">
                    {rules.map((r) => (
                        <li key={r.field} className="flex flex-wrap items-center gap-nb-3 py-nb-2" data-testid={`dup-rule-${r.field}`}>
                            <span className="w-32 text-sm text-fg">{DUPLICATE_FIELD_LABELS[r.field]}</span>
                            <Checkbox name={`dup-${r.field}-active`} label="Check" checked={r.is_active} disabled={!canWrite} onChange={(e) => set(r.field, { is_active: e.target.checked })} />
                            <Select name={`dup-${r.field}-action`} aria-label={`${DUPLICATE_FIELD_LABELS[r.field]} action`} value={r.action} options={ACTIONS} disabled={!canWrite || !r.is_active} onChange={(e) => set(r.field, { action: e.target.value as DuplicateAction })} />
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
};

export default DuplicateRulesSettingsTab;
