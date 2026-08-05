import React, { useEffect, useRef, useState } from 'react';
import { Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { crmService } from '../../../services/crmService';
import { DealNamingConfig, DealNamingResetMode, DEFAULT_DEAL_NAMING_CONFIG } from '../../../types/crm';
import { DEAL_NAME_TOKENS } from '../../../utils/dealNamingTokens';

interface DealNamingSettingsTabProps {
    initialConfig: DealNamingConfig | null;
    canWrite: boolean;
    showSuccess: (msg: string) => void;
    showError: (msg: string) => void;
}

const RESET_MODES: { value: DealNamingResetMode; label: string }[] = [
    { value: 'none', label: 'No Sequence' },
    { value: 'daily', label: 'Daily Reset' },
    { value: 'monthly', label: 'Monthly Reset' },
    { value: 'yearly', label: 'Yearly Reset' },
    { value: 'continuous', label: 'Continuous' },
];

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all font-bold text-sm';

const DealNamingSettingsTab: React.FC<DealNamingSettingsTabProps> = ({ initialConfig, canWrite, showSuccess, showError }) => {
    const [config, setConfig] = useState<DealNamingConfig>(initialConfig ?? DEFAULT_DEAL_NAMING_CONFIG);
    const [isSaving, setIsSaving] = useState(false);
    const [preview, setPreview] = useState<string>('');
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const templateInputRef = useRef<HTMLInputElement>(null);
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (initialConfig) setConfig(initialConfig);
    }, [initialConfig]);

    // Debounced live preview — calls the backend so it always matches actual
    // generation logic exactly (reset-mode bucket math, padding, etc.), rather
    // than duplicating template rendering in JS.
    useEffect(() => {
        if (!config.enabled) {
            setPreview('');
            return;
        }
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(async () => {
            setIsPreviewLoading(true);
            try {
                const result = await crmService.previewDealNamingSettings(config);
                setPreview(result.name);
            } catch {
                setPreview('');
            } finally {
                setIsPreviewLoading(false);
            }
        }, 400);
        return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.enabled, config.template, config.prefix, config.suffix, config.separator, config.sequence?.enabled, config.sequence?.reset_mode, config.sequence?.padding]);

    const insertToken = (token: string) => {
        const input = templateInputRef.current;
        if (!input) {
            setConfig(prev => ({ ...prev, template: `${prev.template}${token}` }));
            return;
        }
        const start = input.selectionStart ?? config.template.length;
        const end = input.selectionEnd ?? config.template.length;
        const next = `${config.template.slice(0, start)}${token}${config.template.slice(end)}`;
        setConfig(prev => ({ ...prev, template: next }));
        requestAnimationFrame(() => {
            input.focus();
            const cursor = start + token.length;
            input.setSelectionRange(cursor, cursor);
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const saved = await crmService.updateDealNamingSettings(config);
            setConfig(saved);
            showSuccess('Deal naming convention saved');
        } catch {
            showError('Failed to save deal naming convention');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                <div>
                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Deal Naming Convention</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">CONTROL HOW NEW DEAL NAMES ARE GENERATED FROM LEADS</p>
                </div>
                <button
                    onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    disabled={!canWrite}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300 disabled:opacity-50"
                >
                    {config.enabled ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-slate-600" />}
                    Auto-Generate Deal Names
                </button>
            </div>

            <div className={`p-6 space-y-6 ${!config.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {!config.enabled && (
                    <p className="text-xs text-slate-500 font-bold -mt-2">
                        Auto-generation is off — deals use manual entry only, same as before.
                    </p>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Prefix</label>
                        <input className={FIELD_CLS} value={config.prefix} onChange={e => setConfig(prev => ({ ...prev, prefix: e.target.value }))} placeholder="DEAL" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Suffix</label>
                        <input className={FIELD_CLS} value={config.suffix} onChange={e => setConfig(prev => ({ ...prev, suffix: e.target.value }))} placeholder="2026" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Separator</label>
                        <select className={FIELD_CLS} value={config.separator} onChange={e => setConfig(prev => ({ ...prev, separator: e.target.value }))}>
                            <option value=" - ">-</option>
                            <option value="_">_</option>
                            <option value="/">/</option>
                            <option value=" ">Space</option>
                            <option value="">None</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Naming Template</label>
                    <input
                        ref={templateInputRef}
                        className={FIELD_CLS}
                        value={config.template}
                        onChange={e => setConfig(prev => ({ ...prev, template: e.target.value }))}
                        placeholder="{lead_name} - {YYYYMMDD}"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {DEAL_NAME_TOKENS.map(t => (
                            <button
                                key={t.token}
                                type="button"
                                onClick={() => insertToken(t.token)}
                                className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                                title={t.sample}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Running Number</h4>
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Reset Mode</label>
                            <select
                                className={FIELD_CLS}
                                value={config.sequence.reset_mode}
                                onChange={e => setConfig(prev => ({
                                    ...prev,
                                    sequence: { ...prev.sequence, enabled: e.target.value !== 'none', reset_mode: e.target.value as DealNamingResetMode },
                                }))}
                            >
                                {RESET_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Padding</label>
                            <input
                                type="number"
                                min={1}
                                max={8}
                                className={FIELD_CLS}
                                value={config.sequence.padding}
                                onChange={e => setConfig(prev => ({ ...prev, sequence: { ...prev.sequence, padding: parseInt(e.target.value) || 1 } }))}
                            />
                        </div>
                        <button
                            onClick={() => insertToken('{seq}')}
                            className="text-[10px] font-black uppercase tracking-wide px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                            Insert {'{seq}'} Token
                        </button>
                    </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Preview</h4>
                    <div className="text-sm font-black text-emerald-400 flex items-center gap-2">
                        {isPreviewLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        {preview || <span className="text-slate-600 italic">Enter a template to preview</span>}
                    </div>
                </div>

                {canWrite && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                )}
            </div>
        </section>
    );
};

export default DealNamingSettingsTab;
