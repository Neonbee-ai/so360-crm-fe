import React, { useEffect, useRef, useState } from 'react';
import { ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { crmService } from '../../../services/crmService';
import { DealNamingConfig, DealNamingResetMode, DEFAULT_DEAL_NAMING_CONFIG } from '../../../types/crm';
import { Card } from '@so360/design-system';
import { DEAL_NAME_TOKENS } from '../../../utils/dealNamingTokens';

interface DealNamingSettingsTabProps {
    initialConfig: DealNamingConfig | null;
    canWrite: boolean;
    /**
     * Lifts local edits up to the parent's `settings.deal_naming` in real time,
     * so the page-level "Save Configuration" button persists them like every
     * other tab — this tab no longer has its own Save button/API call (task
     * c23baf51: the two previously saved independently, and the top button
     * silently discarded Deal Naming edits because it never saw them).
     */
    onChange: (config: DealNamingConfig) => void;
}

const RESET_MODES: { value: DealNamingResetMode; label: string }[] = [
    { value: 'none', label: 'No Sequence' },
    { value: 'daily', label: 'Daily Reset' },
    { value: 'monthly', label: 'Monthly Reset' },
    { value: 'yearly', label: 'Yearly Reset' },
    { value: 'continuous', label: 'Continuous' },
];

const FIELD_CLS = 'w-full bg-bg border border-line text-fg rounded-nb px-4 py-2.5 outline-none focus:border-primary transition-all font-bold text-sm';

const DealNamingSettingsTab: React.FC<DealNamingSettingsTabProps> = ({ initialConfig, canWrite, onChange }) => {
    const [config, setConfig] = useState<DealNamingConfig>(initialConfig ?? DEFAULT_DEAL_NAMING_CONFIG);
    const [preview, setPreview] = useState<string>('');
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const templateInputRef = useRef<HTMLInputElement>(null);
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Guards against re-seeding `config` from a stale `initialConfig` prop right
    // after this tab's own edit already pushed a newer value up to the parent
    // (parent re-render → new initialConfig reference → would otherwise clobber
    // the in-progress edit the user just made).
    const isLocalEdit = useRef(false);

    useEffect(() => {
        if (isLocalEdit.current) {
            isLocalEdit.current = false;
            return;
        }
        if (initialConfig) setConfig(initialConfig);
    }, [initialConfig]);

    useEffect(() => {
        isLocalEdit.current = true;
        onChange(config);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

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

    return (
        <Card
            title="Deal naming convention"
            actions={
                <button
                    onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    disabled={!canWrite}
                    className="flex items-center gap-2 text-xs font-semibold text-fg-subtle disabled:opacity-50"
                >
                    {config.enabled ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} className="text-fg-muted" />}
                    Auto-Generate Deal Names
                </button>
            }
        >
            <p className="text-xs text-fg-muted mb-nb-4">Control how new deal names are generated from leads</p>
            <div className={`space-y-6 ${!config.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {!config.enabled && (
                    <p className="text-xs text-fg-muted font-bold -mt-2">
                        Auto-generation is off — deals use manual entry only, same as before.
                    </p>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-fg-muted mb-2 block">Prefix</label>
                        <input className={FIELD_CLS} value={config.prefix} onChange={e => setConfig(prev => ({ ...prev, prefix: e.target.value }))} placeholder="DEAL" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-fg-muted mb-2 block">Suffix</label>
                        <input className={FIELD_CLS} value={config.suffix} onChange={e => setConfig(prev => ({ ...prev, suffix: e.target.value }))} placeholder="2026" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-fg-muted mb-2 block">Separator</label>
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
                    <label className="text-xs font-semibold text-fg-muted mb-2 block">Naming Template</label>
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
                                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-raised hover:bg-line text-fg-subtle transition-all"
                                title={t.sample}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-line pt-nb-4">
                    <h4 className="text-xs font-semibold text-fg-muted mb-3">Running Number</h4>
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="text-xs font-semibold text-fg-muted mb-2 block">Reset Mode</label>
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
                            <label className="text-xs font-semibold text-fg-muted mb-2 block">Padding</label>
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
                            className="text-xs font-semibold px-3 py-2.5 rounded-nb bg-surface-raised hover:bg-line text-fg-subtle"
                        >
                            Insert {'{seq}'} Token
                        </button>
                    </div>
                </div>

                <div className="border-t border-line pt-nb-4">
                    <h4 className="text-xs font-semibold text-fg-muted mb-2">Preview</h4>
                    <div className="text-sm font-semibold text-success flex items-center gap-2">
                        {isPreviewLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        {preview || <span className="text-fg-muted italic">Enter a template to preview</span>}
                    </div>
                </div>

                {canWrite && (
                    <p className="text-xs text-fg-muted font-bold">
                        Changes here are saved with the "Save Configuration" button at the top of the page, same as every other Settings tab.
                    </p>
                )}
            </div>
        </Card>
    );
};

export default DealNamingSettingsTab;
