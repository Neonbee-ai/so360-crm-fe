import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import {
    AlertCircle, ArrowLeft, Briefcase, Building2, CheckCircle2, ChevronRight, Download,
    ExternalLink, Loader2, Package, UploadCloud, UserCheck, Users,
} from 'lucide-react';
import { Button, Select, Grid, FileUpload } from '@so360/design-system';
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

const OPTION_BTN = '!h-auto w-full !justify-start gap-3 !whitespace-normal py-3 text-left';

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
        <p className="text-sm font-semibold text-warning mb-1.5">{plural(problems.length, ['row', 'rows'])} not imported</p>
        <ul className="max-h-40 overflow-y-auto text-xs text-fg-subtle space-y-1" aria-label={label}>
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
        <div className="space-y-nb-6" data-testid={`record-import-${kind}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-fg">{config.title}</h3>
                <ol className="flex flex-wrap items-center gap-nb-2 pb-nb-2 text-xs font-semibold" aria-label="Import steps">
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
            </div>

            {error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                    <AlertCircle size={14} /> {error}
                </p>
            )}

            {step === 'upload' && (
                <div className="space-y-3">
                    <p className="text-xs text-fg-subtle">{config.hint}</p>
                    <FileUpload
                        name="record-import-file"
                        aria-label="Import file"
                        prompt={busy ? 'Reading file…' : 'Choose a .csv file'}
                        hint="First row = column headers · up to 2,000 rows · 5 MB · from Excel use Save As → CSV"
                        accept={ACCEPTED_CSV_TYPES}
                        disabled={busy}
                        value={[]}
                        onChange={(files) => readFile(files[0] ?? null)}
                    />
                    <div className="flex justify-between">
                        <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>
                            <ArrowLeft size={14} /> All import types
                        </Button>
                        <a
                            href={templateHref(config.fields)}
                            download={`${kind}-import-template.csv`}
                            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary"
                        >
                            <Download size={14} /> Template
                        </a>
                    </div>
                </div>
            )}

            {step === 'map' && parsed && (
                <div className="space-y-4">
                    <p className="text-sm text-fg-subtle">
                        {plural(parsed.rows.length, ['row', 'rows'])} in <span className="text-fg">{fileName}</span>. Match each column to a field.
                    </p>
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                        {parsed.headers.map((header) => (
                            <Grid key={header} columns={2} gap="md" className="items-center" data-testid="import-mapping-row">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-fg truncate">{header}</p>
                                    <p className="text-xs text-fg-muted truncate">{parsed.rows[0][header]}</p>
                                </div>
                                <Select
                                    name={`import-field-${header}`}
                                    aria-label={`Field for ${header}`}
                                    value={mapping[header] ?? ''}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping((m) => ({ ...m, [header]: e.target.value || null }))}
                                    options={[{ value: '', label: "Don't import" }, ...config.fields.map((f) => ({ value: f.key, label: f.required ? `${f.label} *` : f.label }))]}
                                />
                            </Grid>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        <Button type="button" variant="secondary" onClick={restart} disabled={busy}>Choose another file</Button>
                        <Button type="button" onClick={toReview} disabled={busy}>
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {step === 'review' && plan && (
                <div className="space-y-4">
                    <p className="text-sm text-fg" data-testid="import-ready">
                        {plural(plan.ready, config.noun)} ready to import.
                    </p>
                    {plan.problems.length > 0 && <ProblemList problems={plan.problems} label="Rows with problems" />}
                    <div className="flex justify-between">
                        <Button type="button" variant="secondary" onClick={() => setStep('map')} disabled={busy}>Back</Button>
                        <Button type="button" onClick={runImport} disabled={busy || plan.ready === 0}>
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            Import {plural(plan.ready, config.noun)}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div className="space-y-4" data-testid="import-result">
                    <p className="flex items-center gap-2 text-sm font-semibold text-success">
                        <CheckCircle2 size={16} /> Import finished
                    </p>
                    <Grid columns={3} gap="md" className="text-center">
                        {([['Created', result.created], ['Updated', result.updated], ['Already there', result.skipped]] as const).map(([label, n]) => (
                            <div key={label} className="bg-bg border border-line rounded-lg p-3">
                                <dt className="text-xs text-fg-muted">{label}</dt>
                                <dd className="text-xl font-bold text-fg">{n}</dd>
                            </div>
                        ))}
                    </Grid>
                    {result.problems.length > 0 && <ProblemList problems={result.problems} label="Import errors" />}
                    <div className="flex justify-between">
                        <Button type="button" variant="secondary" onClick={restart}>Import another file</Button>
                        <Button type="button" onClick={onClose}>Done</Button>
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
 * People Connect's own import page. Types the user cannot create are hidden.
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
        { key: 'leads', label: 'Leads & contacts', hint: 'CSV or Excel · owner, source, custom fields', icon: <Users size={18} />, show: true },
        { key: 'clients', label: 'Existing clients', hint: 'CSV · name, email, phone, company, tax ID', icon: <Briefcase size={18} />, show: true },
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
                    <p className="text-sm text-fg-subtle mb-3">What are you importing?</p>
                    {options.filter((o) => o.show).map((o) => (
                        <Button key={o.key} type="button" variant="secondary" className={OPTION_BTN} onClick={() => pick(o.key)}>
                            <span className="text-primary">{o.icon}</span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-fg">{o.label}</span>
                                <span className="block text-xs text-fg-muted">{o.hint}</span>
                            </span>
                            {o.key === 'agents' ? <ExternalLink size={16} className="text-fg-muted" /> : <ChevronRight size={16} className="text-fg-muted" />}
                        </Button>
                    ))}
                </div>
            )}
        </Modal>
    );
};

export default ImportHub;
