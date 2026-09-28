import React, { useState } from 'react';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
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

type Step = 'upload' | 'map' | 'review' | 'done';

const STEPS: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Import' },
];

const SELECT_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500';
const PRIMARY_BTN = 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50';
const SECONDARY_BTN = 'px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200';

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
                            className={`px-2.5 py-1 rounded-full border ${i === stepIndex ? 'bg-blue-600 text-white border-blue-600' : i < stepIndex ? 'text-blue-400 border-blue-500/30' : 'text-slate-500 border-slate-700'}`}
                        >
                            {i + 1}. {s.label}
                        </li>
                    ))}
                </ol>

                {error && (
                    <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle size={14} /> {error}
                    </p>
                )}

                {step === 'upload' && (
                    <div className="space-y-3">
                        <label
                            htmlFor="lead-import-file"
                            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-xl p-8 text-slate-400 hover:border-blue-500 cursor-pointer"
                        >
                            {busy ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                            <span className="text-sm font-semibold">{busy ? 'Reading file…' : 'Choose a .csv or .xlsx file'}</span>
                            <span className="text-xs text-slate-500">First row = column headers · up to 5,000 rows · 10 MB</span>
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
                        <p className="text-sm text-slate-400">
                            {preview.total_rows} row{preview.total_rows === 1 ? '' : 's'} in <span className="text-slate-200">{file?.name}</span>. Match each column to a lead field.
                        </p>
                        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                            {preview.headers.map((header) => (
                                <div key={header} className="grid grid-cols-2 gap-3 items-center" data-testid="import-mapping-row">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-200 truncate">{header}</p>
                                        <p className="text-xs text-slate-500 truncate">{preview.sample_rows[0]?.[header] ?? ''}</p>
                                    </div>
                                    <select
                                        aria-label={`Field for ${header}`}
                                        className={SELECT_CLS}
                                        value={mapping[header] ?? ''}
                                        onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value || null }))}
                                    >
                                        <option value="">Don't import</option>
                                        {preview.available_fields.map((f) => (
                                            <option key={f.key} value={f.key}>{f.custom ? `${f.label} (custom)` : f.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between">
                            <button type="button" className={SECONDARY_BTN} onClick={reset}>Choose another file</button>
                            <button type="button" className={PRIMARY_BTN} onClick={toReview}>Next</button>
                        </div>
                    </div>
                )}

                {step === 'review' && preview && (
                    <div className="space-y-4">
                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-xs" aria-label="Import preview">
                                <thead>
                                    <tr className="bg-slate-950 text-slate-400">
                                        {mappedHeaders.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{fieldLabel(mapping[h])}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.sample_rows.map((row, i) => (
                                        <tr key={i} className="border-t border-slate-800 text-slate-200">
                                            {mappedHeaders.map((h) => <td key={h} className="px-3 py-2 whitespace-nowrap">{row[h] ?? ''}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500">
                            Showing {preview.sample_rows.length} of {preview.total_rows} rows. Leads with no owner column go through your assignment rules.
                        </p>
                        <fieldset>
                            <legend className="text-sm font-semibold text-slate-200 mb-2">When a lead with the same email or phone exists</legend>
                            <div className="space-y-1.5">
                                {DUPLICATE_POLICIES.map((p) => (
                                    <label key={p.value} className="flex items-start gap-2 text-sm text-slate-300">
                                        <input
                                            type="radio"
                                            name="import-duplicate-policy"
                                            value={p.value}
                                            checked={policy === p.value}
                                            onChange={() => setPolicy(p.value)}
                                            className="mt-1"
                                        />
                                        <span><span className="font-semibold">{p.label}</span> <span className="text-slate-500">— {p.hint}</span></span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                        <div className="flex justify-between">
                            <button type="button" className={SECONDARY_BTN} onClick={() => setStep('map')} disabled={busy}>Back</button>
                            <button type="button" className={PRIMARY_BTN} onClick={runImport} disabled={busy}>
                                {busy && <Loader2 size={14} className="animate-spin" />}
                                Import {preview.total_rows} lead{preview.total_rows === 1 ? '' : 's'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'done' && result && (
                    <div className="space-y-4" data-testid="import-result">
                        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                            <CheckCircle2 size={16} /> Import finished
                        </p>
                        <dl className="grid grid-cols-3 gap-3 text-center">
                            {([['Created', result.created], ['Updated', result.updated], ['Skipped', result.skipped]] as const).map(([label, n]) => (
                                <div key={label} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                                    <dt className="text-xs text-slate-500">{label}</dt>
                                    <dd className="text-xl font-bold text-slate-100">{n ?? 0}</dd>
                                </div>
                            ))}
                        </dl>
                        {result.errors?.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold text-amber-400 mb-1.5">{result.errors.length} row{result.errors.length === 1 ? '' : 's'} not imported</p>
                                <ul className="max-h-40 overflow-y-auto text-xs text-slate-400 space-y-1" aria-label="Import errors">
                                    {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button type="button" className={PRIMARY_BTN} onClick={close}>Done</button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImportLeadsWizard;
