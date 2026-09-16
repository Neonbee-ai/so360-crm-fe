import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import {
  classifyTaskTypes,
  unlinkedLeadStages,
  buildLeadStageTaskTypePayload,
  buildCustomMetricTaskTypePayload,
  type MetricCatalog,
  type TaskTypeLite,
} from './metricCatalog';

/**
 * Regression guard for the "Create & Add to Plan" 400.
 *
 * POST /sales-targets/task-types 400'd because the FE never sent the
 * required `source` field (CreateTaskTypeDto has no default for it), while
 * `kind`/`description` had no matching DTO field at all and were silently
 * stripped by ValidationPipe's whitelist. Source-scan rather than a runtime
 * assertion, because the failure mode is "a required field is missing from
 * the object literal" — a fixture-based test could pass on a fixture that
 * carries the same bug.
 */
const pkgRoot = (() => {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'src', 'pages', 'targets', 'metricCatalog.ts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`crm-fe root not found above ${process.cwd()}`);
    dir = parent;
  }
})();
const metricCatalogSrc = readFileSync(
  join(pkgRoot, 'src', 'pages', 'targets', 'metricCatalog.ts'),
  'utf8',
);

describe('Given buildCustomMetricTaskTypePayload', () => {
  it('When called / Then the payload sets source: MANUAL', () => {
    const payload = buildCustomMetricTaskTypePayload({
      name: 'New Lead Collection',
      kind: 'COUNT',
      unit: 'count',
    });
    expect(payload.source).toBe('MANUAL');
    expect(payload.name).toBe('New Lead Collection');
    expect(payload.kind).toBe('COUNT');
    expect(payload.unit).toBe('count');
  });

  it('When unit is blank / Then it falls back to "count"', () => {
    const payload = buildCustomMetricTaskTypePayload({
      name: 'Referral Introductions',
      kind: 'SUM',
      unit: '',
    });
    expect(payload.unit).toBe('count');
  });

  it('Then the source file never builds a custom-metric createTaskType call without `source`', () => {
    // Guards the guard: if buildCustomMetricTaskTypePayload's return object
    // literal stops including `source` at all, this must fail loudly rather
    // than the 400 reappearing silently in production.
    const fnBody = metricCatalogSrc.slice(
      metricCatalogSrc.indexOf('export function buildCustomMetricTaskTypePayload'),
    );
    expect(fnBody).toMatch(/source:\s*'MANUAL'/);
  });
});

describe('Given buildLeadStageTaskTypePayload', () => {
  it('When called for a stage / Then it targets to_state, not transition_key', () => {
    const payload = buildLeadStageTaskTypePayload({ stage_id: 'qualified', name: 'Qualified' });
    expect(payload.source).toBe('FLOW_TRANSITION');
    expect(payload.flow_trigger).toEqual({ entity_type: 'lead', to_state: 'qualified' });
    expect((payload.flow_trigger as any).transition_key).toBeUndefined();
    expect(payload.unit).toBe('leads');
  });
});

const catalog = (over: Partial<MetricCatalog> = {}): MetricCatalog => ({
  stages_source: 'flow',
  lead_stage_metrics: [
    { stage_id: 'new', name: 'New', order: 0, linked: false, task_type_id: null },
    { stage_id: 'qualified', name: 'Qualified', order: 1, linked: true, task_type_id: 'tt-lead-qualified' },
  ],
  standard_metrics: [{ id: 'tt-std-1', name: 'Revenue' }],
  custom_metrics: [],
  ...over,
});

const taskTypes: TaskTypeLite[] = [
  { id: 'tt-lead-qualified', name: 'Qualified' },
  { id: 'tt-std-1', name: 'Revenue' },
  { id: 'tt-custom-1', name: 'Architect Referrals' },
];

describe('Given classifyTaskTypes', () => {
  it('When the catalog loaded / Then it buckets by lead-stage / standard / custom', () => {
    const grouped = classifyTaskTypes(catalog(), taskTypes);
    expect(grouped?.leadStage.map((t) => t.id)).toEqual(['tt-lead-qualified']);
    expect(grouped?.standard.map((t) => t.id)).toEqual(['tt-std-1']);
    expect(grouped?.custom.map((t) => t.id)).toEqual(['tt-custom-1']);
  });

  it('When the catalog failed to load / Then it returns null so the picker falls back to one flat list', () => {
    expect(classifyTaskTypes(null, taskTypes)).toBeNull();
    expect(classifyTaskTypes(undefined, taskTypes)).toBeNull();
  });

  it('When a task type is a linked lead-stage AND happens to be is_predefined / Then lead-stage wins over standard', () => {
    // A predefined starter-pack task type could in principle also be the one
    // linked to a stage; the picker must not show it twice.
    const c = catalog({ standard_metrics: [{ id: 'tt-lead-qualified', name: 'Qualified' }] });
    const grouped = classifyTaskTypes(c, taskTypes);
    expect(grouped?.leadStage.map((t) => t.id)).toEqual(['tt-lead-qualified']);
    expect(grouped?.standard.map((t) => t.id)).toEqual([]);
  });
});

describe('Given unlinkedLeadStages', () => {
  it('When some stages already have a metric / Then only the unlinked ones are returned', () => {
    expect(unlinkedLeadStages(catalog()).map((s) => s.stage_id)).toEqual(['new']);
  });

  it('When the catalog failed to load / Then it returns an empty array, not undefined', () => {
    expect(unlinkedLeadStages(null)).toEqual([]);
  });

  it('When the catalog has no lead_stage_metrics field / Then it returns an empty array', () => {
    expect(unlinkedLeadStages({} as any)).toEqual([]);
  });
});
