import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, toast } from '@so360/design-system';
import {
    ICP_CATEGORIES, DEFAULT_MIN_SCORE, applyDraft, emptyCriterion, emptyIcpForm, icpService, icpToForm,
    validateIcp, type Icp, type IcpCriterion, type IcpErrors, type IcpFormValues,
} from '../services/icpService';

const LIST = '/crm/settings/icps';

const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'flex flex-col gap-1 text-xs font-bold text-slate-300';
const SECTION = 'rounded-2xl border border-slate-700/50 bg-slate-900 p-6';

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <label className={LABEL}>
        {label}
        {children}
        {error && <span role="alert" className="text-xs font-medium text-red-400">{error}</span>}
    </label>
);

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <fieldset className={`${SECTION} flex flex-col gap-4`}>
        <legend className="px-2 text-xs font-black text-slate-50">{title}</legend>
        {description && <p className="text-xs text-slate-400">{description}</p>}
        {children}
    </fieldset>
);

const PageShell: React.FC<{ title: string; onBack: () => void; side?: React.ReactNode; children: React.ReactNode }> = ({ title, onBack, side, children }) => (
    <div className="p-8">
        <header className="mb-8 flex items-center gap-3">
            <button type="button" className="rounded-lg px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800" onClick={onBack}>Back</button>
            <h1 className="text-3xl font-black tracking-tight text-slate-50">{title}</h1>
        </header>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">{children}</div>
            <aside>{side}</aside>
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; testId: string }> = ({ label, checked, onChange, testId }) => (
    <button
        type="button" role="switch" aria-checked={checked} aria-label={label} data-testid={testId}
        className={`rounded-lg border px-3 py-2 text-xs font-bold ${checked ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-slate-700 text-slate-400'}`}
        onClick={() => onChange(!checked)}
    >
        {label}
    </button>
);

const parseTags = (t: string): string[] => t.split(',').map((x) => x.trim()).filter(Boolean);

/** Comma-separated keywords; keeps the raw text while typing and re-syncs when the value changes from outside. */
const KeywordsField: React.FC<{ value: string[]; onChange: (tags: string[]) => void; testId: string }> = ({ value, onChange, testId }) => {
    const [text, setText] = useState<string>(value.join(', '));
    useEffect(() => {
        setText((cur: string) => (parseTags(cur).join('\u0000') === value.join('\u0000') ? cur : value.join(', ')));
    }, [value]);
    return (
        <Field label="Keywords (comma-separated)">
            <input
                className={INPUT} value={text} data-testid={testId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setText(e.target.value); onChange(parseTags(e.target.value)); }}
            />
        </Field>
    );
};

const numOrNull = (v: string): number | null => (v === '' ? null : Number(v));

const IcpFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;

    const [values, setValues] = useState<IcpFormValues>(emptyIcpForm());
    const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [brief, setBrief] = useState('');
    const [drafting, setDrafting] = useState(false);
    const [draftError, setDraftError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        icpService.segments().then((s: { id: string; name: string }[]) => alive && setSegments(s)).catch(() => undefined);
        if (id) {
            icpService.list()
                .then((list: Icp[]) => {
                    if (!alive) return;
                    const found = list.find((i: Icp) => i.id === id);
                    if (!found) setLoadError('Profile not found');
                    else setValues(icpToForm(found));
                })
                .catch((e: any) => alive && setLoadError(e?.message || 'Could not load profile'))
                .finally(() => alive && setLoading(false));
        }
        return () => { alive = false; };
    }, [id]);

    const errors: IcpErrors = useMemo(() => (submitted ? validateIcp(values) : {}), [submitted, values]);
    const set = <K extends keyof IcpFormValues>(k: K, v: IcpFormValues[K]) => setValues((p) => ({ ...p, [k]: v }));
    const setCriterion = (i: number, patch: Partial<IcpCriterion>) =>
        setValues((p) => ({ ...p, criteria: p.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

    const onSave = async () => {
        setSubmitted(true);
        if (Object.keys(validateIcp(values)).length > 0) return;
        setSaving(true);
        try {
            if (isEdit) await icpService.update(id!, values);
            else await icpService.create(values);
            toast.success(isEdit ? 'Profile updated' : 'Profile created');
            navigate(LIST);
        } catch (e: any) {
            toast.error(e?.message || 'Could not save profile');
        } finally {
            setSaving(false);
        }
    };

    const onDraft = async () => {
        if (!brief.trim()) return;
        setDrafting(true);
        setDraftError(null);
        try {
            const draft = await icpService.draft(brief.trim(), values.name);
            setValues((p) => applyDraft(p, draft));
            toast.success('Draft ready — review before saving');
        } catch (e: any) {
            setDraftError(e?.message || 'Neura could not draft a profile. Try again.');
        } finally {
            setDrafting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-10 text-slate-400"><span data-testid="spinner">Loading…</span></div>;
    if (loadError) {
        return (
            <PageShell title="Ideal customer profile" onBack={() => navigate(LIST)}>
                <p role="alert" className="text-sm text-slate-400">{loadError}</p>
            </PageShell>
        );
    }

    const rail = (
        <section aria-label="Neura" className={`${SECTION} flex flex-col gap-3`}>
            <h2 className="text-xs font-black text-slate-50">Neura</h2>
            <Field label="Describe your ideal customer">
                <textarea
                    name="icp-brief" rows={5} className={INPUT} value={brief} data-testid="icp-brief"
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBrief(e.target.value)}
                />
            </Field>
            <p className="text-xs text-slate-400">Neura drafts the criteria. You review and edit before saving.</p>
            {draftError && <p role="alert" className="text-sm text-red-400" data-testid="icp-draft-error">{draftError}</p>}
            <Button type="button" variant="secondary" onClick={() => void onDraft()} disabled={drafting || !brief.trim()} data-testid="icp-draft-btn">
                {drafting ? 'Drafting…' : 'Draft'}
            </Button>
        </section>
    );

    return (
        <PageShell
            title={isEdit ? 'Edit ideal customer profile' : 'New ideal customer profile'}
            onBack={() => navigate(LIST)}
            side={rail}
        >
            <form
                className="flex flex-col gap-6"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); void onSave(); }}
                noValidate
            >
                <Section title="Profile">
                    <Field label="Name" error={errors.name}>
                        <input
                            name="icp-name" required className={INPUT} value={values.name} data-testid="icp-name"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
                        />
                    </Field>
                    <Field label="Target persona">
                        <input
                            name="icp-persona" className={INPUT} value={values.target_persona} data-testid="icp-persona"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('target_persona', e.target.value)}
                        />
                    </Field>
                    <Field label="Description">
                        <textarea
                            name="icp-description" rows={3} className={INPUT} value={values.description} data-testid="icp-description"
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)}
                        />
                    </Field>
                    <ToggleSwitch label="Default profile" checked={values.is_default} onChange={(v: boolean) => set('is_default', v)} testId="icp-default" />
                </Section>

                <Section title="Criteria" description="Each criterion adds (Include) or subtracts (Exclude) its weight from the fit score when a captured profile matches.">
                    {values.criteria.map((c, i) => (
                        <div key={i} className="flex flex-col gap-3 rounded-lg border border-slate-700/50 p-3" data-testid={`icp-criterion-${i}`}>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Field label="Category">
                                    <select
                                        name={`criterion-category-${i}`} className={INPUT} value={c.category} data-testid={`icp-criterion-category-${i}`}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCriterion(i, { category: e.target.value })}
                                    >
                                        {ICP_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </Field>
                                <Field label="Label">
                                    <input
                                        name={`criterion-label-${i}`} className={INPUT} value={c.label} data-testid={`icp-criterion-label-${i}`}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCriterion(i, { label: e.target.value })}
                                    />
                                </Field>
                            </div>
                            <KeywordsField
                                value={c.match_config.keywords}
                                onChange={(tags: string[]) => setCriterion(i, { match_config: { keywords: tags } })}
                                testId={`icp-criterion-keywords-${i}`}
                            />
                            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                                <Field label="Weight (1–100)">
                                    <input
                                        type="number" min={1} max={100} name={`criterion-weight-${i}`} className={INPUT}
                                        value={c.weight ?? ''} data-testid={`icp-criterion-weight-${i}`}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCriterion(i, { weight: numOrNull(e.target.value) ?? 0 })}
                                    />
                                </Field>
                                <ToggleSwitch
                                    label={c.is_positive ? 'Include' : 'Exclude'} checked={c.is_positive}
                                    onChange={(v: boolean) => setCriterion(i, { is_positive: v })} testId={`icp-criterion-positive-${i}`}
                                />
                                <Button
                                    type="button" variant="secondary" aria-label={`Remove criterion ${i + 1}`}
                                    onClick={() => set('criteria', values.criteria.filter((_, idx) => idx !== i))}
                                    data-testid={`icp-criterion-remove-${i}`}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ))}
                    {errors.criteria && <p role="alert" className="text-sm text-red-400" data-testid="icp-criteria-error">{errors.criteria}</p>}
                    {errors.weights && <p role="alert" className="text-sm text-red-400" data-testid="icp-weight-error">{errors.weights}</p>}
                    <div>
                        <Button type="button" variant="secondary" onClick={() => set('criteria', [...values.criteria, emptyCriterion()])} data-testid="icp-add-criterion">
                            Add criterion
                        </Button>
                    </div>
                </Section>

                <Section title="Auto-add to list" description="Optionally add captured leads that score at or above the minimum to a customer list.">
                    <Field label="List">
                        <select
                            name="icp-segment" className={INPUT} value={values.auto_segment_id ?? ''} data-testid="icp-segment"
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('auto_segment_id', e.target.value || null)}
                        >
                            <option value="">None</option>
                            {segments.map((sg) => <option key={sg.id} value={sg.id}>{sg.name}</option>)}
                        </select>
                    </Field>
                    {values.auto_segment_id && (
                        <Field label="Minimum fit score">
                            <input
                                type="number" min={1} max={100} name="icp-min-score" className={INPUT}
                                value={values.auto_segment_min_score ?? DEFAULT_MIN_SCORE} data-testid="icp-min-score"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('auto_segment_min_score', numOrNull(e.target.value))}
                            />
                        </Field>
                    )}
                </Section>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-700/50 bg-slate-950 py-3">
                    <Button type="button" variant="secondary" onClick={() => navigate(LIST)} data-testid="icp-cancel">Cancel</Button>
                    <Button type="submit" disabled={saving} data-testid="icp-save">{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </form>
        </PageShell>
    );
};

export default IcpFormPage;
