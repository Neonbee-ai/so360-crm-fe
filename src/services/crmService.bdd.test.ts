import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import {
  leadsApi,
  dealsApi,
  tasksApi,
  notesApi,
  crmService,
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
    it('When getAll is called / Then maps NEW backend status to Open on the frontend', async () => {
      mockSuccess([
        { id: 'l1', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Open');
    });

    it('When getAll is called / Then maps CLOSED_WON to Won', async () => {
      mockSuccess([
        { id: 'l2', status: 'CLOSED_WON', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Won');
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
      const lead = await leadsApi.create({ company_name: 'NewCo', status: 'Open' } as any);
      expect(lead.id).toBe('l-new');
      expect(lead.status).toBe('Open');
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
      mockSuccess([{ id: 't1', title: 'Call client', status: 'Open' }]);
      const tasks = await tasksApi.getAll();
      expect(tasks[0].title).toBe('Call client');
    });
  });

  describe('Given a task is created', () => {
    it('When create is called / Then returns the new task', async () => {
      mockSuccess({ id: 't-new', title: 'New task', status: 'Open' });
      const task = await tasksApi.create({ title: 'New task', status: 'Open' } as any);
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
