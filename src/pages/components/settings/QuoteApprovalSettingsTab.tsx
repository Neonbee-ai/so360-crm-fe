import React, { useCallback, useEffect, useState } from 'react';
import { toast, Card, Button, Select, Checkbox, TextField } from '@so360/design-system';
import { quoteApprovalService, DEFAULT_QUOTE_APPROVAL, QuoteApprovalSettings, QuoteApprovalTrigger } from '../../../services/salesConfigService';
import { describeApiError } from '../../../utils/apiErrorMessage';

interface Props { canWrite: boolean }

const TRIGGERS = [
    { value: 'submit', label: 'When submitted for approval' },
    { value: 'send', label: 'Before sending to the customer' },
    { value: 'both', label: 'Both' },
];

const toNum = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
const show = (v: number | null) => (v === null ? '' : String(v));

/** Settings -> Quote approvals. Thresholds that route a quote to an approver. */
const QuoteApprovalSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [s, setS] = useState<QuoteApprovalSettings>(DEFAULT_QUOTE_APPROVAL);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setS(await quoteApprovalService.get()); }
        catch (err) { toast.error(describeApiError(err, 'Could not load quote approval settings.')); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const patch = (b: Partial<QuoteApprovalSettings>) => setS((c) => ({ ...c, ...b }));

    const save = async () => {
        setBusy(true);
        try {
            setS(await quoteApprovalService.put(s));
            toast.success('Quote approval settings saved');
        } catch (err) { toast.error(describeApiError(err, 'Could not save the settings.')); }
        finally { setBusy(false); }
    };

    const dis = !canWrite || !s.enabled;
    return (
        <div className="space-y-nb-4" data-testid="quote-approval-tab">
            <Card title="Quote approvals" actions={canWrite ? <Button type="button" variant="primary" onClick={save} disabled={busy || loading}>Save</Button> : undefined}>
                <p className="text-xs text-fg-muted mb-nb-3">A quote that crosses any threshold needs approval before it can be sent. Leave a threshold blank to ignore it.</p>
                <div className="space-y-nb-3">
                    <Checkbox name="qa-enabled" label="Require approval above thresholds" checked={s.enabled} disabled={!canWrite} onChange={(e) => patch({ enabled: e.target.checked })} />
                    <TextField name="qa-discount" type="number" label="Discount above (%)" value={show(s.discount_percent_above)} disabled={dis} onChange={(e) => patch({ discount_percent_above: toNum(e.target.value) })} />
                    <TextField name="qa-total" type="number" label="Quote total above" value={show(s.total_above)} disabled={dis} onChange={(e) => patch({ total_above: toNum(e.target.value) })} />
                    <TextField name="qa-margin" type="number" label="Margin below (%)" value={show(s.margin_percent_below)} disabled={dis} onChange={(e) => patch({ margin_percent_below: toNum(e.target.value) })} />
                    <TextField name="qa-role" label="Approver role" value={s.approver_role ?? ''} disabled={dis} onChange={(e) => patch({ approver_role: e.target.value.trim() === '' ? null : e.target.value })} />
                    <Select name="qa-apply-on" label="Check" value={s.apply_on} options={TRIGGERS} disabled={dis} onChange={(e) => patch({ apply_on: e.target.value as QuoteApprovalTrigger })} />
                </div>
            </Card>
        </div>
    );
};

export default QuoteApprovalSettingsTab;
