import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, NumberInput, Select } from '@so360/design-system';
import { useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';
import { ESTIMATOR_FLAG, estimatorService, type ComputeResult, type EstimatorSettings } from '../../services/estimatorService';

interface Props {
    /** Quote / deal total the estimate is computed on. */
    price: number;
    /** Org currency formatter (from Core business_settings). */
    formatCurrency: (n: number) => string;
}

const Row: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
    <div className="flex items-center justify-between text-sm" data-testid={testId}>
        <span className="text-fg-subtle">{label}</span>
        <span className="text-fg font-semibold">{value}</span>
    </div>
);

export const ProposalEstimatorPanel: React.FC<Props> = ({ price, formatCurrency }) => {
    const enabled = useCrmFeatureFlag(ESTIMATOR_FLAG);
    const [settings, setSettings] = useState<EstimatorSettings | null>(null);
    const [sizeKw, setSizeKw] = useState<number | null>(null);
    const [consumption, setConsumption] = useState<number | null>(null);
    const [productId, setProductId] = useState('');
    const [result, setResult] = useState<ComputeResult | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        let live = true;
        estimatorService.getSettings().then((s) => { if (live) setSettings(s); }).catch(() => { if (live) setError('Could not load estimator settings'); });
        return () => { live = false; };
    }, [enabled]);

    if (!enabled) return null;

    const products = (settings?.finance_products ?? []).filter((p) => p.is_active);
    const showProduction = settings?.production?.enabled === true;

    const run = async () => {
        setBusy(true); setError('');
        try {
            setResult(await estimatorService.compute({
                price,
                ...(sizeKw ? { system_size_kw: sizeKw } : {}),
                ...(productId ? { finance_product_id: productId } : {}),
                ...(consumption ? { annual_consumption_kwh: consumption } : {}),
            }));
        } catch (e: any) {
            setResult(null); setError(e?.message || 'Estimate failed');
        } finally { setBusy(false); }
    };

    return (
        <Card title="Proposal estimator" data-testid="proposal-estimator">
            <div className="flex flex-col gap-nb-3">
                {showProduction && (
                    <>
                        <NumberInput name="estimator-size" label="System size (kW)" min={0} value={sizeKw} onChange={setSizeKw} data-testid="estimator-size" />
                        <NumberInput name="estimator-consumption" label="Annual consumption (kWh)" min={0} value={consumption} onChange={setConsumption} data-testid="estimator-consumption" />
                    </>
                )}
                <Select
                    label="Financing"
                    name="estimator-product"
                    value={productId}
                    onChange={(e: any) => setProductId(e?.target ? e.target.value : e)}
                    options={[{ value: '', label: 'All options' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                    data-testid="estimator-product"
                />
                <Button type="button" onClick={() => void run()} disabled={busy} data-testid="estimator-run">{busy ? 'Calculating…' : 'Calculate'}</Button>
                {error && <Alert variant="error" data-testid="estimator-error">{error}</Alert>}
                {result && (
                    <div className="flex flex-col gap-nb-2" data-testid="estimator-result">
                        {result.incentives.map((i) => <Row key={i.id} label={i.name} value={`-${formatCurrency(i.amount)}`} />)}
                        <Row label="Net price" value={formatCurrency(result.net_price)} testId="estimator-net" />
                        {result.financing.map((f) => (
                            <Row key={f.product_id} label={f.name} testId={`estimator-fin-${f.product_id}`}
                                value={f.monthly_payment > 0 ? `${formatCurrency(f.monthly_payment)}/mo` : formatCurrency(f.total_paid)} />
                        ))}
                        {result.production && (
                            <>
                                <Row label="Year-1 production" value={`${Math.round(result.production.year1_kwh).toLocaleString()} kWh`} />
                                <Row label="Lifetime savings" value={formatCurrency(result.production.lifetime_savings)} />
                                <Row label="Payback" value={result.production.payback_years === null ? 'n/a' : `${result.production.payback_years} yrs`} testId="estimator-payback" />
                                {result.production.offset_pct !== null && <Row label="Consumption offset" value={`${result.production.offset_pct}%`} />}
                            </>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ProposalEstimatorPanel;
