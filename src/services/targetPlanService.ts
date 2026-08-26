/**
 * Targets & Performance API client.
 *
 * Kept beside salesTargetService rather than merged into it: that service
 * still backs the original scorecard/leaderboard routes, which stay working
 * for targets that have no plan attached.
 */

const env = (import.meta as any)?.env || {};
const win = typeof window !== 'undefined' ? (window as any) : {};

const CRM_API_ORIGIN = String(
  win.VITE_SO360_CRM_API ||
    env.VITE_SO360_CRM_API ||
    env.VITE_API_BASE_URL ||
    'http://localhost:3003',
).replace(/\/$/, '');

const BASE = `${CRM_API_ORIGIN}/v1`;

let _tenantId = '';
let _orgId = '';
let _accessToken = '';

export type TargetStatus =
  | 'on_track'
  | 'at_risk'
  | 'behind'
  | 'achieved'
  | 'exceeded';

export interface Projection {
  projected: number | null;
  projectedAttainment: number | null;
  projectedStatus: TargetStatus | null;
  projectedGap: number | null;
  projectable: boolean;
  suppressedReason: 'too_early' | null;
}

export interface MetricEntry {
  target_line_id: string;
  task_type_id: string;
  metric_name: string;
  unit: string;
  kind: string;
  dimension_key?: string | null;
  dimension_value?: string | null;
  actual: number;
  target: number;
  remaining: number;
  attainment: number;
  status: TargetStatus;
  status_label: string;
  elapsed_fraction: number;
  days_remaining: number;
  projection: Projection;
  period_start: string;
  period_end: string;
}

export interface TrendPoint {
  period_start: string;
  period_end: string;
  actual: number;
  target_value: number;
  attainment: number | null;
  plan_changed?: boolean;
}

export interface Overview {
  person_id: string;
  plans: any[];
  headline: MetricEntry | null;
  trend: {
    points: TrendPoint[];
    average: number | null;
    best: TrendPoint | null;
    direction: 'up' | 'down' | 'flat' | null;
    planChanges: number;
  } | null;
  metrics: MetricEntry[];
  needs_attention: Array<{
    target_line_id: string;
    metric_name: string;
    dimension_value?: string | null;
    actual: number;
    target: number;
    gap: number;
    days_remaining: number;
    status: { status: TargetStatus };
  }>;
}

export const targetPlanService = {
  setTenantId: (id: string) => {
    _tenantId = id;
  },
  setOrgId: (id: string) => {
    _orgId = id;
  },
  setAccessToken: (token: string) => {
    _accessToken = token;
  },

  headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Tenant-Id': _tenantId,
      'X-Org-Id': _orgId,
      Authorization: `Bearer ${_accessToken}`,
    };
  },

  async fetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ message: res.statusText }));
      throw new Error(err?.message ?? res.statusText);
    }
    return res.json();
  },

  // ─── Plans ──────────────────────────────────────────────────────────────

  listPlans: (params?: {
    owner_id?: string;
    status?: string;
    active_on?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as any,
    ).toString();
    return targetPlanService.fetch<any[]>(`/target-plans${qs ? `?${qs}` : ''}`);
  },

  getPlan: (id: string) =>
    targetPlanService.fetch<any>(`/target-plans/${id}`),

  createPlan: (body: any) =>
    targetPlanService.fetch<any>('/target-plans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePlan: (id: string, body: any) =>
    targetPlanService.fetch<any>(`/target-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deletePlan: (id: string) =>
    targetPlanService.fetch<any>(`/target-plans/${id}`, { method: 'DELETE' }),

  updatePeriodValue: (periodId: string, body: any) =>
    targetPlanService.fetch<any>(`/target-plans/periods/${periodId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  allocate: (planId: string, body: any) =>
    targetPlanService.fetch<any>(`/target-plans/${planId}/allocate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ─── Visibility ─────────────────────────────────────────────────────────

  myOverview: () => targetPlanService.fetch<Overview>('/target-plans/me/overview'),

  overviewFor: (personId: string) =>
    targetPlanService.fetch<Overview>(`/target-plans/overview/${personId}`),

  myHistory: (limit = 12) =>
    targetPlanService.fetch<any>(`/target-plans/me/history?limit=${limit}`),

  historyFor: (personId: string, limit = 12) =>
    targetPlanService.fetch<any>(
      `/target-plans/history/${personId}?limit=${limit}`,
    ),

  teamScorecard: (personIds: string[]) =>
    targetPlanService.fetch<any>(
      `/target-plans/team/scorecard?person_ids=${personIds.join(',')}`,
    ),

  // ─── Settings ───────────────────────────────────────────────────────────

  getThresholds: () =>
    targetPlanService.fetch<any>('/target-plans/settings/thresholds'),

  updateThresholds: (body: any) =>
    targetPlanService.fetch<any>('/target-plans/settings/thresholds', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  provisionPacks: (industryKey?: string) =>
    targetPlanService.fetch<any>(
      `/target-plans/settings/provision-packs${industryKey ? `?industry_key=${industryKey}` : ''}`,
      { method: 'POST' },
    ),

  // ─── Channels ───────────────────────────────────────────────────────────

  listChannels: (includeInactive = false) =>
    targetPlanService.fetch<any[]>(
      `/settings/touchpoint-channels${includeInactive ? '?include_inactive=true' : ''}`,
    ),

  createChannel: (body: any) =>
    targetPlanService.fetch<any>('/settings/touchpoint-channels', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateChannel: (id: string, body: any) =>
    targetPlanService.fetch<any>(`/settings/touchpoint-channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteChannel: (id: string) =>
    targetPlanService.fetch<any>(`/settings/touchpoint-channels/${id}`, {
      method: 'DELETE',
    }),

  importChannelsFromLeadSources: () =>
    targetPlanService.fetch<any>(
      '/settings/touchpoint-channels/import-from-lead-sources',
      { method: 'POST' },
    ),

  // ─── Measurement (P2) ───────────────────────────────────────────────────

  myMeasurement: () =>
    targetPlanService.fetch<any>('/target-plans/me/measurement'),

  measurementFor: (personId: string) =>
    targetPlanService.fetch<any>(`/target-plans/measurement/${personId}`),

  listLossReasons: () =>
    targetPlanService.fetch<any[]>('/target-plans/settings/loss-reasons'),

  createLossReason: (body: any) =>
    targetPlanService.fetch<any>('/target-plans/settings/loss-reasons', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLossReason: (id: string, body: any) =>
    targetPlanService.fetch<any>(`/target-plans/settings/loss-reasons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  logManualTouchpoint: (body: {
    channel: string;
    client_partner_id?: string;
    client_lead_id?: string;
    occurred_at?: string;
  }) =>
    targetPlanService.fetch<any>('/touchpoints/manual', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  touchpointQuarantine: () =>
    targetPlanService.fetch<any[]>('/touchpoints/quarantine'),

  replayQuarantine: () =>
    targetPlanService.fetch<any>('/touchpoints/quarantine/replay', {
      method: 'POST',
    }),

  // ─── Goal linkage (P3) ──────────────────────────────────────────────────

  linkedGoal: (planId: string) =>
    targetPlanService.fetch<any>(`/target-plans/${planId}/goal`),

  syncGoal: (planId: string) =>
    targetPlanService.fetch<any>(`/target-plans/${planId}/goal/sync`, {
      method: 'POST',
    }),

  goalSyncFailures: () =>
    targetPlanService.fetch<any[]>('/target-plans/goal-sync/failures'),

  // ─── Management layer (P4) ──────────────────────────────────────────────

  listTemplates: () =>
    targetPlanService.fetch<any[]>('/target-management/templates'),

  createTemplate: (body: any) =>
    targetPlanService.fetch<any>('/target-management/templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  assignTemplate: (id: string, body: any) =>
    targetPlanService.fetch<any>(`/target-management/templates/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listReviews: (params?: { person_id?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as any,
    ).toString();
    return targetPlanService.fetch<any[]>(
      `/target-management/reviews${qs ? `?${qs}` : ''}`,
    );
  },

  createReview: (body: any) =>
    targetPlanService.fetch<any>('/target-management/reviews', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateReview: (id: string, body: any) =>
    targetPlanService.fetch<any>(`/target-management/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  finalizeReview: (id: string) =>
    targetPlanService.fetch<any>(`/target-management/reviews/${id}/finalize`, {
      method: 'POST',
    }),

  listIncentiveRules: () =>
    targetPlanService.fetch<any[]>('/target-management/incentive-rules'),

  createIncentiveRule: (body: any) =>
    targetPlanService.fetch<any>('/target-management/incentive-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  calculateIncentives: (personId: string, start: string, end: string) =>
    targetPlanService.fetch<any>(
      `/target-management/incentives/${personId}?period_start=${start}&period_end=${end}`,
    ),
};
