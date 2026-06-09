import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import {
  leadsApi,
  dealsApi,
  tasksApi,
  notesApi,
  crmService,
  activitiesApi,
} from './crmService';

function mockSuccess(data: any) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  });
}

function mockError(status: number, body: any) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockNetworkError() {
  fetchMock.mockRejectedValueOnce(new TypeError('Network error'));
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('crmService — leadsApi', () => {
  describe('Given the backend returns leads', () => {
    it('When getAll is called / Then maps NEW backend status to New on the frontend', async () => {
      mockSuccess([
        { id: 'l1', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('New');
    });

    it('When getAll is called / Then maps CLOSED_WON to Converted', async () => {
      mockSuccess([
        { id: 'l2', status: 'CLOSED_WON', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Converted');
    });

    it('When getAll is called / Then maps CLOSED_LOST to Lost', async () => {
      mockSuccess([
        { id: 'l3', status: 'CLOSED_LOST', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Lost');
    });

    it('When getById is called / Then returns the lead with mapped status', async () => {
      mockSuccess({ id: 'l1', status: 'QUALIFIED', notes: [], documents: [], deals: [], tasks: [], activities: [] });
      const lead = await leadsApi.getById('l1');
      expect(lead.status).toBe('Qualified');
    });
  });

  describe('Given the backend returns an error', () => {
    it('When getAll fails with 404 / Then throws with message', async () => {
      mockError(404, { message: 'Not found' });
      await expect(leadsApi.getAll()).rejects.toThrow();
    });

    it('When a network error occurs / Then throws a network error', async () => {
      mockNetworkError();
      await expect(leadsApi.getAll()).rejects.toThrow();
    });
  });

  describe('Given a lead is created', () => {
    it('When create is called / Then sends the lead data to the backend and maps the result', async () => {
      mockSuccess({ id: 'l-new', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] });
      const lead = await leadsApi.create({ company_name: 'NewCo', status: 'New' } as any);
      expect(lead.id).toBe('l-new');
      expect(lead.status).toBe('New');
    });
  });

  describe('Given a lead is updated', () => {
    it('When update is called / Then sends the update and returns the updated lead', async () => {
      mockSuccess({ id: 'l1', status: 'QUALIFIED', notes: [], documents: [], deals: [], tasks: [], activities: [] });
      const updated = await leadsApi.update('l1', { status: 'Qualified' } as any);
      expect(updated.status).toBe('Qualified');
    });
  });
});

describe('crmService — dealsApi', () => {
  describe('Given the backend returns deals', () => {
    it('When getAll is called / Then returns a list of deals', async () => {
      mockSuccess([{ id: 'd1', name: 'Big Deal', stage: 'Qualified', value: 50000 }]);
      const deals = await dealsApi.getAll();
      expect(deals).toHaveLength(1);
      expect(deals[0].id).toBe('d1');
    });

    it('When getById is called / Then returns the matching deal', async () => {
      mockSuccess({ id: 'd1', name: 'Big Deal', stage: 'Qualified' });
      const deal = await dealsApi.getById('d1');
      expect(deal.id).toBe('d1');
    });
  });

  describe('Given a deal is created', () => {
    it('When create is called / Then sends deal data and returns the new deal', async () => {
      mockSuccess({ id: 'd-new', name: 'New Deal', stage: 'Lead' });
      const deal = await dealsApi.create({ name: 'New Deal', company: 'Acme', value: 1000 } as any);
      expect(deal.id).toBe('d-new');
    });
  });
});

describe('crmService — tasksApi', () => {
  describe('Given the backend has tasks', () => {
    it('When getAll is called / Then returns tasks', async () => {
      mockSuccess([{ id: 't1', title: 'Call client', status: 'OPEN' }]);
      const tasks = await tasksApi.getAll();
      expect(tasks[0].title).toBe('Call client');
    });
  });

  describe('Given a task is created', () => {
    it('When create is called / Then returns the new task', async () => {
      mockSuccess({ id: 't-new', title: 'New task', status: 'OPEN' });
      const task = await tasksApi.create({ title: 'New task', status: 'OPEN' } as any);
      expect(task.id).toBe('t-new');
    });
  });
});

describe('crmService — dashboard stats', () => {
  describe('Given the backend returns stats', () => {
    it('When getDashboardStats is called / Then returns stats object', async () => {
      // Backend format expected by the analytics/dashboard endpoint
      const analyticsStats = {
        financials: { totalRevenue: 1000, pipelineValue: 5000, avgDealSize: 2000 },
        metrics: { winRate: 60 },
        counts: { totalLeads: 5, totalDeals: 3 },
        chartData: { values: [], labels: [] },
      };
      mockSuccess(analyticsStats);  // /analytics/dashboard
      mockSuccess([]);               // /analytics/performance
      mockSuccess([]);               // getTasks
      const result = await crmService.getDashboardStats({ period: 'monthly' });
      expect(result.financials.totalRevenue).toBe(1000);
    });
  });
});

describe('crmService — activitiesApi', () => {
  describe('Given the getAllByLead endpoint returns activities', () => {
    it('When getAllByLead is called / Then maps and returns Activity[]', async () => {
      mockSuccess([
        { id: 'a1', type: 'CALL', notes: 'Intro call', date: '2025-01-05T10:00:00Z', created_at: '2025-01-05T10:00:00Z', author: null },
      ]);
      const result = await activitiesApi.getAllByLead('lead-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('When getAllByLead fails / Then throws an error', async () => {
      mockError(500, { message: 'Server error' });
      await expect(activitiesApi.getAllByLead('lead-1')).rejects.toThrow();
    });
  });

  describe('Given the paginated endpoint returns { data, total }', () => {
    it('When getAllByLeadPaginated is called / Then requests the correct URL with limit and offset', async () => {
      mockSuccess({ data: [], total: 0 });
      await activitiesApi.getAllByLeadPaginated('lead-1', 7, 0);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/activities/lead/lead-1');
      expect(url).toContain('limit=7');
      expect(url).toContain('offset=0');
    });

    it('When getAllByLeadPaginated is called with offset / Then passes offset in the URL', async () => {
      mockSuccess({ data: [], total: 0 });
      await activitiesApi.getAllByLeadPaginated('lead-1', 20, 7);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('limit=20');
      expect(url).toContain('offset=7');
    });

    it('When backend returns activities and total / Then maps data and preserves total', async () => {
      const raw = [
        { id: 'a1', type: 'CALL', notes: 'Call note', date: '2025-01-05T10:00:00Z', created_at: '2025-01-05T10:00:00Z', author: null },
        { id: 'a2', type: 'EMAIL', notes: 'Email note', date: '2025-01-06T10:00:00Z', created_at: '2025-01-06T10:00:00Z', author: null },
      ];
      mockSuccess({ data: raw, total: 42 });
      const result = await activitiesApi.getAllByLeadPaginated('lead-1', 7, 0);
      expect(result.total).toBe(42);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('a1');
      expect(result.data[1].id).toBe('a2');
    });

    it('When backend returns empty data / Then returns { data: [], total: 0 } gracefully', async () => {
      mockSuccess({ data: null, total: null });
      const result = await activitiesApi.getAllByLeadPaginated('lead-1', 7, 0);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('When the request fails / Then throws an error', async () => {
      mockError(403, { message: 'Forbidden' });
      await expect(activitiesApi.getAllByLeadPaginated('lead-1', 7, 0)).rejects.toThrow();
    });
  });

  describe('Given crmService.getActivitiesByLeadIdPaginated delegates correctly', () => {
    it('When called / Then returns the same result as activitiesApi.getAllByLeadPaginated', async () => {
      mockSuccess({ data: [{ id: 'a1', type: 'CALL', notes: 'n', date: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', author: null }], total: 1 });
      const result = await crmService.getActivitiesByLeadIdPaginated('lead-1', 7, 0);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('a1');
    });
  });
});
