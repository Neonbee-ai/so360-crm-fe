import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import {
    AlertCircle, ArrowLeft, Briefcase, Building2, CheckCircle2, ChevronRight, Download,
    ExternalLink, Loader2, Package, UploadCloud, UserCheck, Users,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ImportLeadsWizard } from '../leads/ImportLeadsWizard';
import { describeImportError } from '../../services/leadImportService';
import {
    ACCEPTED_CSV_TYPES, ImportField, ParsedCsv, applyMapping, checkCsvFile, checkFieldMapping,
    parseCsv, readFileText, suggestMapping,
} from '../../services/csvImport';
import {
    CLIENT_FIELDS, PROJECT_FIELDS, UNIT_FIELDS, RecordImportKind, RecordImportResult, RowProblem,
    importClients, importProjects, importUnits, listCategories, prepareClientRows, prepareProjects,
    prepareUnitRows,
} from '../../services/reImportService';

type Step = 'upload' | 'map' | 'review' | 'done';

const STEPS: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Import' },
];

const SELECT_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500';
const PRIMARY_BTN = 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50';
const SECONDARY_BTN = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50';
const OPTION_BTN = 'w-full flex items-center gap-3 text-left bg-slate-950 border border-slate-800 hover:border-blue-500 rounded-xl px-4 py-3';

/** What the Review step shows, and how to send it. */
interface ImportPlan {
    ready: number;
    problems: RowProblem[];
    run: () => Promise<RecordImportResult>;
}

interface RecordKindConfig {
    title: string;
    /** Plural noun for counts ("3 units"). */
    noun: [string, string];
    hint: string;
    fields: ImportField[];
    plan: (rows: Record<string, string>[]) => Promise<ImportPlan>;
}

const RECORD_KINDS: Record<RecordImportKind, RecordKindConfig> = {
    clients: {
        title: 'Import existing clients',
        noun: ['client', 'clients'],
        hint: 'Each row needs a name and an email or phone. A client whose email already exists is updated, not duplicated.',
        fields: CLIENT_FIELDS,
        plan: async (rows) => {
            const prepared = prepareClientRows(rows);
            return { ready: prepared.items.length, problems: prepared.problems, run: () => importClients(prepared) };
        },
    },
    projects: {
        title: 'Import projects & towers',
        noun: ['project', 'projects'],
        hint: 'One row per tower (or per project). Status: planned, launched, under_construction, ready, completed, on_hold. Dates: YYYY-MM-DD. Projects and towers that already exist are left as they are.',
        fields: PROJECT_FIELDS,
        plan: async (rows) => {
            const { projects, problems } = prepareProjects(rows);
            return { ready: projects.length, problems, run: () => importProjects(projects) };
        },
    },
    units: {
        title: 'Import units',
        noun: ['unit', 'units'],
        hint: 'Import the projects and towers first — each unit is matched to its tower (or to its project when it has no tower). Units already in a tower are skipped, and every new unit starts as available.',
        fields: UNIT_FIELDS,
        plan: async (rows) => {
            const prepared = prepareUnitRows(rows, await listCategories());
            return { ready: prepared.items.length, problems: prepared.problems, run: () => importUnits(prepared) };
        },
    },
};

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

/** A one-row CSV with every field's label, to start a sheet from. */
const templateHref = (fields: ImportField[]) =>
    `data:text/csv;charset=utf-8,${encodeURIComponent(fields.map((f) => f.label).join(','))}%0A`;

const ProblemList: React.FC<{ problems: RowProblem[]; label: string }> = ({ problems, label }) => (
    <div>
        <p className="text-sm font-semibold text-amber-400 mb-1.5">{plural(problems.length, ['row', 'rows'])} not imported</p>
        <ul className="max-h-40 overflow-y-auto text-xs text-slate-400 space-y-1" aria-label={label}>
            {problems.map((p, i) => <li key={i}>{p.row > 0 ? `Row ${p.row}: ` : ''}{p.message}</li>)}
        </ul>
    </div>
);

interface FlowProps {
    kind: RecordImportKind;
    onBack: () => void;
    onClose: () => void;
    onImported: () => void;
    busy: boolean;
    setBusy: (b: boolean) => void;
}

/** Upload → Map → Review → Import for one record type, in place inside the hub's modal. */
const RecordImportFlow: React.FC<FlowProps> = ({ kind, onBack, onClose, onImported, busy, setBusy }) => {
    const config = RECORD_KINDS[kind];
    const [step, setStep] = useState<Step>('upload');
    const [fileName, setFileName] = useState('');
    const [parsed, setParsed] = useState<ParsedCsv | null>(null);
    const [mapping, setMapping] = useState<Record<string, string | null>>({});
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [result, setResult] = useState<RecordImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const restart = () => {
        setStep('upload');
        setFileName('');
        setParsed(null);
        setMapping({});
        setPlan(null);
        setResult(null);
        setError(null);
    };

    const readFile = async (picked: File | null) => {
        setError(null);
        const problem = checkCsvFile(picked);
        if (problem) { setError(problem); return; }
        const file = picked as File;
        setBusy(true);
        try {
            const csv = parseCsv(await readFileText(file));
            setFileName(file.name);
            setParsed(csv);
            setMapping(suggestMapping(csv.headers, config.fields));
            setStep('map');
        } catch (err) {
            setError(describeImportError(err, 'Could not read the file.'));
        } finally {
            setBusy(false);
        }
    };

    const toReview = async () => {
        const problem = checkFieldMapping(mapping, config.fields);
        if (problem) { setError(problem); return; }
        setError(null);
        setBusy(true);
        try {
            setPlan(await config.plan(applyMapping((parsed as ParsedCsv).rows, mapping)));
            setStep('review');
        } catch (err) {
            setError(describeImportError(err, 'Could not check the rows.'));
        } finally {
            setBusy(false);
        }
    };

    const runImport = async () => {
        const current = plan as ImportPlan;
        setBusy(true);
        setError(null);
        try {
            const r = await current.run();
            // Rows held back at Review are part of the outcome too.
            setResult({ ...r, problems: [...current.problems, ...r.problems] });
            setStep('done');
            if (r.created + r.updated > 0) onImported();
        } catch (err) {
            setError(describeImportError(err, 'The import failed.'));
        } finally {
            setBusy(false);
        }
    };

    const stepIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <div className="space-y-5" data-testid={`record-import-${kind}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100">{config.title}</h3>
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
            </div>

            {error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle size={14} /> {error}
                </p>
            )}

            {step === 'upload' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">{config.hint}</p>
                    <label
                        htmlFor="record-import-file"
                        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-xl p-8 text-slate-400 hover:border-blue-500 cursor-pointer"
                    >
                        {busy ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                        <span className="text-sm font-semibold">{busy ? 'Reading file…' : 'Choose a .csv file'}</span>
                        <span className="text-xs text-slate-500">First row = column headers · up to 2,000 rows · 5 MB · from Excel use Save As → CSV</span>
                    </label>
                    <input
                        id="record-import-file"
                        aria-label="Import file"
                        type="file"
                        accept={ACCEPTED_CSV_TYPES}
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => readFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex justify-between">
                        <button type="button" className={SECONDARY_BTN} onClick={onBack} disabled={busy}>
                            <ArrowLeft size={14} /> All import types
                        </button>
                        <a
                            href={templateHref(config.fields)}
                            download={`${kind}-import-template.csv`}
                            className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300"
                        >
                            <Download size={14} /> Template
                        </a>
                    </div>
                </div>
            )}

            {step === 'map' && parsed && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                        {plural(parsed.rows.length, ['row', 'rows'])} in <span className="text-slate-200">{fileName}</span>. Match each column to a field.
                    </p>
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                        {parsed.headers.map((header) => (
                            <div key={header} className="grid grid-cols-2 gap-3 items-center" data-testid="import-mapping-row">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-200 truncate">{header}</p>
                                    <p className="text-xs text-slate-500 truncate">{parsed.rows[0][header]}</p>
                                </div>
                                <select
                                    aria-label={`Field for ${header}`}
                                    className={SELECT_CLS}
                                    value={mapping[header] ?? ''}
                                    onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value || null }))}
                                >
                                    <option value="">Don't import</option>
                                    {config.fields.map((f) => (
                                        <option key={f.key} value={f.key}>{f.required ? `${f.label} *` : f.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        <button type="button" className={SECONDARY_BTN} onClick={restart} disabled={busy}>Choose another file</button>
                        <button type="button" className={PRIMARY_BTN} onClick={toReview} disabled={busy}>
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            Next
                        </button>
                    </div>
                </div>
            )}

            {step === 'review' && plan && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-200" data-testid="import-ready">
                        {plural(plan.ready, config.noun)} ready to import.
                    </p>
                    {plan.problems.length > 0 && <ProblemList problems={plan.problems} label="Rows with problems" />}
                    <div className="flex justify-between">
                        <button type="button" className={SECONDARY_BTN} onClick={() => setStep('map')} disabled={busy}>Back</button>
                        <button type="button" className={PRIMARY_BTN} onClick={runImport} disabled={busy || plan.ready === 0}>
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            Import {plural(plan.ready, config.noun)}
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
                        {([['Created', result.created], ['Updated', result.updated], ['Already there', result.skipped]] as const).map(([label, n]) => (
                            <div key={label} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                                <dt className="text-xs text-slate-500">{label}</dt>
                                <dd className="text-xl font-bold text-slate-100">{n}</dd>
                            </div>
                        ))}
                    </dl>
                    {result.problems.length > 0 && <ProblemList problems={result.problems} label="Import errors" />}
                    <div className="flex justify-between">
                        <button type="button" className={SECONDARY_BTN} onClick={restart}>Import another file</button>
                        <button type="button" className={PRIMARY_BTN} onClick={onClose}>Done</button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called after an import that created or updated at least one record. */
    onImported: () => void;
}

type HubKind = 'leads' | RecordImportKind;

/**
 * One import entry point for the CRM (RE G10). Each type goes to the importer
 * of the module that owns the record: leads & contacts → crm-be (csv/xlsx),
 * existing clients → Core, projects/towers/units → Inventory, agents →
 * People Connect's own import page. Types the user cannot import are hidden (leads & clients need leads.import).
 * Leads keep their own wizard, which replaces the hub rather than stacking.
 */
export const ImportHub: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    const [kind, setKind] = useState<HubKind | null>(null);
    const [busy, setBusy] = useState(false);

    const can = (permission: string) =>
        shell?.permissionsLoaded === true && (shell?.hasPermission?.(permission) ?? false);

    const close = () => {
        if (busy) return;
        setKind(null);
        onClose();
    };

    if (kind === 'leads') {
        return <ImportLeadsWizard isOpen={isOpen} onClose={close} onImported={onImported} />;
    }

    const options: Array<{ key: HubKind | 'agents'; label: string; hint: string; icon: React.ReactNode; show: boolean }> = [
        { key: 'leads', label: 'Leads & contacts', hint: 'CSV or Excel · owner, source, custom fields', icon: <Users size={18} />, show: can('leads.import') },
        { key: 'clients', label: 'Existing clients', hint: 'CSV · name, email, phone, company, tax ID', icon: <Briefcase size={18} />, show: can('leads.import') },
        { key: 'projects', label: 'Projects & towers', hint: 'CSV · status, dates, payment plan, commission', icon: <Building2 size={18} />, show: can('categories.create') },
        { key: 'units', label: 'Units', hint: 'CSV · bedrooms, areas, prices, payment plan, commission', icon: <Package size={18} />, show: can('items.import') },
        { key: 'agents', label: 'Agents', hint: 'Opens People Connect import', icon: <UserCheck size={18} />, show: can('employees.import') },
    ];

    const pick = (key: HubKind | 'agents') => {
        if (key === 'agents') {
            close();
            navigate('/people/import-export?tab=import');
            return;
        }
        setKind(key);
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title="Import" size="xl">
            {kind ? (
                <RecordImportFlow
                    key={kind}
                    kind={kind}
                    onBack={() => setKind(null)}
                    onClose={close}
                    onImported={onImported}
                    busy={busy}
                    setBusy={setBusy}
                />
            ) : (
                <div className="space-y-2" data-testid="import-hub">
                    <p className="text-sm text-slate-400 mb-3">What are you importing?</p>
                    {options.filter((o) => o.show).map((o) => (
                        <button key={o.key} type="button" className={OPTION_BTN} onClick={() => pick(o.key)}>
                            <span className="text-blue-400">{o.icon}</span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-slate-100">{o.label}</span>
                                <span className="block text-xs text-slate-500">{o.hint}</span>
                            </span>
                            {o.key === 'agents' ? <ExternalLink size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
};

export default ImportHub;
