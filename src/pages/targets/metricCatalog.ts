/**
 * Pure logic for the Target Plan "Add Metric" picker.
 *
 * Lead Stages are NOT stored in a CRM-owned stages table — they are a live
 * projection of the Flow module's CRM lead flow definition (Flow is the
 * source of truth; see so360-crm-be SettingsService.getLeadStages). A Lead
 * Stage Metric is therefore just a FLOW_TRANSITION task type keyed on
 * `flow_trigger.to_state` rather than `transition_key`, so any transition
 * landing on that stage counts — a lead can reach "Qualified" via more than
 * one path.
 */

export interface TaskTypeLite {
  id: string;
  name: string;
  is_predefined?: boolean;
  source?: string;
  kind?: string;
  unit?: string;
  flow_trigger?: { entity_type?: string; to_state?: string } | null;
}

export interface LeadStageMetric {
  stage_id: string;
  name: string;
  color?: string;
  order: number;
  linked: boolean;
  task_type_id: string | null;
}

export interface MetricCatalog {
  stages_source: 'flow' | 'default';
  lead_stage_metrics: LeadStageMetric[];
  standard_metrics: TaskTypeLite[];
  custom_metrics: TaskTypeLite[];
}

/**
 * Splits the flat taskTypes list into the three picker groups. Classifies by
 * task type ID membership in the catalog's own buckets rather than
 * re-deriving flow_trigger/is_predefined rules here, so this stays correct
 * even if the backend's classification rules change.
 */
export function classifyTaskTypes(
  catalog: MetricCatalog | null | undefined,
  taskTypes: TaskTypeLite[],
): { leadStage: TaskTypeLite[]; standard: TaskTypeLite[]; custom: TaskTypeLite[] } | null {
  if (!catalog) return null;

  const leadStageIds = new Set(
    (catalog.lead_stage_metrics ?? [])
      .filter((s) => s.linked)
      .map((s) => s.task_type_id),
  );
  const standardIds = new Set((catalog.standard_metrics ?? []).map((t) => t.id));

  return {
    leadStage: taskTypes.filter((t) => leadStageIds.has(t.id)),
    standard: taskTypes.filter((t) => standardIds.has(t.id) && !leadStageIds.has(t.id)),
    custom: taskTypes.filter((t) => !leadStageIds.has(t.id) && !standardIds.has(t.id)),
  };
}

export function unlinkedLeadStages(catalog: MetricCatalog | null | undefined): LeadStageMetric[] {
  return (catalog?.lead_stage_metrics ?? []).filter((s) => !s.linked);
}

/**
 * The createTaskType payload for wiring up a Lead Stage as a metric.
 * `to_state` (not `transition_key`) is deliberate — see module doc comment.
 */
export function buildLeadStageTaskTypePayload(stage: { stage_id: string; name: string }) {
  return {
    name: stage.name,
    source: 'FLOW_TRANSITION' as const,
    flow_trigger: { entity_type: 'lead', to_state: stage.stage_id },
    unit: 'leads',
    kind: 'COUNT' as const,
    description: `Leads entering the "${stage.name}" stage`,
  };
}

/**
 * The createTaskType payload for a user-defined Custom Metric.
 *
 * `source: 'MANUAL'` is load-bearing: CreateTaskTypeDto requires `source`
 * (no default), and MANUAL is the only source that doesn't also require a
 * flow_trigger/crm_table_rule. Omitting it is exactly the bug that made
 * "Create & Add to Plan" 400 — guarded by metricCatalog.bdd.test.ts.
 */
export function buildCustomMetricTaskTypePayload(input: {
  name: string;
  kind: 'COUNT' | 'SUM' | 'TOUCHPOINT';
  unit: string;
}) {
  return {
    name: input.name,
    source: 'MANUAL' as const,
    kind: input.kind,
    unit: input.unit || 'count',
    description: `Custom ${input.kind} metric`,
  };
}
