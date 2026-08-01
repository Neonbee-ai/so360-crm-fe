const env = (import.meta as any)?.env || {};
const win = typeof window !== 'undefined' ? (window as any) : {};

const CRM_API_ORIGIN = String(
  win.VITE_SO360_CRM_API || env.VITE_SO360_CRM_API || env.VITE_API_BASE_URL || 'http://localhost:3003'
).replace(/\/$/, '');

const BASE = `${CRM_API_ORIGIN}/v1/sales-targets`;

let _tenantId = '';
let _orgId = '';
let _accessToken = '';

export const salesTargetService = {
  setTenantId: (id: string) => { _tenantId = id; },
  setOrgId: (id: string) => { _orgId = id; },
  setAccessToken: (token: string) => { _accessToken = token; },

  headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Tenant-Id': _tenantId,
      'X-Org-Id': _orgId,
      Authorization: `Bearer ${_accessToken}`,
    };
  },

  async fetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers ?? {}) } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err?.message ?? res.statusText);
    }
    return res.json();
  },

  // ─── Task Types ────────────────────────────────────────────────────────

  listTaskTypes: () => salesTargetService.fetch<any[]>('/task-types'),

  createTaskType: (body: any) =>
    salesTargetService.fetch<any>('/task-types', { method: 'POST', body: JSON.stringify(body) }),

  updateTaskType: (id: string, body: any) =>
    salesTargetService.fetch<any>(`/task-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteTaskType: (id: string) =>
    salesTargetService.fetch<any>(`/task-types/${id}`, { method: 'DELETE' }),

  // ─── Targets ──────────────────────────────────────────────────────────

  listTargets: (params?: { owner_type?: string; owner_id?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return salesTargetService.fetch<any[]>(`/targets${qs ? `?${qs}` : ''}`);
  },

  createTarget: (body: any) =>
    salesTargetService.fetch<any>('/targets', { method: 'POST', body: JSON.stringify(body) }),

  deleteTarget: (id: string) =>
    salesTargetService.fetch<any>(`/targets/${id}`, { method: 'DELETE' }),

  // ─── Activity Log ──────────────────────────────────────────────────────

  logActivity: (body: { task_type_id: string; count: number; notes?: string }) =>
    salesTargetService.fetch<any>('/activities', { method: 'POST', body: JSON.stringify(body) }),

  // ─── Scorecard & Leaderboard ───────────────────────────────────────────

  getScorecard: (params?: { period?: string; rep_person_id?: string }) => {
    const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v)).toString();
    return salesTargetService.fetch<any>(`/scorecard${qs ? `?${qs}` : ''}`);
  },

  getLeaderboard: (period = 'week') =>
    salesTargetService.fetch<any>(`/leaderboard?period=${period}`),
};
