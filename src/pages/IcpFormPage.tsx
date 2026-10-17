import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, FormPageTemplate, FormSection, NumberInput, Select, Spinner, Switch, TextField, Textarea, Grid, GridItem, toast } from '@so360/design-system';
import {
    ICP_CATEGORIES, DEFAULT_MIN_SCORE, applyDraft, emptyCriterion, emptyIcpForm, icpService, icpToForm,
    validateIcp, type Icp, type IcpCriterion, type IcpErrors, type IcpFormValues,
} from '../services/icpService';

const LIST = '/crm/settings/icps';
const ICP_TRAIL = [{ label: 'Settings', to: '/crm/settings' }, { label: 'Ideal customer profiles', to: LIST }];

const parseTags = (t: string): string[] => t.split(',').map((x) => x.trim()).filter(Boolean);

/** Comma-separated keywords; keeps the raw text while typing and re-syncs when the value changes from outside. */
const KeywordsField: React.FC<{ value: string[]; onChange: (tags: string[]) => void; testId: string }> = ({ value, onChange, testId }) => {
    const [text, setText] = useState<string>(value.join(', '));
    useEffect(() => {
        setText((cur: string) => (parseTags(cur).join('\u0000') === value.join('\u0000') ? cur : value.join(', ')));
    }, [value]);
    return (
        <TextField
            label="Keywords (comma-separated)" name={`${testId}-input`} value={text} data-testid={testId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setText(e.target.value); onChange(parseTags(e.target.value)); }}
        />
    );
};

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

    const back = () => navigate(LIST);

    if (loading) return <div className="flex justify-center py-nb-6 text-fg-muted"><Spinner /><span className="sr-only" data-testid="spinner">Loading…</span></div>;
    if (loadError) {
        return (
            <FormPageTemplate title="Ideal customer profile" trail={ICP_TRAIL}>
                <Card><p role="alert" className="text-sm text-fg-muted">{loadError}</p></Card>
            </FormPageTemplate>
        );
    }

    return (
        <FormPageTemplate
            trail={ICP_TRAIL}
            title={isEdit ? 'Edit ideal customer profile' : 'New ideal customer profile'}
            secondaryAction={<Button type="button" variant="secondary" onClick={back} data-testid="icp-cancel">Cancel</Button>}
            primaryAction={<Button type="button" disabled={saving} onClick={() => void onSave()} data-testid="icp-save">{saving ? 'Saving…' : 'Save'}</Button>}
        >
            <form
                className="flex flex-col gap-nb-3"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); void onSave(); }}
                noValidate
            >
                <Card title="Neura">
                    <div className="flex flex-col gap-nb-3">
                        <Textarea
                            label="Describe your ideal customer" name="icp-brief" rows={5} value={brief} data-testid="icp-brief"
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBrief(e.target.value)}
                        />
                        <p className="text-xs text-fg-muted">Neura drafts the criteria. You review and edit before saving.</p>
                        {draftError && <p role="alert" className="text-sm text-danger" data-testid="icp-draft-error">{draftError}</p>}
                        <div>
                            <Button type="button" variant="secondary" onClick={() => void onDraft()} disabled={drafting || !brief.trim()} data-testid="icp-draft-btn">
                                {drafting ? 'Drafting…' : 'Draft'}
                            </Button>
                        </div>
                    </div>
                </Card>

                <FormSection title="Profile">
                    <TextField
                        label="Name" name="icp-name" required error={errors.name} value={values.name} data-testid="icp-name"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
                    />
                    <TextField
                        label="Target persona" name="icp-persona" value={values.target_persona} data-testid="icp-persona"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('target_persona', e.target.value)}
                    />
                    <Textarea
                        label="Description" name="icp-description" rows={3} value={values.description} data-testid="icp-description"
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)}
                    />
                    <Switch label="Default profile" name="icp-default" checked={values.is_default} onCheckedChange={(v: boolean) => set('is_default', v)} data-testid="icp-default" />
                </FormSection>

                <FormSection title="Criteria" description="Each criterion adds (Include) or subtracts (Exclude) its weight from the fit score when a captured profile matches.">
                    {values.criteria.map((c, i) => (
                        <div key={i} className="flex flex-col gap-nb-3 border-b border-line pb-nb-3 last:border-b-0 last:pb-0" data-testid={`icp-criterion-${i}`}>
                            <Grid gap="md">
                                <GridItem span={{ md: 4, lg: 6 }}><Select
                                    label="Category" name={`criterion-category-${i}`} value={c.category} data-testid={`icp-criterion-category-${i}`}
                                    options={ICP_CATEGORIES.map((o) => ({ value: o.value, label: o.label }))}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCriterion(i, { category: e.target.value })}
                                /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField
                                    label="Label" name={`criterion-label-${i}`} value={c.label} data-testid={`icp-criterion-label-${i}`}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCriterion(i, { label: e.target.value })}
                                /></GridItem>
                            </Grid>
                            <KeywordsField
                                value={c.match_config.keywords}
                                onChange={(tags: string[]) => setCriterion(i, { match_config: { keywords: tags } })}
                                testId={`icp-criterion-keywords-${i}`}
                            />
                            <div className="flex flex-wrap items-end gap-nb-3">
                                <div className="w-full wc-medium:w-48">
                                    <NumberInput
                                        label="Weight (1–100)" name={`criterion-weight-${i}`} min={1} max={100} value={c.weight ?? null}
                                        data-testid={`icp-criterion-weight-${i}`}
                                        onChange={(n: number | null) => setCriterion(i, { weight: n ?? 0 })}
                                    />
                                </div>
                                <Switch
                                    label={c.is_positive ? 'Include' : 'Exclude'} name={`criterion-positive-${i}`} checked={c.is_positive}
                                    onCheckedChange={(v: boolean) => setCriterion(i, { is_positive: v })} data-testid={`icp-criterion-positive-${i}`}
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
                    {errors.criteria && <p role="alert" className="text-sm text-danger" data-testid="icp-criteria-error">{errors.criteria}</p>}
                    {errors.weights && <p role="alert" className="text-sm text-danger" data-testid="icp-weight-error">{errors.weights}</p>}
                    <div>
                        <Button type="button" variant="secondary" onClick={() => set('criteria', [...values.criteria, emptyCriterion()])} data-testid="icp-add-criterion">
                            Add criterion
                        </Button>
                    </div>
                </FormSection>

                <FormSection title="Auto-add to list" description="Optionally add captured leads that score at or above the minimum to a customer list.">
                    <Select
                        label="List" name="icp-segment" value={values.auto_segment_id ?? ''} data-testid="icp-segment"
                        options={[{ value: '', label: 'None' }, ...segments.map((sg) => ({ value: sg.id, label: sg.name }))]}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('auto_segment_id', e.target.value || null)}
                    />
                    {values.auto_segment_id && (
                        <NumberInput
                            label="Minimum fit score" name="icp-min-score" min={1} max={100}
                            value={values.auto_segment_min_score ?? DEFAULT_MIN_SCORE} data-testid="icp-min-score"
                            onChange={(n: number | null) => set('auto_segment_min_score', n)}
                        />
                    )}
                </FormSection>
            </form>
        </FormPageTemplate>
    );
};

export default IcpFormPage;
