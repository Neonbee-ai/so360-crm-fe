import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Thermometer } from 'lucide-react';
import { toast } from '@so360/design-system';
import {
    leadTemperatureSettingsService,
    validateLeadTemperatureSettings,
    TEMPERATURE_FACTORS,
    type LeadTemperatureSettings,
    type TemperatureFactorKey,
} from '../../../services/leadTemperatureSettingsService';
import { describeApiError } from '../../../utils/apiErrorMessage';

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all font-bold text-sm disabled:opacity-60';
const LABEL_CLS = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5';

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
            className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 space-y-5"
        >
            <div>
                <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs flex items-center gap-2">
                    {Thermometer ? <Thermometer size={14} className="text-rose-400" /> : null}
                    Lead Temperature
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">
                    Hot / Warm / Cold from budget fit, timeline, engagement and source
                </p>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm" role="status">
                    {Loader2 ? <Loader2 className="animate-spin" size={16} /> : null} Loading lead temperature settings…
                </div>
            )}

            {!loading && (loadError || !draft) && (
                <div className="space-y-3">
                    <p role="alert" className="text-sm text-rose-400">{loadError ?? 'Could not load lead temperature settings.'}</p>
                    <button type="button" onClick={() => void load()} className="text-xs font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">
                        Retry
                    </button>
                </div>
            )}

            {!loading && draft && !loadError && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="temp-hot-min" className={LABEL_CLS}>Hot at or above</label>
                            <input
                                id="temp-hot-min"
                                type="number"
                                min={0}
                                max={100}
                                className={FIELD_CLS}
                                value={show(draft.hot_min)}
                                disabled={ro}
                                onChange={(e) => set({ hot_min: toNumber(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="temp-warm-min" className={LABEL_CLS}>Warm at or above</label>
                            <input
                                id="temp-warm-min"
                                type="number"
                                min={0}
                                max={100}
                                className={FIELD_CLS}
                                value={show(draft.warm_min)}
                                disabled={ro}
                                onChange={(e) => set({ warm_min: toNumber(e.target.value) })}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Below the Warm threshold a lead is Cold.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {TEMPERATURE_FACTORS.map((f) => (
                            <div key={f.key}>
                                <label htmlFor={`temp-weight-${f.key}`} className={LABEL_CLS}>{f.label} weight</label>
                                <input
                                    id={`temp-weight-${f.key}`}
                                    type="number"
                                    min={0}
                                    max={100}
                                    className={FIELD_CLS}
                                    value={show(draft.weights[f.key])}
                                    disabled={ro}
                                    onChange={(e) => { setError(null); setWeight(f.key, toNumber(e.target.value)); }}
                                />
                                <p className="text-[11px] text-slate-500 mt-1">{f.hint}</p>
                            </div>
                        ))}
                    </div>

                    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

                    {canWrite && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => void save()}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {saving
                                    ? (Loader2 ? <Loader2 className="animate-spin" size={14} /> : null)
                                    : (Save ? <Save size={14} /> : null)}
                                Save temperature
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default LeadTemperatureSettingsCard;
