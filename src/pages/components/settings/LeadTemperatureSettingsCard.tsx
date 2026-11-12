import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Thermometer } from 'lucide-react';
import { toast, Button, TextField } from '@so360/design-system';
import {
    leadTemperatureSettingsService,
    validateLeadTemperatureSettings,
    TEMPERATURE_FACTORS,
    type LeadTemperatureSettings,
    type TemperatureFactorKey,
} from '../../../services/leadTemperatureSettingsService';
import { describeApiError } from '../../../utils/apiErrorMessage';


/** Numeric input text → number; empty reads as NaN so validation catches it. */
const toNumber = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
const show = (n: number): string => (Number.isFinite(n) ? String(n) : '');

interface Props {
    canWrite: boolean;
}

/**
 * Settings → Lead Scoring → Lead temperature (RE plan E §20). Per-org
 * Hot / Warm thresholds and the weight of each factor. Saving re-bands every
 * lead server-side. Rendered only when `submodule:crm:re_lead_temperature`
 * is on (the caller gates it).
 */
const LeadTemperatureSettingsCard: React.FC<Props> = ({ canWrite }) => {
    const [draft, setDraft] = useState<LeadTemperatureSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setDraft(await leadTemperatureSettingsService.get());
        } catch (e) {
            setLoadError(describeApiError(e, 'Could not load lead temperature settings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const set = (patch: Partial<LeadTemperatureSettings>) => {
        setError(null);
        setDraft((d) => (d ? { ...d, ...patch } : d));
    };
    const setWeight = (key: TemperatureFactorKey, value: number) =>
        setDraft((d) => (d ? { ...d, weights: { ...d.weights, [key]: value } } : d));

    const save = async () => {
        if (!draft) return;
        const problem = validateLeadTemperatureSettings(draft);
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            setDraft(await leadTemperatureSettingsService.save(draft));
            toast.success('Lead temperature settings saved — leads are being re-banded');
        } catch (e) {
            setError(describeApiError(e, 'Could not save lead temperature settings.'));
        } finally {
            setSaving(false);
        }
    };

    const ro = !canWrite;

    return (
        <section
            data-testid="lead-temperature-settings"
            aria-label="Lead temperature"
            className="bg-surface border border-line rounded-2xl p-6 space-y-5"
        >
            <div>
                <h3 className="font-black text-fg uppercase tracking-widest text-xs flex items-center gap-2">
                    {Thermometer ? <Thermometer size={14} className="text-danger" /> : null}
                    Lead Temperature
                </h3>
                <p className="text-xs text-fg-subtle font-bold mt-1 uppercase tracking-tight">
                    Hot / Warm / Cold from budget fit, timeline, engagement and source
                </p>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-fg-muted text-sm" role="status">
                    {Loader2 ? <Loader2 className="animate-spin" size={16} /> : null} Loading lead temperature settings…
                </div>
            )}

            {!loading && (loadError || !draft) && (
                <div className="space-y-3">
                    <p role="alert" className="text-sm text-danger">{loadError ?? 'Could not load lead temperature settings.'}</p>
                    <Button type="button" variant="secondary" onClick={() => void load()}>Retry</Button>
                </div>
            )}

            {!loading && draft && !loadError && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <TextField id="temp-hot-min" name="temp-hot-min" label="Hot at or above" type="number" min={0} max={100} value={show(draft.hot_min)} disabled={ro} onChange={(e) => set({ hot_min: toNumber(e.target.value) })} />
                        </div>
                        <div>
                            <TextField id="temp-warm-min" name="temp-warm-min" label="Warm at or above" type="number" min={0} max={100} value={show(draft.warm_min)} disabled={ro} onChange={(e) => set({ warm_min: toNumber(e.target.value) })} />
                        </div>
                    </div>
                    <p className="text-xs text-fg-subtle">Below the Warm threshold a lead is Cold.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {TEMPERATURE_FACTORS.map((f) => (
                            <div key={f.key}>
                                <TextField id={`temp-weight-${f.key}`} name={`temp-weight-${f.key}`} label={`${f.label} weight`} type="number" min={0} max={100} value={show(draft.weights[f.key])} disabled={ro} onChange={(e) => { setError(null); setWeight(f.key, toNumber(e.target.value)); }} />
                                <p className="text-xs text-fg-subtle mt-1">{f.hint}</p>
                            </div>
                        ))}
                    </div>

                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}

                    {canWrite && (
                        <div className="flex justify-end">
                            <Button type="button" variant="primary" onClick={() => void save()} disabled={saving}>
                                {saving
                                    ? (Loader2 ? <Loader2 className="animate-spin" size={14} /> : null)
                                    : (Save ? <Save size={14} /> : null)}
                                Save temperature
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default LeadTemperatureSettingsCard;
