import React, { useState } from 'react';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Select, RadioGroup, DataTable } from '@so360/design-system';
import { Modal } from '../common/Modal';
import {
    leadImportService,
    ImportPreview,
    ImportResult,
    ImportDuplicatePolicy,
    DUPLICATE_POLICIES,
    ACCEPTED_IMPORT_TYPES,
    checkImportFile,
    checkMapping,
    describeImportError,
} from '../../services/leadImportService';
import { CombGrid } from '../../pages/components/CombGrid';

type Step = 'upload' | 'map' | 'review' | 'done';

const STEPS: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Import' },
];


interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called after an import that created or updated at least one lead. */
    onImported: () => void;
}

/**
 * Lead import wizard (A7): Upload → Map → Review → Import, all inside one
 * modal (steps swap in place, nothing stacks). The file is previewed by
 * crm-be, which suggests a column mapping; the same file is re-sent with the
 * confirmed mapping to import.
 */
export const ImportLeadsWizard: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [mapping, setMapping] = useState<Record<string, string | null>>({});
    const [policy, setPolicy] = useState<ImportDuplicatePolicy>('skip');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setStep('upload');
        setFile(null);
        setPreview(null);
        setMapping({});
        setPolicy('skip');
        setResult(null);
        setError(null);
    };

    const close = () => {
        if (busy) return;
        reset();
        onClose();
    };

    const readFile = async (picked: File | null) => {
        setError(null);
        const problem = checkImportFile(picked);
        if (problem) { setError(problem); return; }
        setFile(picked);
        setBusy(true);
        try {
            const p = await leadImportService.preview(picked as File);
            setPreview(p);
            setMapping({ ...p.suggested_mapping });
            setStep('map');
        } catch (err) {
            setError(describeImportError(err, 'Could not read the file.'));
        } finally {
            setBusy(false);
        }
    };

    const toReview = () => {
        const problem = checkMapping(mapping);
        if (problem) { setError(problem); return; }
        setError(null);
        setStep('review');
    };

    const runImport = async () => {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            const r = await leadImportService.import(file, mapping, policy);
            setResult(r);
            setStep('done');
            if ((r.created ?? 0) + (r.updated ?? 0) > 0) onImported();
        } catch (err) {
            setError(describeImportError(err, 'The import failed.'));
        } finally {
            setBusy(false);
        }
    };

    const fieldLabel = (key: string | null | undefined) =>
        preview?.available_fields.find((f) => f.key === key)?.label ?? key ?? '';
    const mappedHeaders = preview ? preview.headers.filter((h) => mapping[h]) : [];
    const stepIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <Modal isOpen={isOpen} onClose={close} title="Import leads" size="xl">
            <div className="space-y-5" data-testid="import-leads-wizard">
                <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Import steps">
                    {STEPS.map((s, i) => (
                        <li
                            key={s.key}
                            aria-current={i === stepIndex ? 'step' : undefined}
                            className={`px-2.5 py-1 rounded-full border ${i === stepIndex ? 'bg-primary text-primary-fg border-primary' : i < stepIndex ? 'text-primary border-primary/30' : 'text-fg-muted border-line'}`}
                        >
                            {i + 1}. {s.label}
                        </li>
                    ))}
                </ol>

                {error && (
                    <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                        <AlertCircle size={14} /> {error}
                    </p>
                )}

                {step === 'upload' && (
                    <div className="space-y-3">
                        <label
                            htmlFor="lead-import-file"
                            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl p-8 text-fg-subtle hover:border-primary cursor-pointer"
                        >
                            {busy ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                            <span className="text-sm font-semibold">{busy ? 'Reading file…' : 'Choose a .csv or .xlsx file'}</span>
                            <span className="text-xs text-fg-muted">First row = column headers · up to 5,000 rows · 10 MB</span>
                        </label>
                        <input
                            id="lead-import-file"
                            aria-label="Import file"
                            type="file"
                            accept={ACCEPTED_IMPORT_TYPES}
                            className="sr-only"
                            disabled={busy}
                            onChange={(e) => readFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                )}

                {step === 'map' && preview && (
                    <div className="space-y-4">
                        <p className="text-sm text-fg-subtle">
                            {preview.total_rows} row{preview.total_rows === 1 ? '' : 's'} in <span className="text-fg">{file?.name}</span>. Match each column to a lead field.
                        </p>
                        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                            {preview.headers.map((header) => (
                                <CombGrid cols="pair-fixed" className="items-center" key={header}  data-testid="import-mapping-row">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-fg truncate">{header}</p>
                                        <p className="text-xs text-fg-muted truncate">{preview.sample_rows[0]?.[header] ?? ''}</p>
                                    </div>
                                    <Select
                                        aria-label={`Field for ${header}`}
                                        name={`import-field-${header}`}
                                        value={mapping[header] ?? ''}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping((m) => ({ ...m, [header]: e.target.value || null }))}
                                        options={[{ value: '', label: "Don't import" }, ...preview.available_fields.map((f) => ({ value: f.key, label: f.custom ? `${f.label} (custom)` : f.label }))]}
                                    />
                                </CombGrid>
                            ))}
                        </div>
                        <div className="flex justify-between">
                            <Button type="button" variant="secondary" onClick={reset}>Choose another file</Button>
                            <Button type="button" onClick={toReview}>Next</Button>
                        </div>
                    </div>
                )}

                {step === 'review' && preview && (
                    <div className="space-y-4">
                        <DataTable
                            name="import-preview"
                            data-testid="import-preview-table"
                            density="compact"
                            columns={mappedHeaders.map((h) => ({
                                key: h,
                                header: fieldLabel(mapping[h]),
                                render: (r: { row: Record<string, string> }) => <span className="whitespace-nowrap">{r.row[h] ?? ''}</span>,
                            }))}
                            rows={preview.sample_rows.map((row, i) => ({ i, row }))}
                            rowKey={(r) => String(r.i)}
                            emptyState={<p className="text-xs text-fg-muted" data-testid="import-preview-empty">No sample rows.</p>}
                        />
                        <p className="text-xs text-fg-muted">
                            Showing {preview.sample_rows.length} of {preview.total_rows} rows. Leads with no owner column go through your assignment rules.
                        </p>
                        <div>
                            <RadioGroup
                                name="import-duplicate-policy"
                                label="When a lead with the same email or phone exists"
                                value={policy}
                                onChange={(v: string) => setPolicy(v as ImportDuplicatePolicy)}
                                options={DUPLICATE_POLICIES.map((p) => ({ value: p.value, label: p.label, description: p.hint }))}
                            />
                        </div>
                        <div className="flex justify-between">
                            <Button type="button" variant="secondary" onClick={() => setStep('map')} disabled={busy}>Back</Button>
                            <Button type="button" onClick={runImport} disabled={busy}>
                                {busy && <Loader2 size={14} className="animate-spin" />}
                                Import {preview.total_rows} lead{preview.total_rows === 1 ? '' : 's'}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'done' && result && (
                    <div className="space-y-4" data-testid="import-result">
                        <p className="flex items-center gap-2 text-sm font-semibold text-success">
                            <CheckCircle2 size={16} /> Import finished
                        </p>
                        <dl className="grid grid-cols-3 gap-3 text-center">
                            {([['Created', result.created], ['Updated', result.updated], ['Skipped', result.skipped]] as const).map(([label, n]) => (
                                <div key={label} className="bg-bg border border-line rounded-lg p-3">
                                    <dt className="text-xs text-fg-muted">{label}</dt>
                                    <dd className="text-xl font-bold text-fg">{n ?? 0}</dd>
                                </div>
                            ))}
                        </dl>
                        {result.errors?.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold text-warning mb-1.5">{result.errors.length} row{result.errors.length === 1 ? '' : 's'} not imported</p>
                                <ul className="max-h-40 overflow-y-auto text-xs text-fg-subtle space-y-1" aria-label="Import errors">
                                    {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button type="button" onClick={close}>Done</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImportLeadsWizard;
