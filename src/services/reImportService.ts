/**
 * Record importers behind the CRM Import hub (RE G10). Each type goes to the
 * module that owns the record; nothing is written from here directly:
 *
 *   Existing clients → Core   POST /v1/channel/import/customers/commit
 *   Projects/towers  → Inventory POST /v1/inventory/settings/:org/categories
 *   Units            → Inventory POST /v1/inventory/property/:org/units/import
 *
 * Rows are checked here against the same rules the backends apply, so the
 * Review step can list every problem before anything is sent. Row numbers are
 * spreadsheet rows: the header is row 1, the first data row is row 2.
 */
import { crmCoreClient, crmInventoryClient } from './crmService';
import { ImportField, toNumber } from './csvImport';

export type RecordImportKind = 'clients' | 'projects' | 'units';

export interface RowProblem {
    /** Sheet row; 0 when the problem is not about one row. */
    row: number;
    message: string;
}

export interface PreparedRows<T> {
    items: Array<{ row: number; data: T }>;
    problems: RowProblem[];
}

export interface RecordImportResult {
    created: number;
    updated: number;
    skipped: number;
    problems: RowProblem[];
}

/** Spreadsheet row of the Nth (0-based) data row. */
export const sheetRow = (index: number) => index + 2;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

const isIsoDate = (value: string) => {
    if (!ISO_DATE_RE.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

// ── Existing clients ────────────────────────────────────────────────────────

export const CLIENT_FIELDS: ImportField[] = [
    { key: 'name', label: 'Name', required: true, aliases: ['customer name', 'client name', 'full name', 'customer', 'client'] },
    { key: 'email', label: 'Email', aliases: ['email address', 'e-mail'] },
    { key: 'phone', label: 'Phone', aliases: ['mobile', 'phone number', 'contact number'] },
    { key: 'business_name', label: 'Company', aliases: ['business name', 'company name'] },
    { key: 'tax_id', label: 'Tax ID', aliases: ['trn', 'gstin', 'vat number'] },
    { key: 'payment_terms', label: 'Payment terms', aliases: ['terms'] },
    { key: 'currency', label: 'Currency' },
    { key: 'notes', label: 'Notes' },
];

/** Core's customer rules: a name, and an email or a phone; a valid email. */
export function prepareClientRows(rows: Record<string, string>[]): PreparedRows<Record<string, string>> {
    const out: PreparedRows<Record<string, string>> = { items: [], problems: [] };
    rows.forEach((data, i) => {
        const row = sheetRow(i);
        const errors: string[] = [];
        if (!data.name) errors.push('Name is missing');
        if (!data.email && !data.phone) errors.push('Add an email or a phone');
        if (data.email && !EMAIL_RE.test(data.email)) errors.push(`"${data.email}" is not an email address`);
        if (errors.length > 0) out.problems.push({ row, message: errors.join('; ') });
        else out.items.push({ row, data });
    });
    return out;
}

interface CoreCommitResult {
    created?: number;
    updated?: number;
    invalid?: Array<{ row: number; errors: string[] }>;
    failed?: Array<{ row: number; error: string }>;
}

export async function importClients(prepared: PreparedRows<Record<string, string>>): Promise<RecordImportResult> {
    const res = await crmCoreClient.post<CoreCommitResult>(
        '/v1/channel/import/customers/commit',
        { rows: prepared.items.map((i) => i.data) },
    );
    // Core numbers rows 1..n in the array it was sent; map back to the sheet.
    const toSheet = (n: number) => prepared.items[n - 1]?.row ?? n;
    const problems: RowProblem[] = [
        ...(res?.invalid ?? []).map((e) => ({ row: toSheet(e.row), message: e.errors.join('; ') })),
        ...(res?.failed ?? []).map((e) => ({ row: toSheet(e.row), message: e.error })),
    ];
    return { created: res?.created ?? 0, updated: res?.updated ?? 0, skipped: 0, problems };
}

// ── Projects & towers ───────────────────────────────────────────────────────

export const PROJECT_STATUSES = ['planned', 'launched', 'under_construction', 'ready', 'completed', 'on_hold'] as const;

export const PROJECT_FIELDS: ImportField[] = [
    { key: 'project', label: 'Project', required: true, aliases: ['project name', 'development'] },
    { key: 'tower', label: 'Tower', aliases: ['building', 'block', 'phase', 'tower name'] },
    { key: 'project_code', label: 'Project code', aliases: ['code'] },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'project_status', label: 'Status', aliases: ['project status'] },
    { key: 'launch_date', label: 'Launch date' },
    { key: 'completion_date', label: 'Completion date', aliases: ['handover date'] },
    { key: 'handover', label: 'Handover' },
    { key: 'payment_plan', label: 'Payment plan' },
    { key: 'commission_percent', label: 'Commission %', aliases: ['commission', 'commission percent'] },
    { key: 'description', label: 'Description' },
];

export interface ProjectPlan {
    name: string;
    /** First sheet row that named the project. */
    row: number;
    metadata: Record<string, string | number>;
    towers: Array<{ name: string; row: number }>;
}

const PROJECT_TEXT_KEYS = ['project_code', 'city', 'country', 'payment_plan', 'description', 'handover'] as const;

/** Validates one row's project metadata the way Inventory does. */
function projectMetadata(data: Record<string, string>): { metadata: Record<string, string | number>; errors: string[] } {
    const metadata: Record<string, string | number> = {};
    const errors: string[] = [];
    for (const key of PROJECT_TEXT_KEYS) if (data[key]) metadata[key] = data[key];
    if (data.project_status) {
        const status = data.project_status.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if ((PROJECT_STATUSES as readonly string[]).includes(status)) metadata.project_status = status;
        else errors.push(`Status must be one of ${PROJECT_STATUSES.join(', ')}`);
    }
    for (const key of ['launch_date', 'completion_date'] as const) {
        if (!data[key]) continue;
        if (isIsoDate(data[key])) metadata[key] = data[key];
        else errors.push(`${key === 'launch_date' ? 'Launch' : 'Completion'} date must be YYYY-MM-DD`);
    }
    if (metadata.launch_date && metadata.completion_date && metadata.completion_date < metadata.launch_date) {
        errors.push('Completion date is before the launch date');
    }
    if (data.commission_percent) {
        const n = toNumber(data.commission_percent);
        if (n === null || Number.isNaN(n) || n < 0 || n > 100) errors.push('Commission % must be between 0 and 100');
        else metadata.commission_percent = n;
    }
    return { metadata, errors };
}

/**
 * Groups rows into projects (case-insensitive) with their towers. The first
 * row of a project that carries metadata sets it; later rows only add towers.
 */
export function prepareProjects(rows: Record<string, string>[]): { projects: ProjectPlan[]; problems: RowProblem[] } {
    const byName = new Map<string, ProjectPlan>();
    const problems: RowProblem[] = [];
    rows.forEach((data, i) => {
        const row = sheetRow(i);
        const name = (data.project ?? '').trim();
        if (!name) { problems.push({ row, message: 'Project is missing' }); return; }
        const { metadata, errors } = projectMetadata(data);
        if (errors.length > 0) { problems.push({ row, message: errors.join('; ') }); return; }
        const key = name.toLowerCase();
        let plan = byName.get(key);
        if (!plan) {
            plan = { name, row, metadata: {}, towers: [] };
            byName.set(key, plan);
        }
        if (Object.keys(plan.metadata).length === 0) plan.metadata = metadata;
        const tower = (data.tower ?? '').trim();
        if (tower && !plan.towers.some((t) => t.name.toLowerCase() === tower.toLowerCase())) {
            plan.towers.push({ name: tower, row });
        }
    });
    return { projects: [...byName.values()], problems };
}

export interface InventoryCategory {
    id: string;
    name: string;
    parent_id: string | null;
}

export async function listCategories(): Promise<InventoryCategory[]> {
    const orgId = crmInventoryClient.getOrgId();
    const res = await crmInventoryClient.get<{ categories?: any[] }>(`/v1/inventory/settings/${orgId}`);
    return (res?.categories ?? []).map((c: any) => ({ id: c.id, name: c.name, parent_id: c.parent_id ?? null }));
}

const findCategory = (categories: InventoryCategory[], name: string, parentId: string | null) =>
    categories.find((c) => (c.parent_id ?? null) === parentId && c.name.trim().toLowerCase() === name.trim().toLowerCase());

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : 'Request failed');

/**
 * Creates each project (top-level category, with its metadata) and tower
 * (child category) that is not there yet. Existing ones are left as they are
 * and counted as skipped, so re-running the same sheet is harmless.
 */
export async function importProjects(projects: ProjectPlan[]): Promise<RecordImportResult> {
    const orgId = crmInventoryClient.getOrgId();
    const categories = await listCategories();
    const result: RecordImportResult = { created: 0, updated: 0, skipped: 0, problems: [] };
    const create = async (body: Record<string, unknown>) => {
        const created = await crmInventoryClient.post<any>(`/v1/inventory/settings/${orgId}/categories`, body);
        const category: InventoryCategory = { id: created?.id, name: String(body.name), parent_id: (body.parent_id as string) ?? null };
        categories.push(category);
        result.created += 1;
        return category;
    };
    for (const project of projects) {
        let parent = findCategory(categories, project.name, null);
        if (parent) {
            result.skipped += 1;
        } else {
            try {
                const body: Record<string, unknown> = { name: project.name };
                if (Object.keys(project.metadata).length > 0) body.metadata = project.metadata;
                parent = await create(body);
            } catch (err) {
                result.problems.push({ row: project.row, message: `Project "${project.name}": ${errorText(err)}` });
                continue;
            }
        }
        for (const tower of project.towers) {
            if (findCategory(categories, tower.name, parent.id)) { result.skipped += 1; continue; }
            try {
                await create({ name: tower.name, parent_id: parent.id });
            } catch (err) {
                result.problems.push({ row: tower.row, message: `Tower "${tower.name}": ${errorText(err)}` });
            }
        }
    }
    return result;
}

// ── Units ───────────────────────────────────────────────────────────────────

export const UNIT_PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Plot', 'Office', 'Retail', 'Warehouse', 'Other'] as const;

/** Unit attributes stored as numbers. */
const UNIT_NUMBER_KEYS = [
    'floor', 'bedrooms', 'bathrooms', 'built_up_area', 'plot_area', 'area_sqft', 'parking',
    'price_per_sqft', 'original_price', 'discount', 'final_price', 'commission_percent',
] as const;
/** Unit attributes stored as text. */
const UNIT_TEXT_KEYS = ['stack', 'view', 'facing', 'payment_plan'] as const;

export const UNIT_FIELDS: ImportField[] = [
    { key: 'project', label: 'Project', required: true, aliases: ['project name', 'development'] },
    { key: 'tower', label: 'Tower', aliases: ['building', 'block', 'phase'] },
    { key: 'unit_number', label: 'Unit number', required: true, aliases: ['unit', 'unit no', 'unit #', 'flat no', 'apartment no'] },
    { key: 'name', label: 'Name', aliases: ['unit name'] },
    { key: 'sku', label: 'SKU' },
    { key: 'property_type', label: 'Property type', aliases: ['type', 'unit type'] },
    { key: 'floor', label: 'Floor' },
    { key: 'stack', label: 'Stack' },
    { key: 'bedrooms', label: 'Bedrooms', aliases: ['beds', 'bhk'] },
    { key: 'bathrooms', label: 'Bathrooms', aliases: ['baths'] },
    { key: 'built_up_area', label: 'Built-up area', aliases: ['bua', 'built up area'] },
    { key: 'plot_area', label: 'Plot area' },
    { key: 'area_sqft', label: 'Area (sqft)', aliases: ['area', 'sqft'] },
    { key: 'view', label: 'View' },
    { key: 'facing', label: 'Facing' },
    { key: 'parking', label: 'Parking', aliases: ['parking spaces'] },
    { key: 'price_per_sqft', label: 'Price per sqft', aliases: ['rate per sqft'] },
    { key: 'original_price', label: 'Original price', aliases: ['list price', 'price'] },
    { key: 'discount', label: 'Discount' },
    { key: 'final_price', label: 'Final price', aliases: ['net price', 'selling price'] },
    { key: 'currency', label: 'Currency' },
    { key: 'payment_plan', label: 'Payment plan' },
    { key: 'commission_percent', label: 'Commission %', aliases: ['commission', 'commission percent'] },
];

export interface UnitImportRow {
    category_id: string;
    unit_number: string;
    name?: string;
    sku?: string;
    price?: number;
    attributes: Record<string, string | number>;
}

/**
 * Checks each unit row and resolves its category: the tower under the
 * project, or the project itself when the row has no tower. Projects and
 * towers must exist first (import them with the Projects type).
 */
export function prepareUnitRows(rows: Record<string, string>[], categories: InventoryCategory[]): PreparedRows<UnitImportRow> {
    const out: PreparedRows<UnitImportRow> = { items: [], problems: [] };
    rows.forEach((data, i) => {
        const row = sheetRow(i);
        const errors: string[] = [];
        const unitNumber = (data.unit_number ?? '').trim();
        if (!unitNumber) errors.push('Unit number is missing');
        else if (unitNumber.length > 60) errors.push('Unit number is longer than 60 characters');
        if (data.name && data.name.length > 255) errors.push('Name is longer than 255 characters');
        if (data.sku && data.sku.length > 100) errors.push('SKU is longer than 100 characters');

        let categoryId: string | null = null;
        const projectName = (data.project ?? '').trim();
        const towerName = (data.tower ?? '').trim();
        if (!projectName) {
            errors.push('Project is missing');
        } else {
            const project = findCategory(categories, projectName, null);
            if (!project) errors.push(`Project "${projectName}" does not exist yet`);
            else if (!towerName) categoryId = project.id;
            else {
                const tower = findCategory(categories, towerName, project.id);
                if (!tower) errors.push(`Tower "${towerName}" does not exist in ${project.name}`);
                else categoryId = tower.id;
            }
        }

        const attributes: Record<string, string | number> = {};
        for (const key of UNIT_NUMBER_KEYS) {
            if (!data[key]) continue;
            const n = toNumber(data[key]);
            const label = UNIT_FIELDS.find((f) => f.key === key)?.label ?? key;
            if (n === null || Number.isNaN(n) || n < 0) errors.push(`${label} must be a number`);
            else if (key === 'commission_percent' && n > 100) errors.push('Commission % must be between 0 and 100');
            else attributes[key] = n;
        }
        for (const key of UNIT_TEXT_KEYS) if (data[key]) attributes[key] = data[key];
        if (data.currency) {
            const currency = data.currency.trim().toUpperCase();
            if (CURRENCY_RE.test(currency)) attributes.currency = currency;
            else errors.push('Currency must be a 3-letter code such as AED');
        }
        if (data.property_type) {
            const match = UNIT_PROPERTY_TYPES.find((t) => t.toLowerCase() === data.property_type.trim().toLowerCase());
            if (match) attributes.property_type = match;
            else errors.push(`Property type must be one of ${UNIT_PROPERTY_TYPES.join(', ')}`);
        }

        if (errors.length > 0 || !categoryId) {
            out.problems.push({ row, message: errors.join('; ') });
            return;
        }
        const unit: UnitImportRow = { category_id: categoryId, unit_number: unitNumber, attributes };
        const price = unitPrice(attributes);
        if (price !== null) unit.price = price;
        if (data.name) unit.name = data.name;
        unit.sku = data.sku || (towerName ? `${towerName}-${unitNumber}` : unitNumber);
        out.items.push({ row, data: unit });
    });
    return out;
}

/** Final price; else original less discount (never below 0); else original. */
export function unitPrice(attributes: Record<string, string | number>): number | null {
    const final = attributes.final_price as number | undefined;
    const original = attributes.original_price as number | undefined;
    const discount = attributes.discount as number | undefined;
    if (final !== undefined) return final;
    if (original !== undefined && discount !== undefined) return Math.max(0, original - discount);
    if (original !== undefined) return original;
    return null;
}

/** The unit import endpoint's per-call limit. */
export const UNITS_PER_CALL = 2000;

interface UnitImportResponse {
    created?: number;
    skipped?: number;
    skipped_rows?: Array<{ row: number; unit_number: string; reason: string }>;
    errors?: Array<{ row: number; unit_number: string; error: string }>;
    aborted?: string;
}

export async function importUnits(prepared: PreparedRows<UnitImportRow>): Promise<RecordImportResult> {
    const orgId = crmInventoryClient.getOrgId();
    const result: RecordImportResult = { created: 0, updated: 0, skipped: 0, problems: [] };
    for (let start = 0; start < prepared.items.length; start += UNITS_PER_CALL) {
        const chunk = prepared.items.slice(start, start + UNITS_PER_CALL);
        const res = await crmInventoryClient.post<UnitImportResponse>(
            `/v1/inventory/property/${orgId}/units/import`,
            { rows: chunk.map((i) => i.data) },
        );
        const toSheet = (n: number) => chunk[n - 1]?.row ?? n;
        result.created += res?.created ?? 0;
        result.skipped += res?.skipped ?? 0;
        for (const s of res?.skipped_rows ?? []) {
            result.problems.push({ row: toSheet(s.row), message: `Unit ${s.unit_number} skipped: ${s.reason}` });
        }
        for (const e of res?.errors ?? []) {
            result.problems.push({ row: toSheet(e.row), message: `Unit ${e.unit_number}: ${e.error}` });
        }
        if (res?.aborted) {
            // Not tied to one sheet row (row 0): the rest of the file was not sent.
            result.problems.push({ row: 0, message: `Import stopped: ${res.aborted}` });
            break;
        }
    }
    return result;
}
