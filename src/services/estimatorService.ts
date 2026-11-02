import { crmApiClient } from './crmService';

/** Proposal Estimator (crm-be /estimator/*). Gate: submodule:crm:proposal_estimator. */
export const ESTIMATOR_FLAG = 'submodule:crm:proposal_estimator';

export type IncentiveType = 'percent' | 'per_kw' | 'fixed';

export interface FinanceProduct {
    id: string; name: string; apr_pct: number; term_months: number;
    down_payment_pct: number; dealer_fee_pct: number; is_active: boolean;
}
export interface IncentiveRule {
    id: string; name: string; type: IncentiveType; value: number;
    cap?: number | null; applies_before_tax: boolean; is_active: boolean;
}
export interface ProductionSettings {
    enabled: boolean; specific_yield_kwh_per_kw_year: number; degradation_pct_per_year: number;
    tariff_per_kwh: number; tariff_escalation_pct: number; lifetime_years: number;
}
export interface EstimatorSettings {
    industry_key: string; finance_products: FinanceProduct[]; incentive_rules: IncentiveRule[];
    production: ProductionSettings; is_default?: boolean;
}
export interface ComputeBody {
    price: number; system_size_kw?: number; finance_product_id?: string;
    incentive_rule_ids?: string[]; annual_consumption_kwh?: number;
}
export interface ComputeResult {
    incentives: Array<{ id: string; name: string; amount: number }>;
    incentives_total: number; net_price: number;
    financing: Array<{ product_id: string; name: string; down_payment: number; principal: number; monthly_payment: number; total_paid: number; total_interest: number }>;
    production?: { year1_kwh: number; lifetime_kwh: number; year1_savings: number; lifetime_savings: number; payback_years: number | null; offset_pct: number | null };
}

export const ESTIMATOR_INDUSTRY_KEYS = ['energy', 'construction', 'generic'] as const;

export const estimatorService = {
    presets: (): Promise<EstimatorSettings[]> => crmApiClient.get('/estimator/presets'),
    getSettings: (industryKey?: string): Promise<EstimatorSettings> =>
        crmApiClient.get(`/estimator/settings${industryKey ? `?industry_key=${encodeURIComponent(industryKey)}` : ''}`),
    saveSettings: (body: Partial<EstimatorSettings>): Promise<EstimatorSettings> =>
        crmApiClient.put('/estimator/settings', body),
    applyPreset: (industry_key: string): Promise<EstimatorSettings> =>
        crmApiClient.post('/estimator/settings/apply-preset', { industry_key }),
    compute: (body: ComputeBody): Promise<ComputeResult> =>
        crmApiClient.post('/estimator/compute', body),
};
