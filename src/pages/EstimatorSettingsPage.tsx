import React, { useEffect, useState } from 'react';
import { useShellBridge, useOrganization } from '@so360/shell-context';
import { Button, Card, FormPageTemplate, NumberInput, Select, Spinner, Switch, TextField, toast } from '@so360/design-system';
import { useCrmFeatureFlag } from '../hooks/useCrmFeatureFlag';
import {
    ESTIMATOR_FLAG, ESTIMATOR_INDUSTRY_KEYS, estimatorService,
    type EstimatorSettings, type FinanceProduct, type IncentiveRule,
} from '../services/estimatorService';

const TRAIL = [{ label: 'Settings', to: '/crm/settings' }];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${Date.now()}`;

const EstimatorSettingsPage: React.FC = () => {
    const enabled = useCrmFeatureFlag(ESTIMATOR_FLAG);
    const shell = useShellBridge() as any;
    const org = (useOrganization() as any)?.currentOrg;
    const orgIndustry: string | undefined = org?.industry_key || shell?.currentOrg?.industry_key;
    const [s, setS] = useState<EstimatorSettings | null>(null);
    const [presetKey, setPresetKey] = useState<string>(orgIndustry && (ESTIMATOR_INDUSTRY_KEYS as readonly string[]).includes(orgIndustry) ? orgIndustry : 'generic');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        estimatorService.getSettings(orgIndustry).then(setS).catch(() => toast.error('Could not load estimator settings'));
    }, [enabled, orgIndustry]);

    if (!enabled) return null;
    if (!s) return <FormPageTemplate title="Proposal estimator" trail={TRAIL}><Spinner /></FormPageTemplate>;

    const patchProduct = (i: number, p: Partial<FinanceProduct>) =>
        setS({ ...s, finance_products: s.finance_products.map((x, k) => (k === i ? { ...x, ...p } : x)) });
    const patchRule = (i: number, p: Partial<IncentiveRule>) =>
        setS({ ...s, incentive_rules: s.incentive_rules.map((x, k) => (k === i ? { ...x, ...p } : x)) });

    const save = async () => {
        setSaving(true);
        try {
            const saved = await estimatorService.saveSettings({
                industry_key: s.industry_key, finance_products: s.finance_products,
                incentive_rules: s.incentive_rules, production: s.production,
            });
            setS(saved); toast.success('Estimator settings saved');
        } catch (e: any) { toast.error(e?.message || 'Save failed'); } finally { setSaving(false); }
    };
    const applyPreset = async () => {
        try { setS(await estimatorService.applyPreset(presetKey)); toast.success('Preset applied'); }
        catch (e: any) { toast.error(e?.message || 'Could not apply preset'); }
    };

    return (
        <FormPageTemplate
            trail={TRAIL}
            title="Proposal estimator"
            primaryAction={<Button type="button" disabled={saving} onClick={() => void save()} data-testid="estimator-save">{saving ? 'Saving…' : 'Save'}</Button>}
        >
            <div className="flex flex-col gap-nb-3">
                <Card title="Industry preset">
                    <div className="flex items-end gap-nb-2">
                        {orgIndustry ? (
                            <span className="text-sm text-fg-muted" data-testid="estimator-org-industry">Industry: {orgIndustry}</span>
                        ) : null}
                        <Select
                            label="Preset" name="estimator-preset" value={presetKey}
                            onChange={(e: any) => setPresetKey(e?.target ? e.target.value : e)}
                            options={ESTIMATOR_INDUSTRY_KEYS.map((k) => ({ value: k, label: k }))}
                            data-testid="estimator-preset"
                        />
                        <Button type="button" variant="secondary" onClick={() => void applyPreset()} data-testid="estimator-apply-preset">Apply industry preset</Button>
                    </div>
                </Card>

                <Card title="Finance products" actions={
                    <Button type="button" size="sm" variant="secondary" data-testid="estimator-add-product"
                        onClick={() => setS({ ...s, finance_products: [...s.finance_products, { id: `plan-${s.finance_products.length + 1}`, name: 'New plan', apr_pct: 0, term_months: 12, down_payment_pct: 0, dealer_fee_pct: 0, is_active: true }] })}>Add</Button>}>
                    <div className="flex flex-col gap-nb-3">
                        {s.finance_products.map((p, i) => (
                            <div key={p.id + i} className="flex flex-wrap items-end gap-nb-2" data-testid={`estimator-product-${i}`}>
                                <TextField label="Name" name={`p-name-${i}`} value={p.name} data-testid={`estimator-product-name-${i}`}
                                    onChange={(e: any) => patchProduct(i, { name: e.target.value, id: slug(e.target.value) })} />
                                <NumberInput label="APR %" name={`p-apr-${i}`} min={0} value={p.apr_pct} onChange={(v) => patchProduct(i, { apr_pct: v ?? 0 })} data-testid={`estimator-product-apr-${i}`} />
                                <NumberInput label="Term (months)" name={`p-term-${i}`} min={0} value={p.term_months} onChange={(v) => patchProduct(i, { term_months: v ?? 0 })} />
                                <NumberInput label="Down %" name={`p-down-${i}`} min={0} value={p.down_payment_pct} onChange={(v) => patchProduct(i, { down_payment_pct: v ?? 0 })} />
                                <NumberInput label="Fee %" name={`p-fee-${i}`} min={0} value={p.dealer_fee_pct} onChange={(v) => patchProduct(i, { dealer_fee_pct: v ?? 0 })} />
                                <Switch label="Active" name={`est-product-active-${i}`} checked={p.is_active} onCheckedChange={(v: boolean) => patchProduct(i, { is_active: v })} />
                                <Button type="button" size="sm" variant="secondary" onClick={() => setS({ ...s, finance_products: s.finance_products.filter((_, k) => k !== i) })}>Remove</Button>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Incentives & tax credits" actions={
                    <Button type="button" size="sm" variant="secondary" data-testid="estimator-add-rule"
                        onClick={() => setS({ ...s, incentive_rules: [...s.incentive_rules, { id: `rule-${s.incentive_rules.length + 1}`, name: 'New incentive', type: 'percent', value: 0, cap: null, applies_before_tax: false, is_active: false }] })}>Add</Button>}>
                    <div className="flex flex-col gap-nb-3">
                        {s.incentive_rules.map((r, i) => (
                            <div key={r.id + i} className="flex flex-wrap items-end gap-nb-2" data-testid={`estimator-rule-${i}`}>
                                <TextField label="Name" name={`r-name-${i}`} value={r.name} onChange={(e: any) => patchRule(i, { name: e.target.value, id: slug(e.target.value) })} />
                                <Select label="Type" name={`r-type-${i}`} value={r.type} onChange={(e: any) => patchRule(i, { type: (e?.target ? e.target.value : e) as IncentiveRule['type'] })}
                                    options={[{ value: 'percent', label: 'Percent of price' }, { value: 'per_kw', label: 'Per kW' }, { value: 'fixed', label: 'Fixed amount' }]} />
                                <NumberInput label="Value" name={`r-value-${i}`} min={0} value={r.value} onChange={(v) => patchRule(i, { value: v ?? 0 })} data-testid={`estimator-rule-value-${i}`} />
                                <NumberInput label="Cap" name={`r-cap-${i}`} min={0} value={r.cap ?? null} onChange={(v) => patchRule(i, { cap: v })} />
                                <Switch label="Before tax" name={`est-rule-before-tax-${i}`} checked={r.applies_before_tax} onCheckedChange={(v: boolean) => patchRule(i, { applies_before_tax: v })} />
                                <Switch label="Active" name={`est-rule-active-${i}`} checked={r.is_active} onCheckedChange={(v: boolean) => patchRule(i, { is_active: v })} />
                                <Button type="button" size="sm" variant="secondary" onClick={() => setS({ ...s, incentive_rules: s.incentive_rules.filter((_, k) => k !== i) })}>Remove</Button>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Production estimate">
                    <div className="flex flex-wrap items-end gap-nb-2">
                        <Switch label="Enabled" name="est-production-enabled" checked={s.production.enabled} data-testid="estimator-production-enabled"
                            onCheckedChange={(v: boolean) => setS({ ...s, production: { ...s.production, enabled: v } })} />
                        <NumberInput label="Yield (kWh per kW per year)" name="prod-yield" min={0} value={s.production.specific_yield_kwh_per_kw_year} onChange={(v) => setS({ ...s, production: { ...s.production, specific_yield_kwh_per_kw_year: v ?? 0 } })} />
                        <NumberInput label="Degradation % / year" name="prod-deg" min={0} value={s.production.degradation_pct_per_year} onChange={(v) => setS({ ...s, production: { ...s.production, degradation_pct_per_year: v ?? 0 } })} />
                        <NumberInput label="Tariff per kWh" name="prod-tariff" min={0} value={s.production.tariff_per_kwh} onChange={(v) => setS({ ...s, production: { ...s.production, tariff_per_kwh: v ?? 0 } })} data-testid="estimator-tariff" />
                        <NumberInput label="Tariff escalation % / year" name="prod-esc" min={0} value={s.production.tariff_escalation_pct} onChange={(v) => setS({ ...s, production: { ...s.production, tariff_escalation_pct: v ?? 0 } })} />
                        <NumberInput label="Lifetime (years)" name="prod-life" min={1} value={s.production.lifetime_years} onChange={(v) => setS({ ...s, production: { ...s.production, lifetime_years: v ?? 25 } })} />
                    </div>
                </Card>
            </div>
        </FormPageTemplate>
    );
};

export default EstimatorSettingsPage;
