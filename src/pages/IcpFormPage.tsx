import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Button, Card, DetailPageTemplate, FormSection, NumberInput, Select, Spinner, Switch,
    TagInput, TextField, Textarea, toast,
} from '@so360/design-system';
import {
    ICP_CATEGORIES, DEFAULT_MIN_SCORE, applyDraft, emptyCriterion, emptyIcpForm, icpService, icpToForm,
    validateIcp, type IcpCriterion, type IcpErrors, type IcpFormValues,
} from '../services/icpService';

const LIST = '/crm/settings/icps';

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
        icpService.segments().then((s) => alive && setSegments(s)).catch(() => undefined);
        if (id) {
            icpService.list()
                .then((list) => {
                    if (!alive) return;
                    const found = list.find((i) => i.id === id);
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

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
    if (loadError) {
        return (
            <DetailPageTemplate title="Ideal customer profile" onBack={() => navigate(LIST)}>
                <p role="alert" className="text-nb-body text-fg-muted">{loadError}</p>
            </DetailPageTemplate>
        );
    }

    const rail = (
        <Card title="Neura" name="neura-draft">
            <div className="flex flex-col gap-nb-3">
                <Textarea
                    name="icp-brief"
                    label="Describe your ideal customer"
                    rows={5}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    hint="Neura drafts the criteria. You review and edit before saving."
                    data-testid="icp-brief"
                />
                {draftError && <p role="alert" className="text-nb-body text-danger" data-testid="icp-draft-error">{draftError}</p>}
                <Button type="button" variant="secondary" onClick={() => void onDraft()} disabled={drafting || !brief.trim()} data-testid="icp-draft-btn">
                    {drafting ? 'Drafting…' : 'Draft'}
                </Button>
            </div>
        </Card>
    );

    return (
        <DetailPageTemplate
            title={isEdit ? 'Edit ideal customer profile' : 'New ideal customer profile'}
            onBack={() => navigate(LIST)}
            sidePanel={rail}
        >
            <form
                className="flex flex-col gap-nb-6"
                onSubmit={(e) => { e.preventDefault(); void onSave(); }}
                noValidate
            >
                <FormSection title="Profile" columns={2}>
                    <TextField
                        name="icp-name" label="Name" required value={values.name}
                        onChange={(e) => set('name', e.target.value)} error={errors.name} data-testid="icp-name"
                    />
                    <TextField
                        name="icp-persona" label="Target persona" value={values.target_persona}
                        onChange={(e) => set('target_persona', e.target.value)} data-testid="icp-persona"
                    />
                    <Textarea
                        name="icp-description" label="Description" rows={3} value={values.description}
                        onChange={(e) => set('description', e.target.value)} data-testid="icp-description"
                    />
                    <Switch
                        name="icp-default" label="Default profile" checked={values.is_default}
                        onCheckedChange={(v) => set('is_default', v)} data-testid="icp-default"
                    />
                </FormSection>

                <FormSection title="Criteria" description="Each criterion adds (Include) or subtracts (Exclude) its weight from the fit score when a captured profile matches.">
                    {values.criteria.map((c, i) => (
                        <div key={i} className="flex flex-col gap-nb-3 rounded-nb border border-line p-nb-3" data-testid={`icp-criterion-${i}`}>
                            <div className="grid grid-cols-1 gap-nb-3 wc-medium:grid-cols-2">
                                <Select
                                    name={`criterion-category-${i}`} label="Category" value={c.category}
                                    options={ICP_CATEGORIES} onChange={(e) => setCriterion(i, { category: e.target.value })}
                                    data-testid={`icp-criterion-category-${i}`}
                                />
                                <TextField
                                    name={`criterion-label-${i}`} label="Label" value={c.label}
                                    onChange={(e) => setCriterion(i, { label: e.target.value })}
                                    data-testid={`icp-criterion-label-${i}`}
                                />
                            </div>
                            <TagInput
                                name={`criterion-keywords-${i}`} label="Keywords" value={c.match_config.keywords}
                                onChange={(tags) => setCriterion(i, { match_config: { keywords: tags } })}
                                data-testid={`icp-criterion-keywords-${i}`}
                            />
                            <div className="grid grid-cols-1 items-end gap-nb-3 wc-medium:grid-cols-3">
                                <NumberInput
                                    name={`criterion-weight-${i}`} label="Weight (1–100)" min={1} max={100} value={c.weight}
                                    onChange={(n) => setCriterion(i, { weight: n ?? 0 })}
                                    data-testid={`icp-criterion-weight-${i}`}
                                />
                                <Switch
                                    name={`criterion-positive-${i}`} label={c.is_positive ? 'Include' : 'Exclude'}
                                    checked={c.is_positive} onCheckedChange={(v) => setCriterion(i, { is_positive: v })}
                                    data-testid={`icp-criterion-positive-${i}`}
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
                    {errors.criteria && <p role="alert" className="text-nb-body text-danger" data-testid="icp-criteria-error">{errors.criteria}</p>}
                    {errors.weights && <p role="alert" className="text-nb-body text-danger" data-testid="icp-weight-error">{errors.weights}</p>}
                    <div>
                        <Button type="button" variant="secondary" onClick={() => set('criteria', [...values.criteria, emptyCriterion()])} data-testid="icp-add-criterion">
                            Add criterion
                        </Button>
                    </div>
                </FormSection>

                <FormSection title="Auto-add to list" description="Optionally add captured leads that score at or above the minimum to a customer list." columns={2}>
                    <Select
                        name="icp-segment" label="List" placeholder="None"
                        value={values.auto_segment_id ?? ''}
                        options={[{ value: '', label: 'None' }, ...segments.map((s) => ({ value: s.id, label: s.name }))]}
                        onChange={(e) => set('auto_segment_id', e.target.value || null)}
                        data-testid="icp-segment"
                    />
                    {values.auto_segment_id && (
                        <NumberInput
                            name="icp-min-score" label="Minimum fit score" min={1} max={100}
                            value={values.auto_segment_min_score ?? DEFAULT_MIN_SCORE}
                            onChange={(n) => set('auto_segment_min_score', n)} data-testid="icp-min-score"
                        />
                    )}
                </FormSection>

                <div className="sticky bottom-0 flex justify-end gap-nb-2 border-t border-line bg-bg py-nb-3">
                    <Button type="button" variant="secondary" onClick={() => navigate(LIST)} data-testid="icp-cancel">Cancel</Button>
                    <Button type="submit" disabled={saving} data-testid="icp-save">{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </form>
        </DetailPageTemplate>
    );
};

export default IcpFormPage;
