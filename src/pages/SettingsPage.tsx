import React, { useState, useEffect, useRef } from 'react';
import { crmService, settingsApi } from '../services/crmService';
import { CRMSettings, SourceTypeOption, LeadScoringRule, ScoreCategory } from '../types/crm';
import { Save, AlertCircle, Edit2, Archive, Plus, Trash2, Loader2, Zap, Trophy, ShieldCheck, ToggleLeft, ToggleRight, X, Check, RefreshCw } from 'lucide-react';
import { toast } from '@so360/design-system';
import { StageStatusSelect } from '../components/common/StageStatusSelect';
import { useShellBridge } from '@so360/shell-context';
import DealNamingSettingsTab from './components/settings/DealNamingSettingsTab';

type SettingsTab = 'pipeline' | 'lead-stages' | 'custom-fields' | 'sources' | 'scoring' | 'deal-naming';

// Activity types available for scoring rules
const SCOREABLE_ACTIVITY_TYPES = [
    { value: 'CALL',    label: 'Call' },
    { value: 'MEETING', label: 'Meeting' },
    { value: 'EMAIL',   label: 'Email' },
    { value: 'TASK',    label: 'Task' },
];

// Standard lead fields available for field rules
const STANDARD_LEAD_FIELDS = [
    { value: 'company_name', label: 'Company Name', fieldType: 'text' },
    { value: 'email',        label: 'Email',         fieldType: 'text' },
    { value: 'phone',        label: 'Phone',         fieldType: 'text' },
    { value: 'first_name',   label: 'First Name',    fieldType: 'text' },
    { value: 'last_name',    label: 'Last Name',     fieldType: 'text' },
    { value: 'source',       label: 'Source',        fieldType: 'text' },
];

// Conditions available per field type
function getConditions(ruleType: string, fieldType?: string) {
    if (ruleType === 'source') {
        return [
            { value: 'equals',      label: 'Equals' },
            { value: 'not_equals',  label: 'Not Equals' },
            { value: 'contains',    label: 'Contains' },
            { value: 'not_contains',label: 'Does Not Contain' },
        ];
    }
    if (ruleType === 'activity') {
        return [
            { value: 'is_not_empty', label: 'Has Occurred' },
            { value: 'is_empty',     label: 'Has Not Occurred' },
        ];
    }
    if (fieldType === 'number' || fieldType === 'NUMBER') {
        return [
            { value: 'equals',       label: 'Equals' },
            { value: 'not_equals',   label: 'Not Equals' },
            { value: 'greater_than', label: 'Greater Than' },
            { value: 'less_than',    label: 'Less Than' },
        ];
    }
    if (fieldType === 'SELECT' || fieldType === 'select') {
        return [
            { value: 'equals',     label: 'Equals' },
            { value: 'not_equals', label: 'Not Equals' },
        ];
    }
    // Default: text
    return [
        { value: 'equals',       label: 'Equals' },
        { value: 'not_equals',   label: 'Not Equals' },
        { value: 'contains',     label: 'Contains' },
        { value: 'not_contains', label: 'Does Not Contain' },
        { value: 'is_empty',     label: 'Is Empty' },
        { value: 'is_not_empty', label: 'Is Not Empty' },
    ];
}

const BLANK_RULE: Partial<LeadScoringRule> = {
    name: '',
    rule_type: 'source',
    target_field: '',
    condition: 'equals',
    value: '',
    score_points: 10,
    is_active: true,
    priority: 0,
};

const SettingsPage = () => {
    const shell = useShellBridge();
    const canWriteSettings = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('submodule:crm:settings') ?? true);
    const [settings, setSettings] = useState<CRMSettings | null>(null);
    const [activeTab, setActiveTab] = useState<SettingsTab>('pipeline');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    // Value each stage-name field held when it gained focus, so Escape can revert it.
    const stageNameOnFocus = useRef<Record<number, string>>({});

    const [sourceTypes, setSourceTypes] = useState<SourceTypeOption[]>([]);
    const [newSourceLabel, setNewSourceLabel] = useState('');
    const [isAddingSource, setIsAddingSource] = useState(false);

    // ── Scoring state ──────────────────────────────────────────────────────────
    const [scoringRules, setScoringRules] = useState<LeadScoringRule[]>([]);
    const [scoreCategories, setScoreCategories] = useState<ScoreCategory[]>([]);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [isAddingRule, setIsAddingRule] = useState(false);
    const [draftRule, setDraftRule] = useState<Partial<LeadScoringRule>>(BLANK_RULE);
    const [isSavingRule, setIsSavingRule] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await crmService.getSettings();
                setSettings(data);
                setSourceTypes(data.source_type_options ?? []);
                setScoringRules(data.lead_scoring ?? []);
                setScoreCategories(data.score_categories ?? []);
            } catch (error) {
                console.error('Failed to fetch settings', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const handleAddSourceType = async () => {
        const label = newSourceLabel.trim();
        if (!label) return;
        const value = slugify(label);
        setIsAddingSource(true);
        try {
            const created = await settingsApi.sourceTypes.create({ label, value });
            setSourceTypes(prev => [...prev, created]);
            setNewSourceLabel('');
            toast.success('Source type added');
        } catch {
            toast.error('Failed to add source type');
        } finally {
            setIsAddingSource(false);
        }
    };

    const handleToggleSourceActive = async (option: SourceTypeOption) => {
        try {
            const updated = await settingsApi.sourceTypes.update(option.id, { is_active: !option.is_active });
            setSourceTypes(prev => prev.map(o => o.id === option.id ? updated : o));
        } catch {
            toast.error('Failed to update source type');
        }
    };

    const handleDeleteSourceType = async (id: string) => {
        try {
            await settingsApi.sourceTypes.delete(id);
            setSourceTypes(prev => prev.filter(o => o.id !== id));
            toast.success('Source type deleted');
        } catch {
            toast.error('Cannot delete system source type');
        }
    };

    // ── Scoring rule handlers ──────────────────────────────────────────────────

    const getFieldType = (ruleType: string, targetField: string): string => {
        if (ruleType !== 'field') return 'text';
        const std = STANDARD_LEAD_FIELDS.find(f => f.value === targetField);
        if (std) return std.fieldType;
        const custom = settings?.lead_custom_fields?.find(f => f.id === targetField);
        return custom?.type || custom?.field_type || 'text';
    };

    const handleStartAddRule = () => {
        setDraftRule({ ...BLANK_RULE, priority: scoringRules.length });
        setIsAddingRule(true);
        setEditingRuleId(null);
    };

    const handleStartEditRule = (rule: LeadScoringRule) => {
        setDraftRule({ ...rule });
        setEditingRuleId(rule.id);
        setIsAddingRule(false);
    };

    const handleCancelRuleEdit = () => {
        setEditingRuleId(null);
        setIsAddingRule(false);
        setDraftRule(BLANK_RULE);
    };

    const handleSaveNewRule = async () => {
        if (!draftRule.name?.trim() || !draftRule.target_field) {
            toast.error('Rule name and target field are required');
            return;
        }
        setIsSavingRule(true);
        try {
            const created = await settingsApi.scoringRules.create(draftRule as Omit<LeadScoringRule, 'id'>);
            setScoringRules(prev => [...prev, created]);
            setIsAddingRule(false);
            setDraftRule(BLANK_RULE);
            toast.success('Scoring rule created');
        } catch {
            toast.error('Failed to create scoring rule');
        } finally {
            setIsSavingRule(false);
        }
    };

    const handleSaveRuleEdit = async () => {
        if (!editingRuleId || !draftRule.name?.trim() || !draftRule.target_field) {
            toast.error('Rule name and target field are required');
            return;
        }
        setIsSavingRule(true);
        try {
            const updated = await settingsApi.scoringRules.update(editingRuleId, draftRule);
            setScoringRules(prev => prev.map(r => r.id === editingRuleId ? updated : r));
            setEditingRuleId(null);
            setDraftRule(BLANK_RULE);
            toast.success('Scoring rule updated');
        } catch {
            toast.error('Failed to update scoring rule');
        } finally {
            setIsSavingRule(false);
        }
    };

    const handleToggleRuleActive = async (rule: LeadScoringRule) => {
        try {
            const updated = await settingsApi.scoringRules.update(rule.id, { is_active: !rule.is_active });
            setScoringRules(prev => prev.map(r => r.id === rule.id ? updated : r));
        } catch {
            toast.error('Failed to update rule');
        }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            await settingsApi.scoringRules.delete(id);
            setScoringRules(prev => prev.filter(r => r.id !== id));
            if (editingRuleId === id) handleCancelRuleEdit();
            toast.success('Scoring rule deleted');
        } catch {
            toast.error('Failed to delete scoring rule');
        }
    };

    const handleRecalculateScores = async () => {
        setIsRecalculating(true);
        try {
            const result = await settingsApi.scoringRules.recalculate();
            const count = result?.recalculated ?? 0;
            if (count === 0) {
                toast.success('Scores recalculated — no active leads found or no active rules.');
            } else {
                toast.success(`Lead scores recalculated successfully. ${count} lead(s) updated.`);
            }
        } catch {
            toast.error('Failed to recalculate lead scores');
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleUpdateCategory = async (cat: ScoreCategory, data: Partial<ScoreCategory>) => {
        try {
            const updated = await settingsApi.scoreCategories.update(cat.id, data);
            setScoreCategories(prev => prev.map(c => c.id === cat.id ? updated : c));
        } catch {
            toast.error('Failed to update score band');
        }
    };

    const getRuleConditionLabel = (rule: LeadScoringRule): string => {
        const ft = getFieldType(rule.rule_type, rule.target_field);
        const conditions = getConditions(rule.rule_type, ft);
        const cond = conditions.find(c => c.value === rule.condition)?.label || rule.condition;
        const noValue = ['is_empty', 'is_not_empty'].includes(rule.condition);
        if (noValue) return cond;
        if (rule.rule_type === 'source') {
            // Source rules match against the selected Source option (target_field)
            const sourceLabel = sourceTypes.find(s => s.value === rule.target_field)?.label || rule.target_field || rule.value;
            return `${cond} "${sourceLabel}"`;
        }
        return `${cond} "${rule.value}"`;
    };

    const getTargetLabel = (rule: LeadScoringRule): string => {
        if (rule.rule_type === 'source') {
            return sourceTypes.find(s => s.value === rule.target_field)?.label || rule.target_field;
        }
        if (rule.rule_type === 'activity') {
            return SCOREABLE_ACTIVITY_TYPES.find(a => a.value === rule.target_field)?.label || rule.target_field;
        }
        const std = STANDARD_LEAD_FIELDS.find(f => f.value === rule.target_field);
        if (std) return std.label;
        return settings?.lead_custom_fields?.find(f => f.id === rule.target_field)?.label || rule.target_field;
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await crmService.updateSettings(settings);
            toast.success('Configuration saved!');
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error(error instanceof Error ? error.message : 'Error saving settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const addStage = () => {
        if (!settings) return;
        const newStage = {
            id: `st-${Date.now()}`,
            name: 'New Stage',
            type: 'OPEN' as const
        };
        setSettings({
            ...settings,
            deal_stages: [...settings.deal_stages, newStage]
        });
    };

    const removeStage = (id: string) => {
        if (!settings) return;
        if (settings.deal_stages.length <= 1) {
            toast.error('Pipeline must have at least one stage.');
            return;
        }
        setSettings({
            ...settings,
            deal_stages: settings.deal_stages.filter(s => s.id !== id)
        });
    };

    const updateStageName = (idx: number, name: string) => {
        if (!settings) return;
        // `deal_stages[idx]` was mutated in place, so the pre-edit value was gone
        // by the time Escape could restore it. Replace the object instead.
        const newStages = settings.deal_stages.map((s, i) => (i === idx ? { ...s, name } : s));
        setSettings({ ...settings, deal_stages: newStages });
    };

    /**
     * Inline-edit keyboard contract for a pipeline stage name:
     *   Enter  → commit (persist) and leave edit mode
     *   Escape → revert to the value the field held on focus, and leave edit mode
     * Blur still commits, so the previous click-outside behaviour is preserved
     * rather than replaced.
     */
    const handleStageNameKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        idx: number,
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Drop the focus snapshot first so the blur handler below treats this
            // as already-committed and doesn't fire a second save.
            delete stageNameOnFocus.current[idx];
            e.currentTarget.blur();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const original = stageNameOnFocus.current[idx];
            if (original !== undefined) updateStageName(idx, original);
            // Drop the snapshot so the blur that follows doesn't save the revert.
            delete stageNameOnFocus.current[idx];
            e.currentTarget.blur();
        }
    };

    /** Commit on click-outside, but only when the name actually changed. */
    const handleStageNameBlur = (idx: number) => {
        const original = stageNameOnFocus.current[idx];
        const current = settings?.deal_stages[idx]?.name;
        delete stageNameOnFocus.current[idx];
        if (original === undefined || original === current) return;
        handleSave();
    };

    const addSource = () => {
        if (!settings) return;
        const newSource = {
            id: `src-${Date.now()}`,
            name: 'New Source',
            archived: false
        };
        setSettings({
            ...settings,
            lead_sources: [...settings.lead_sources, newSource]
        });
    };

    const toggleArchiveSource = (id: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            lead_sources: settings.lead_sources.map(s =>
                s.id === id ? { ...s, archived: !s.archived } : s
            )
        });
    };

    const updateSourceName = (idx: number, name: string) => {
        if (!settings) return;
        const newSources = [...settings.lead_sources];
        newSources[idx].name = name;
        setSettings({ ...settings, lead_sources: newSources });
    };

    if (isLoading || !settings) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading settings...</span>
            </div>
        );
    }

    return (
        <div className="p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-slate-50 tracking-tight">CRM Settings</h1>
                    <p className="text-slate-400 mt-1 font-medium">Configure your workspace and custom data points</p>
                </div>
                {canWriteSettings && <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black transition-all shadow-xl shadow-blue-900/30 disabled:opacity-50 active:scale-95"
                >
                    <Save size={20} />
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>}
            </header>

            <div className="flex gap-1 mb-8 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('pipeline')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pipeline' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Pipeline
                </button>
                <button
                    onClick={() => setActiveTab('lead-stages')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'lead-stages' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Lead Stages
                </button>
                <button
                    onClick={() => setActiveTab('custom-fields')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'custom-fields' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Custom Fields
                </button>
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'sources' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Lead Sources
                </button>
                <button
                    onClick={() => setActiveTab('scoring')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'scoring' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Lead Scoring
                </button>
                <button
                    onClick={() => setActiveTab('deal-naming')}
                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'deal-naming' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Deal Naming
                </button>
            </div>

            <div className="space-y-10">
                {activeTab === 'pipeline' && (
                    <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Deal Pipeline Stages</h3>
                                <p className="text-[10px] text-slate-500 font-bold mt-1">THE ORDER DEFINES YOUR SALES FUNNEL</p>
                            </div>
                            <button
                                onClick={addStage}
                                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
                            >
                                <Plus size={12} /> ADD STAGE
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {settings.deal_stages.map((stage, idx) => (
                                    <div key={stage.id} className="flex items-center gap-4 bg-slate-950/50 border border-slate-700/40 p-3 rounded-xl group hover:border-slate-600/60 transition-all shadow-sm">
                                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-500">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={stage.name}
                                                onChange={(e) => updateStageName(idx, e.target.value)}
                                                onFocus={() => { stageNameOnFocus.current[idx] = stage.name; }}
                                                onKeyDown={(e) => handleStageNameKeyDown(e, idx)}
                                                onBlur={() => handleStageNameBlur(idx)}
                                                placeholder="Stage Name"
                                                className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-50 outline-none focus:ring-0 focus:outline-none focus:text-blue-300 placeholder:text-slate-500"
                                            />
                                        </div>
                                        <StageStatusSelect
                                            value={stage.type || 'OPEN'}
                                            onChange={(newType) => {
                                                const newStages = [...settings.deal_stages];
                                                newStages[idx].type = newType;
                                                setSettings({ ...settings, deal_stages: newStages });
                                            }}
                                        />
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => removeStage(stage.id)}
                                                className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-all"
                                                title="Remove Stage"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'lead-stages' && (
                    <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-700/50 bg-slate-900/50">
                            <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Lead Lifecycle Stages</h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">MANAGED IN THE FLOW MODULE — EDIT THE CRM LEAD WORKFLOW TO CHANGE THESE STAGES</p>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {settings.lead_stages.map((stage, idx) => (
                                    <div key={stage.id} className="flex items-center gap-4 bg-slate-950/50 border border-slate-700/40 p-3 rounded-xl shadow-sm">
                                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-500">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-slate-50">{stage.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'custom-fields' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Lead Custom Fields */}
                        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl h-fit">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Lead Fields</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        const newField = { id: `lcf-${Date.now()}`, label: 'New Field', type: 'text' as const, required: false };
                                        setSettings({ ...settings, lead_custom_fields: [...settings.lead_custom_fields, newField] });
                                    }}
                                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all active:scale-95"
                                >
                                    <Plus size={12} /> ADD
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {settings.lead_custom_fields.map((field, idx) => (
                                        <div key={field.id} className="bg-slate-950/50 border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const newFields = [...settings.lead_custom_fields];
                                                            newFields[idx] = { ...newFields[idx], label: e.target.value };
                                                            setSettings({ ...settings, lead_custom_fields: newFields });
                                                        }}
                                                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-50 outline-none focus:ring-0 focus:outline-none focus:text-blue-300"
                                                    />
                                                </div>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => {
                                                        const newFields = [...settings.lead_custom_fields];
                                                        newFields[idx] = { ...newFields[idx], type: e.target.value as any, options: e.target.value === 'SELECT' ? (newFields[idx].options || []) : newFields[idx].options };
                                                        setSettings({ ...settings, lead_custom_fields: newFields });
                                                    }}
                                                    className="bg-slate-900 border border-slate-700 text-[10px] font-black uppercase text-slate-300 rounded-lg px-2 py-1 outline-none"
                                                >
                                                    <option value="text">TEXT</option>
                                                    <option value="number">NUM</option>
                                                    <option value="date">DATE</option>
                                                    <option value="boolean">BOOL</option>
                                                    <option value="SELECT">SELECT</option>
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        setSettings({
                                                            ...settings,
                                                            lead_custom_fields: settings.lead_custom_fields.filter(f => f.id !== field.id)
                                                        });
                                                    }}
                                                    className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {field.type === 'SELECT' && (
                                                <div className="px-3 pb-3 border-t border-slate-800/60 pt-2">
                                                    <div className="space-y-1.5">
                                                        {((field as any).options || []).map((opt: string, optIdx: number) => (
                                                            <div key={optIdx} className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={opt}
                                                                    onChange={(e) => {
                                                                        const newFields = [...settings.lead_custom_fields];
                                                                        const newOpts = [...((newFields[idx] as any).options || [])];
                                                                        newOpts[optIdx] = e.target.value;
                                                                        newFields[idx] = { ...newFields[idx], options: newOpts } as any;
                                                                        setSettings({ ...settings, lead_custom_fields: newFields });
                                                                    }}
                                                                    className="flex-1 bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg outline-none focus:border-blue-500"
                                                                    placeholder={`Option ${optIdx + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newFields = [...settings.lead_custom_fields];
                                                                        newFields[idx] = { ...newFields[idx], options: ((newFields[idx] as any).options || []).filter((_: any, i: number) => i !== optIdx) } as any;
                                                                        setSettings({ ...settings, lead_custom_fields: newFields });
                                                                    }}
                                                                    className="p-1 hover:bg-rose-500/10 rounded text-slate-600 hover:text-rose-400 transition-all"
                                                                ><X size={12} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newFields = [...settings.lead_custom_fields];
                                                            newFields[idx] = { ...newFields[idx], options: [...((newFields[idx] as any).options || []), ''] } as any;
                                                            setSettings({ ...settings, lead_custom_fields: newFields });
                                                        }}
                                                        className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-black flex items-center gap-1 transition-colors"
                                                    ><Plus size={10} /> Add Option</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Deal Custom Fields */}
                        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl h-fit">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Deal Fields</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        const newField = { id: `dcf-${Date.now()}`, label: 'New Field', type: 'text' as const, required: false };
                                        setSettings({ ...settings, deal_custom_fields: [...settings.deal_custom_fields, newField] });
                                    }}
                                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all active:scale-95"
                                >
                                    <Plus size={12} /> ADD
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {settings.deal_custom_fields.map((field, idx) => (
                                        <div key={field.id} className="bg-slate-950/50 border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const newFields = [...settings.deal_custom_fields];
                                                            newFields[idx] = { ...newFields[idx], label: e.target.value };
                                                            setSettings({ ...settings, deal_custom_fields: newFields });
                                                        }}
                                                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-50 outline-none focus:ring-0 focus:outline-none focus:text-blue-300"
                                                    />
                                                </div>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => {
                                                        const newFields = [...settings.deal_custom_fields];
                                                        newFields[idx] = { ...newFields[idx], type: e.target.value as any, options: e.target.value === 'SELECT' ? ((newFields[idx] as any).options || []) : (newFields[idx] as any).options };
                                                        setSettings({ ...settings, deal_custom_fields: newFields });
                                                    }}
                                                    className="bg-slate-900 border border-slate-700 text-[10px] font-black uppercase text-slate-300 rounded-lg px-2 py-1 outline-none"
                                                >
                                                    <option value="text">TEXT</option>
                                                    <option value="number">NUM</option>
                                                    <option value="date">DATE</option>
                                                    <option value="boolean">BOOL</option>
                                                    <option value="SELECT">SELECT</option>
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        setSettings({
                                                            ...settings,
                                                            deal_custom_fields: settings.deal_custom_fields.filter(f => f.id !== field.id)
                                                        });
                                                    }}
                                                    className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {field.type === 'SELECT' && (
                                                <div className="px-3 pb-3 border-t border-slate-800/60 pt-2">
                                                    <div className="space-y-1.5">
                                                        {((field as any).options || []).map((opt: string, optIdx: number) => (
                                                            <div key={optIdx} className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={opt}
                                                                    onChange={(e) => {
                                                                        const newFields = [...settings.deal_custom_fields];
                                                                        const newOpts = [...((newFields[idx] as any).options || [])];
                                                                        newOpts[optIdx] = e.target.value;
                                                                        newFields[idx] = { ...newFields[idx], options: newOpts } as any;
                                                                        setSettings({ ...settings, deal_custom_fields: newFields });
                                                                    }}
                                                                    className="flex-1 bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg outline-none focus:border-blue-500"
                                                                    placeholder={`Option ${optIdx + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newFields = [...settings.deal_custom_fields];
                                                                        newFields[idx] = { ...newFields[idx], options: ((newFields[idx] as any).options || []).filter((_: any, i: number) => i !== optIdx) } as any;
                                                                        setSettings({ ...settings, deal_custom_fields: newFields });
                                                                    }}
                                                                    className="p-1 hover:bg-rose-500/10 rounded text-slate-600 hover:text-rose-400 transition-all"
                                                                ><X size={12} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newFields = [...settings.deal_custom_fields];
                                                            newFields[idx] = { ...newFields[idx], options: [...((newFields[idx] as any).options || []), ''] } as any;
                                                            setSettings({ ...settings, deal_custom_fields: newFields });
                                                        }}
                                                        className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-black flex items-center gap-1 transition-colors"
                                                    ><Plus size={10} /> Add Option</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Partner Custom Fields */}
                        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl h-fit">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Partner Fields</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        const newField = { id: `pcf-${Date.now()}`, label: 'New Field', type: 'text' as const, required: false };
                                        setSettings({ ...settings, partner_custom_fields: [...(settings.partner_custom_fields || []), newField] });
                                    }}
                                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all active:scale-95"
                                >
                                    <Plus size={12} /> ADD
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {(settings.partner_custom_fields || []).map((field, idx) => (
                                        <div key={field.id} className="bg-slate-950/50 border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const newFields = [...(settings.partner_custom_fields || [])];
                                                            newFields[idx] = { ...newFields[idx], label: e.target.value };
                                                            setSettings({ ...settings, partner_custom_fields: newFields });
                                                        }}
                                                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-50 outline-none focus:ring-0 focus:outline-none focus:text-blue-300"
                                                    />
                                                </div>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => {
                                                        const newFields = [...(settings.partner_custom_fields || [])];
                                                        newFields[idx] = { ...newFields[idx], type: e.target.value as any, options: e.target.value === 'SELECT' ? (newFields[idx].options || []) : newFields[idx].options };
                                                        setSettings({ ...settings, partner_custom_fields: newFields });
                                                    }}
                                                    className="bg-slate-900 border border-slate-700 text-[10px] font-black uppercase text-slate-300 rounded-lg px-2 py-1 outline-none"
                                                >
                                                    <option value="text">TEXT</option>
                                                    <option value="number">NUM</option>
                                                    <option value="date">DATE</option>
                                                    <option value="boolean">BOOL</option>
                                                    <option value="SELECT">SELECT</option>
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        setSettings({
                                                            ...settings,
                                                            partner_custom_fields: (settings.partner_custom_fields || []).filter(f => f.id !== field.id)
                                                        });
                                                    }}
                                                    className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {field.type === 'SELECT' && (
                                                <div className="px-3 pb-3 border-t border-slate-800/60 pt-2">
                                                    <div className="space-y-1.5">
                                                        {(field.options || []).map((opt: string, optIdx: number) => (
                                                            <div key={optIdx} className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={opt}
                                                                    onChange={(e) => {
                                                                        const newFields = [...(settings.partner_custom_fields || [])];
                                                                        const newOpts = [...(newFields[idx].options || [])];
                                                                        newOpts[optIdx] = e.target.value;
                                                                        newFields[idx] = { ...newFields[idx], options: newOpts };
                                                                        setSettings({ ...settings, partner_custom_fields: newFields });
                                                                    }}
                                                                    className="flex-1 bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg outline-none focus:border-blue-500"
                                                                    placeholder={`Option ${optIdx + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newFields = [...(settings.partner_custom_fields || [])];
                                                                        newFields[idx] = { ...newFields[idx], options: (newFields[idx].options || []).filter((_: any, i: number) => i !== optIdx) };
                                                                        setSettings({ ...settings, partner_custom_fields: newFields });
                                                                    }}
                                                                    className="p-1 hover:bg-rose-500/10 rounded text-slate-600 hover:text-rose-400 transition-all"
                                                                ><X size={12} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newFields = [...(settings.partner_custom_fields || [])];
                                                            newFields[idx] = { ...newFields[idx], options: [...(newFields[idx].options || []), ''] };
                                                            setSettings({ ...settings, partner_custom_fields: newFields });
                                                        }}
                                                        className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-black flex items-center gap-1 transition-colors"
                                                    ><Plus size={10} /> Add Option</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(settings.partner_custom_fields || []).length === 0 && (
                                        <p className="text-[11px] text-slate-600 font-bold text-center py-4">No partner fields yet. Click ADD to create one.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'sources' && (
                    <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-700/50 bg-slate-900/50">
                            <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Lead Source Types</h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">WHERE DO YOUR LEADS COME FROM? SYSTEM TYPES CANNOT BE DELETED.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                {sourceTypes.map(option => (
                                    <div key={option.id} className={`flex items-center gap-4 border p-3 rounded-xl transition-all ${!option.is_active ? 'opacity-50 border-slate-900 bg-slate-950/20' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`}>
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-slate-50">{option.label}</span>
                                            <span className="ml-2 text-[10px] font-black text-slate-600 uppercase">{option.value}</span>
                                        </div>
                                        {option.is_system && (
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">System</span>
                                        )}
                                        {canWriteSettings && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleSourceActive(option)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-50 hover:bg-slate-700 transition-all"
                                                    title={option.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {option.is_active ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                                                </button>
                                                {!option.is_system && (
                                                    <button
                                                        onClick={() => handleDeleteSourceType(option.id)}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {canWriteSettings && (
                                <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                                    <input
                                        type="text"
                                        value={newSourceLabel}
                                        onChange={(e) => setNewSourceLabel(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSourceType()}
                                        placeholder="New source type label…"
                                        className="flex-1 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-sm text-slate-50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                    <button
                                        onClick={handleAddSourceType}
                                        disabled={isAddingSource || !newSourceLabel.trim()}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-black flex items-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                        <Plus size={12} /> ADD
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                )}
                {activeTab === 'scoring' && (
                    <div className="space-y-6">
                        {/* ── Rules Section ── */}
                        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs flex items-center gap-2">
                                        <Trophy size={14} className="text-amber-400" />
                                        Lead Scoring Rules
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">RULE-BASED AUTO-SCORING ENGINE</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleRecalculateScores}
                                        disabled={isRecalculating}
                                        className="text-[10px] border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isRecalculating
                                            ? <Loader2 size={12} className="animate-spin" />
                                            : <RefreshCw size={12} />
                                        } RECALCULATE SCORES
                                    </button>
                                    {!isAddingRule && (
                                        <button
                                            onClick={handleStartAddRule}
                                            className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg font-black flex items-center gap-1.5 transition-all active:scale-95"
                                        >
                                            <Plus size={12} /> ADD RULE
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 space-y-3">
                                {/* Add-rule form */}
                                {isAddingRule && (
                                    <ScoringRuleForm
                                        draft={draftRule}
                                        onChange={setDraftRule}
                                        onSave={handleSaveNewRule}
                                        onCancel={handleCancelRuleEdit}
                                        isSaving={isSavingRule}
                                        sourceTypes={sourceTypes}
                                        customFields={settings?.lead_custom_fields ?? []}
                                        getFieldType={getFieldType}
                                    />
                                )}

                                {scoringRules.length === 0 && !isAddingRule && (
                                    <p className="text-center text-[11px] text-slate-500 font-bold uppercase tracking-widest py-8">
                                        No scoring rules yet. Click ADD RULE to get started.
                                    </p>
                                )}

                                {scoringRules.map((rule, idx) => (
                                    editingRuleId === rule.id ? (
                                        <ScoringRuleForm
                                            key={rule.id}
                                            draft={draftRule}
                                            onChange={setDraftRule}
                                            onSave={handleSaveRuleEdit}
                                            onCancel={handleCancelRuleEdit}
                                            isSaving={isSavingRule}
                                            sourceTypes={sourceTypes}
                                            customFields={settings?.lead_custom_fields ?? []}
                                            getFieldType={getFieldType}
                                        />
                                    ) : (
                                        <div key={rule.id} className="flex items-center gap-3 bg-slate-950/50 border border-slate-800 p-4 rounded-xl group hover:border-slate-700 transition-all">
                                            {/* Priority */}
                                            <span className="text-[9px] font-black text-slate-600 w-4 text-center">{idx + 1}</span>

                                            {/* Icon */}
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-amber-500 shrink-0">
                                                <Zap size={14} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-bold text-slate-100 truncate">{rule.name}</span>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0 ${rule.rule_type === 'source' ? 'bg-blue-500/20 text-blue-400' : rule.rule_type === 'activity' ? 'bg-purple-500/20 text-purple-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                                        {rule.rule_type === 'source' ? 'Source' : rule.rule_type === 'activity' ? 'Activity' : 'Field'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                                                    {getTargetLabel(rule)} — {getRuleConditionLabel(rule)}
                                                </p>
                                            </div>

                                            {/* Score badge */}
                                            <div className={`text-sm font-black px-2 py-1 rounded-lg shrink-0 ${rule.score_points >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                {rule.score_points >= 0 ? '+' : ''}{rule.score_points}
                                            </div>

                                            {/* Active toggle */}
                                            <button
                                                onClick={() => handleToggleRuleActive(rule)}
                                                className="shrink-0"
                                                title={rule.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {rule.is_active
                                                    ? <ToggleRight size={22} className="text-emerald-500" />
                                                    : <ToggleLeft size={22} className="text-slate-600" />
                                                }
                                            </button>

                                            {/* Edit / Delete */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button
                                                    onClick={() => handleStartEditRule(rule)}
                                                    className="p-1.5 hover:bg-blue-500/10 rounded-lg text-slate-400 hover:text-blue-400 transition-all"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </section>

                        {/* ── Score Bands Section ── */}
                        <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-900/50">
                                <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-400" />
                                    Score Bands
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">DEFINE WHAT EACH SCORE RANGE MEANS</p>
                            </div>
                            <div className="p-6 space-y-2">
                                {scoreCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center gap-4 bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                        <div className="flex-1 flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={cat.label}
                                                onChange={e => setScoreCategories(prev => prev.map(c => c.id === cat.id ? { ...c, label: e.target.value } : c))}
                                                onBlur={e => handleUpdateCategory(cat, { label: e.target.value })}
                                                className="bg-transparent text-sm font-bold text-slate-100 border-none outline-none w-24"
                                            />
                                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-500">
                                                <input
                                                    type="number"
                                                    value={cat.min_score}
                                                    onChange={e => setScoreCategories(prev => prev.map(c => c.id === cat.id ? { ...c, min_score: parseInt(e.target.value) || 0 } : c))}
                                                    onBlur={e => handleUpdateCategory(cat, { min_score: parseInt(e.target.value) || 0 })}
                                                    className="bg-slate-800 text-slate-300 rounded px-1.5 py-0.5 w-14 text-center border-none outline-none text-[10px] font-black"
                                                />
                                                <span>→</span>
                                                {cat.max_score !== null ? (
                                                    <input
                                                        type="number"
                                                        value={cat.max_score ?? ''}
                                                        onChange={e => setScoreCategories(prev => prev.map(c => c.id === cat.id ? { ...c, max_score: parseInt(e.target.value) || 0 } : c))}
                                                        onBlur={e => handleUpdateCategory(cat, { max_score: parseInt(e.target.value) || 0 })}
                                                        className="bg-slate-800 text-slate-300 rounded px-1.5 py-0.5 w-14 text-center border-none outline-none text-[10px] font-black"
                                                    />
                                                ) : (
                                                    <span className="text-slate-500 italic">∞</span>
                                                )}
                                            </div>
                                        </div>
                                        <input
                                            type="color"
                                            value={cat.color}
                                            onChange={e => setScoreCategories(prev => prev.map(c => c.id === cat.id ? { ...c, color: e.target.value } : c))}
                                            onBlur={e => handleUpdateCategory(cat, { color: e.target.value })}
                                            className="w-7 h-7 rounded cursor-pointer bg-transparent border-none"
                                            title="Pick color"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'deal-naming' && (
                    <DealNamingSettingsTab
                        initialConfig={settings?.deal_naming ?? null}
                        canWrite={canWriteSettings}
                        showSuccess={(msg) => toast.success(msg)}
                        showError={(msg) => toast.error(msg)}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Scoring Rule Form (inline) ───────────────────────────────────────────────

interface ScoringRuleFormProps {
    draft: Partial<LeadScoringRule>;
    onChange: (d: Partial<LeadScoringRule>) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
    sourceTypes: SourceTypeOption[];
    customFields: import('../types/crm').CustomFieldDefinition[];
    getFieldType: (ruleType: string, targetField: string) => string;
}

function ScoringRuleForm({
    draft, onChange, onSave, onCancel, isSaving, sourceTypes, customFields, getFieldType,
}: ScoringRuleFormProps) {
    const ruleType = draft.rule_type || 'source';
    const targetField = draft.target_field || '';
    const fieldType = getFieldType(ruleType, targetField);
    const conditions = getConditions(ruleType, fieldType);
    // Source rules compare against the selected Source option itself — no separate value needed
    const hideValue = ['is_empty', 'is_not_empty'].includes(draft.condition || '') || ruleType === 'source';

    const inputCls = 'w-full bg-slate-950/60 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-colors';
    const labelCls = 'text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block';

    const getTargetOptions = () => {
        if (ruleType === 'source') return sourceTypes.map(s => ({ value: s.value, label: s.label }));
        if (ruleType === 'activity') return SCOREABLE_ACTIVITY_TYPES;
        const standard = STANDARD_LEAD_FIELDS.map(f => ({ value: f.value, label: f.label }));
        const custom = customFields.map(f => ({ value: f.id, label: `${f.label} (custom)` }));
        return [...standard, ...custom];
    };

    return (
        <div className="bg-slate-950 border border-amber-600/40 rounded-xl p-5 space-y-4">
            {/* Row 1: Name */}
            <div>
                <label className={labelCls}>Rule Name</label>
                <input
                    type="text"
                    value={draft.name || ''}
                    onChange={e => onChange({ ...draft, name: e.target.value })}
                    placeholder="e.g. High Budget Lead"
                    className={inputCls}
                    autoFocus
                />
            </div>

            {/* Row 2: Type + Target + Condition + Value */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <label className={labelCls}>Rule Type</label>
                    <select
                        value={ruleType}
                        onChange={e => onChange({ ...draft, rule_type: e.target.value as any, target_field: '', condition: 'equals', value: '' })}
                        className={inputCls}
                    >
                        <option value="source">Source</option>
                        <option value="activity">Activity</option>
                        <option value="field">Data Field</option>
                    </select>
                </div>

                <div>
                    <label className={labelCls}>{ruleType === 'source' ? 'Source' : ruleType === 'activity' ? 'Activity' : 'Field'}</label>
                    <select
                        value={targetField}
                        onChange={e => onChange({ ...draft, target_field: e.target.value, condition: conditions[0]?.value as any || 'equals', value: '' })}
                        className={inputCls}
                    >
                        <option value="">Select…</option>
                        {getTargetOptions().map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelCls}>Condition</label>
                    <select
                        value={draft.condition || 'equals'}
                        onChange={e => onChange({ ...draft, condition: e.target.value as any })}
                        className={inputCls}
                    >
                        {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>

                {!hideValue && (
                    <div>
                        <label className={labelCls}>Value</label>
                        <input
                            type={fieldType === 'number' || fieldType === 'NUMBER' ? 'number' : 'text'}
                            value={draft.value || ''}
                            onChange={e => onChange({ ...draft, value: e.target.value })}
                            placeholder="Compare value"
                            className={inputCls}
                        />
                    </div>
                )}
            </div>

            {/* Row 3: Points + Active + Actions */}
            <div className="flex items-end gap-4">
                <div className="w-32">
                    <label className={labelCls}>Score Points</label>
                    <input
                        type="number"
                        value={draft.score_points ?? 10}
                        onChange={e => onChange({ ...draft, score_points: parseInt(e.target.value) || 0 })}
                        className={`${inputCls} text-amber-400`}
                    />
                </div>

                <div className="flex items-center gap-2 pb-2">
                    <label className={`${labelCls} mb-0`}>Active</label>
                    <button
                        type="button"
                        onClick={() => onChange({ ...draft, is_active: !draft.is_active })}
                    >
                        {draft.is_active !== false
                            ? <ToggleRight size={22} className="text-emerald-500" />
                            : <ToggleLeft size={22} className="text-slate-600" />
                        }
                    </button>
                </div>

                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={onCancel}
                        className="text-[10px] font-black uppercase px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                    >
                        <X size={12} />
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="text-[10px] font-black uppercase px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        SAVE RULE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
