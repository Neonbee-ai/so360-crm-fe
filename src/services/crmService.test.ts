import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env before importing the module
// The crmService module reads import.meta.env at module level

// We need to mock fetch globally before the module is imported
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Now import the module (it will use our mocked fetch)
import {
  leadsApi,
  dealsApi,
  tasksApi,
  notesApi,
  documentsApi,
  customersApi,
  activitiesApi,
  settingsApi,
  crmService,
} from './crmService';

// Helper to create a successful fetch response
function mockFetchSuccess(data: any) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  });
}

// Helper to create an error fetch response with JSON body
function mockFetchErrorJson(status: number, body: { message?: string; error?: string }) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// Helper to create an error fetch response with text body
function mockFetchErrorText(status: number, text: string) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  });
}

// Helper to create a network error
function mockFetchNetworkError() {
  fetchMock.mockRejectedValueOnce(new TypeError('Network error'));
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// LEADS API
// ============================================================================
describe('Given leadsApi', () => {
  describe('Given getAll', () => {
    it('When action / Then fetches leads and maps status from backend format', async () => {
      const apiLeads = [
        {
          id: 'lead-1',
          company_name: 'Acme',
          contact_name: 'John',
          email: 'john@acme.com',
          status: 'NEW',
          owner_id: 'u-1',
          notes: [],
          documents: [],
          deals: [],
          tasks: [],
          activities: [],
        },
      ];
      mockFetchSuccess(apiLeads);

      const leads = await leadsApi.getAll();
      expect(leads).toHaveLength(1);
      expect(leads[0].status).toBe('New'); // NEW -> New
      expect(leads[0].contact_email).toBe('john@acme.com');
    });

    it('When action / Then maps QUALIFIED status correctly', async () => {
      mockFetchSuccess([
        { id: 'lead-2', status: 'QUALIFIED', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Qualified');
    });

    it('When action / Then maps CLOSED_WON status to Converted', async () => {
      mockFetchSuccess([
        { id: 'lead-3', status: 'CLOSED_WON', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('Converted');
    });

    it('When action / Then preserves unknown status as-is', async () => {
      mockFetchSuccess([
        { id: 'lead-4', status: 'CUSTOM_STATUS', notes: [], documents: [], deals: [], tasks: [], activities: [] },
      ]);
      const leads = await leadsApi.getAll();
      expect(leads[0].status).toBe('CUSTOM_STATUS');
    });

    it('When action / Then passes query parameters to the request', async () => {
      mockFetchSuccess([]);
      await leadsApi.getAll({ skip: 0, take: 10, q: 'test' });

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('skip=0');
      expect(calledUrl).toContain('take=10');
      expect(calledUrl).toContain('q=test');
    });

    it('When action / Then maps FE status param to BE status in request', async () => {
      mockFetchSuccess([]);
      await leadsApi.getAll({ status: 'New' });

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('status=new');
    });
  });

  describe('Given create', () => {
    it('When action / Then creates a lead and returns mapped result', async () => {
      const apiLead = {
        id: 'lead-new',
        company_name: 'NewCo',
        status: 'NEW',
        notes: [],
        documents: [],
        deals: [],
        tasks: [],
        activities: [],
      };
      mockFetchSuccess(apiLead);

      const lead = await leadsApi.create({ company_name: 'NewCo' });
      expect(lead.id).toBe('lead-new');
      expect(lead.status).toBe('New');

      // Verify POST method
      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
    });
  });

  describe('Given getById', () => {
    it('When action / Then fetches a single lead by ID', async () => {
      mockFetchSuccess({
        id: 'lead-1',
        status: 'NEGOTIATION',
        notes: [],
        documents: [],
        deals: [],
        tasks: [],
        activities: [],
      });

      const lead = await leadsApi.getById('lead-1');
      expect(lead.id).toBe('lead-1');
      expect(lead.status).toBe('Negotiation'); // NEGOTIATION -> Negotiation
    });
  });

  describe('Given delete', () => {
    it('When action / Then sends DELETE request', async () => {
      mockFetchSuccess({});
      await leadsApi.delete('lead-1');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/leads/lead-1');
      expect(options.method).toBe('DELETE');
    });
  });
});

// ============================================================================
// DEALS API
// ============================================================================
describe('Given dealsApi', () => {
  describe('Given getAll', () => {
    it('When action / Then fetches deals and maps values', async () => {
      mockFetchSuccess([
        {
          id: 'deal-1',
          name: 'Big Deal',
          value: '50000',
          stage: 'QUALIFIED',
          owner_id: 'u-1',
          notes: [],
          documents: [],
          activities: [],
        },
      ]);

      const deals = await dealsApi.getAll();
      expect(deals).toHaveLength(1);
      expect(deals[0].value).toBe(50000);
      expect(deals[0].stage).toBe('Qualified'); // QUALIFIED -> Qualified
    });

    it('When action / Then handles deal with invalid value', async () => {
      mockFetchSuccess([
        { id: 'deal-2', value: 'not-a-number', notes: [], documents: [], activities: [] },
      ]);
      const deals = await dealsApi.getAll();
      expect(deals[0].value).toBe(0);
    });
  });

  describe('Given getPipeline', () => {
    it('When action / Then handles array format response', async () => {
      const stages = [
        { id: 's-1', name: 'Lead', deals: [{ id: 'd-1', value: '100', notes: [], documents: [], activities: [] }] },
        { id: 's-2', name: 'Won', deals: [] },
      ];
      mockFetchSuccess(stages);

      const pipeline = await dealsApi.getPipeline();
      expect(pipeline.stages).toHaveLength(2);
      expect(pipeline.stages[0].deals[0].value).toBe(100);
    });

    it('When action / Then handles object format response with stages property', async () => {
      const data = {
        stages: [
          { id: 's-1', name: 'Lead', deals: [] },
        ],
      };
      mockFetchSuccess(data);

      const pipeline = await dealsApi.getPipeline();
      expect(pipeline.stages).toHaveLength(1);
    });
  });

  describe('Given create', () => {
    it('When action / Then creates a deal', async () => {
      mockFetchSuccess({
        id: 'deal-new',
        name: 'New Deal',
        value: '1000',
        notes: [],
        documents: [],
        activities: [],
      });

      const deal = await dealsApi.create({ name: 'New Deal', value: 1000 });
      expect(deal.id).toBe('deal-new');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
    });
  });

  describe('Given delete', () => {
    it('When action / Then sends DELETE request', async () => {
      mockFetchSuccess({});
      await dealsApi.delete('deal-1');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/deals/deal-1');
      expect(options.method).toBe('DELETE');
    });
  });
});

// ============================================================================
// TASKS API
// ============================================================================
describe('Given tasksApi', () => {
  describe('Given getAll', () => {
    it('When action / Then fetches tasks and capitalizes status', async () => {
      mockFetchSuccess([
        { id: 'task-1', title: 'Follow up', status: 'open', assignee_id: 'u-1' },
        { id: 'task-2', title: 'Call client', status: 'done', assignee_id: 'u-2' },
      ]);

      const tasks = await tasksApi.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].status).toBe('OPEN');
      expect(tasks[1].status).toBe('DONE');
    });

    it('When action / Then defaults status to Open when missing', async () => {
      mockFetchSuccess([{ id: 'task-3', title: 'No status' }]);
      const tasks = await tasksApi.getAll();
      expect(tasks[0].status).toBe('OPEN');
    });

    it('When action / Then handles empty status string', async () => {
      mockFetchSuccess([{ id: 'task-4', title: 'Empty status', status: '' }]);
      const tasks = await tasksApi.getAll();
      expect(tasks[0].status).toBe('OPEN');
    });
  });

  describe('Given create', () => {
    it('When action / Then creates a task and maps result', async () => {
      mockFetchSuccess({ id: 'task-new', title: 'New', status: 'open' });
      const task = await tasksApi.create({ title: 'New' });
      expect(task.id).toBe('task-new');
      expect(task.status).toBe('OPEN');
    });
  });

  describe('Given update', () => {
    it('When action / Then updates a task', async () => {
      mockFetchSuccess({ id: 'task-1', title: 'Updated', status: 'done' });
      const task = await tasksApi.update('task-1', { title: 'Updated' });
      expect(task.title).toBe('Updated');
      expect(task.status).toBe('DONE');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('PATCH');
    });
  });

  describe('Given bulkUpdate', () => {
    it('When action / Then sends bulk update request', async () => {
      mockFetchSuccess({ updated: 3 });
      const result = await tasksApi.bulkUpdate({
        ids: ['t-1', 't-2', 't-3'],
        data: { status: 'done' },
      });
      expect(result.updated).toBe(3);
    });
  });
});

// ============================================================================
// NOTES API
// ============================================================================
describe('Given notesApi', () => {
  describe('Given getAllByLead', () => {
    it('When action / Then fetches notes for a lead and resolves author', async () => {
      mockFetchSuccess([
        { id: 'note-1', content: 'Test note', author_id: 'u-1' },
      ]);

      const notes = await notesApi.getAllByLead('lead-1');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('Test note');
      expect(notes[0].author).toBeDefined();
      expect(notes[0].author.id).toBe('u-1');
    });
  });

  describe('Given getAllByDeal', () => {
    it('When action / Then fetches notes for a deal', async () => {
      mockFetchSuccess([
        { id: 'note-2', content: 'Deal note', author: { id: 'u-1', full_name: 'Alice' } },
      ]);

      const notes = await notesApi.getAllByDeal('deal-1');
      expect(notes).toHaveLength(1);
      expect(notes[0].author.full_name).toBe('Alice');
    });
  });

  describe('Given create', () => {
    it('When action / Then creates a note', async () => {
      mockFetchSuccess({ id: 'note-new', content: 'New note', author_id: 'u-1' });
      const note = await notesApi.create({ content: 'New note', lead_id: 'lead-1' });
      expect(note.id).toBe('note-new');
    });
  });

  describe('Given delete', () => {
    it('When action / Then sends DELETE request', async () => {
      mockFetchSuccess(undefined);
      // The delete will try to parse text as JSON and may throw,
      // but let's test with proper empty response
      mockFetchSuccess.length; // reset
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      });

      // This will throw because of JSON.parse(''), but that's expected behavior
      // Let's test a successful delete that returns valid JSON
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      });

      await notesApi.delete('note-1');
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/notes/note-1');
      expect(options.method).toBe('DELETE');
    });
  });
});

// ============================================================================
// DOCUMENTS API
// ============================================================================
describe('Given documentsApi', () => {
  describe('Given getAllByLead', () => {
    it('When action / Then fetches documents for a lead and resolves uploader', async () => {
      mockFetchSuccess([
        {
          id: 'doc-1',
          name: 'contract.pdf',
          uploaded_by_id: 'u-1',
          uploaded_at: '2026-01-01',
          created_at: '2026-01-01',
        },
      ]);

      const docs = await documentsApi.getAllByLead('lead-1');
      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('contract.pdf');
      expect(docs[0].uploaded_by).toBeDefined();
      expect(docs[0].uploaded_by.id).toBe('u-1');
    });
  });

  describe('Given getAllByDeal', () => {
    it('When action / Then fetches documents for a deal', async () => {
      mockFetchSuccess([
        { id: 'doc-2', name: 'proposal.pdf', uploaded_by: { id: 'u-2', full_name: 'Bob' } },
      ]);

      const docs = await documentsApi.getAllByDeal('deal-1');
      expect(docs).toHaveLength(1);
      expect(docs[0].uploaded_by.full_name).toBe('Bob');
    });
  });
});

// ============================================================================
// CUSTOMERS API
// ============================================================================
describe('Given customersApi', () => {
  describe('Given getAll', () => {
    it('When action / Then fetches customers', async () => {
      mockFetchSuccess([
        { id: 'cust-1', company_name: 'TestCo', type: 'customer' },
      ]);

      const customers = await customersApi.getAll();
      expect(customers).toHaveLength(1);
    });

    it('When action / Then joins customer_ids array into comma-separated string', async () => {
      mockFetchSuccess([]);
      await customersApi.getAll({ customer_ids: ['id-1', 'id-2', 'id-3'] });

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('customer_ids=id-1%2Cid-2%2Cid-3');
    });

    it('When action / Then omits customer_ids when array is empty', async () => {
      mockFetchSuccess([]);
      await customersApi.getAll({ customer_ids: [] });

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).not.toContain('customer_ids');
    });
  });
});

// ============================================================================
// ACTIVITIES API
// ============================================================================
describe('Given activitiesApi', () => {
  describe('Given getAllByLead', () => {
    it('When action / Then fetches activities for a lead', async () => {
      mockFetchSuccess([
        { id: 'act-1', type: 'CALL', notes: 'Called client', author_id: 'u-1' },
      ]);

      const activities = await activitiesApi.getAllByLead('lead-1');
      expect(activities).toHaveLength(1);
      expect(activities[0].notes).toBe('Called client');
      expect(activities[0].author.id).toBe('u-1');
    });

    it('When action / Then uses content field as notes fallback', async () => {
      mockFetchSuccess([
        { id: 'act-2', type: 'EMAIL', content: 'Sent proposal', author_id: 'u-1' },
      ]);

      const activities = await activitiesApi.getAllByLead('lead-1');
      expect(activities[0].notes).toBe('Sent proposal');
    });
  });

  describe('Given create', () => {
    it('When action / Then creates an activity', async () => {
      mockFetchSuccess({ id: 'act-new', type: 'MEETING', notes: 'Meeting' });
      const activity = await activitiesApi.create({ type: 'MEETING', notes: 'Meeting' });
      expect(activity.id).toBe('act-new');
    });
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
describe('Given Error handling', () => {
  it('When action / Then throws with JSON error message from API', async () => {
    mockFetchErrorJson(400, { message: 'Validation failed' });
    await expect(leadsApi.getAll()).rejects.toThrow('Validation failed');
  });

  it('When action / Then throws with array message from API', async () => {
    mockFetchErrorJson(400, { message: ['Field required', 'Invalid email'] as any });
    await expect(leadsApi.getAll()).rejects.toThrow('Field required, Invalid email');
  });

  it('When action / Then throws with error field from API', async () => {
    mockFetchErrorJson(500, { error: 'Internal server error' });
    await expect(leadsApi.getAll()).rejects.toThrow('Internal server error');
  });

  it('When action / Then throws with raw text when JSON parse fails', async () => {
    mockFetchErrorText(502, 'Bad Gateway');
    await expect(leadsApi.getAll()).rejects.toThrow('Bad Gateway');
  });

  it('When action / Then throws on network error', async () => {
    mockFetchNetworkError();
    await expect(leadsApi.getAll()).rejects.toThrow('Network error');
  });

  it('When action / Then includes status code when no body', async () => {
    mockFetchErrorText(404, '');
    await expect(leadsApi.getAll()).rejects.toThrow('API Error: 404');
  });
});

// ============================================================================
// REQUEST HEADERS
// ============================================================================
describe('Given Request headers', () => {
  it('When action / Then includes Content-Type and X-Tenant-Id headers', async () => {
    mockFetchSuccess([]);
    await leadsApi.getAll();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-Tenant-Id']).toBeDefined();
  });
});

// ============================================================================
// SETTINGS API
// ============================================================================
describe('Given settingsApi', () => {
  describe('Given pipelineStages', () => {
    it('When action / Then getAll fetches pipeline stages', async () => {
      const stages = [{ id: 's1', name: 'New', order: 0, color: '#fff' }];
      mockFetchSuccess(stages);
      const result = await settingsApi.pipelineStages.getAll();
      expect(result).toEqual(stages);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/settings/pipeline-stages'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('When action / Then create creates a pipeline stage', async () => {
      const stage = { id: 's2', name: 'Qualified', order: 1 };
      mockFetchSuccess(stage);
      const result = await settingsApi.pipelineStages.create({ name: 'Qualified', order: 1 });
      expect(result).toEqual(stage);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/settings/pipeline-stages'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('When action / Then update updates a pipeline stage', async () => {
      const stage = { id: 's1', name: 'Updated', order: 0 };
      mockFetchSuccess(stage);
      const result = await settingsApi.pipelineStages.update('s1', { name: 'Updated' });
      expect(result).toEqual(stage);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/settings/pipeline-stages/s1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('When action / Then delete removes a pipeline stage', async () => {
      mockFetchSuccess({ message: 'Deleted' });
      const result = await settingsApi.pipelineStages.delete('s1');
      expect(result.message).toBe('Deleted');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/settings/pipeline-stages/s1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Given customFields', () => {
    it('When action / Then getAll fetches custom fields', async () => {
      const fields = [{ id: 'cf1', label: 'Industry', field_type: 'TEXT' }];
      mockFetchSuccess(fields);
      const result = await settingsApi.customFields.getAll();
      expect(result).toEqual(fields);
    });

    it('When action / Then getAll with entity_type filter', async () => {
      mockFetchSuccess([]);
      await settingsApi.customFields.getAll({ entity_type: 'LEAD' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('entity_type=LEAD'),
        expect.any(Object),
      );
    });

    it('When action / Then create creates a custom field', async () => {
      const field = { id: 'cf2', label: 'Revenue', field_type: 'NUMBER' };
      mockFetchSuccess(field);
      const result = await settingsApi.customFields.create({
        entity_type: 'DEAL',
        label: 'Revenue',
        field_type: 'NUMBER',
      });
      expect(result).toEqual(field);
    });

    it('When action / Then update updates a custom field', async () => {
      mockFetchSuccess({ id: 'cf1', label: 'Updated' });
      const result = await settingsApi.customFields.update('cf1', { label: 'Updated' });
      expect(result.label).toBe('Updated');
    });

    it('When action / Then delete removes a custom field', async () => {
      mockFetchSuccess({ message: 'Deleted' });
      const result = await settingsApi.customFields.delete('cf1');
      expect(result.message).toBe('Deleted');
    });
  });
});

// ============================================================================
// CRMSERVICE LEGACY COMPATIBILITY LAYER
// ============================================================================
describe('Given crmService (legacy layer)', () => {
  it('setTenantId / setOrgId / setAccessToken / setUser do not throw', () => {
    expect(() => crmService.setTenantId('t1')).not.toThrow();
    expect(() => crmService.setOrgId('o1')).not.toThrow();
    expect(() => crmService.setAccessToken('tok')).not.toThrow();
    expect(() =>
      crmService.setUser({ id: 'u1', email: 'a@b.com', full_name: 'A', avatar_url: null }),
    ).not.toThrow();
  });

  it('When action / Then getLeads delegates to leadsApi and transforms result', async () => {
    mockFetchSuccess([{ id: 'l1', company_name: 'Co', contact_name: 'J' }]);
    const result = await crmService.getLeads();
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'l1' }));
  });

  it('When action / Then getLeadById returns lead or undefined', async () => {
    mockFetchSuccess({ id: 'l1', company_name: 'Co' });
    const result = await crmService.getLeadById('l1');
    expect(result).toBeDefined();
    expect(result?.id).toBe('l1');
  });

  it('When action / Then getLeadById returns undefined on error', async () => {
    mockFetchErrorJson(404, { message: 'Not found' });
    const result = await crmService.getLeadById('bad');
    expect(result).toBeUndefined();
  });

  it('When action / Then getDeals delegates to dealsApi and transforms result', async () => {
    mockFetchSuccess([{ id: 'd1', name: 'Deal', value: 1000 }]);
    const result = await crmService.getDeals();
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'd1' }));
  });

  it('When action / Then getTasks delegates to tasksApi and transforms result', async () => {
    mockFetchSuccess([{ id: 't1', title: 'Task' }]);
    const result = await crmService.getTasks();
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: 't1' }));
  });

  it('When action / Then getUsers fetches users from core API and transforms result', async () => {
    mockFetchSuccess([{ id: 'u1', full_name: 'User', email: 'u@x.com' }]);
    const result = await crmService.getUsers();
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'u1', full_name: 'User' }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users'),
      expect.any(Object),
    );
  });

  it('When action / Then getSettings fetches CRM settings', async () => {
    const settings = { deal_stages: [], lead_stages: [], lead_custom_fields: [] };
    mockFetchSuccess(settings);
    const result = await crmService.getSettings();
    expect(result).toBeDefined();
  });

  it('When action / Then updateDealStage sends PATCH to deal endpoint with target_state', async () => {
    mockFetchSuccess({ id: 'd1', current_flow_state: 'qualified' });
    await crmService.updateDealStage('d1', 'qualified');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/deals/d1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.target_state).toBe('qualified');
  });

  it('When action / Then getQuotes fetches quotes', async () => {
    mockFetchSuccess([{ id: 'q1', title: 'Quote' }]);
    const result = await crmService.getQuotes();
    expect(result).toEqual([{ id: 'q1', title: 'Quote' }]);
  });

  it('When action / Then getQuoteById fetches a single quote', async () => {
    mockFetchSuccess({ id: 'q1', title: 'My Quote' });
    const result = await crmService.getQuoteById('q1');
    expect(result.title).toBe('My Quote');
  });

  it('When action / Then createQuote sends POST', async () => {
    mockFetchSuccess({ id: 'q2', title: 'New' });
    const result = await crmService.createQuote({ title: 'New', deal_id: 'd1' } as any);
    expect(result.id).toBe('q2');
  });

  it('When action / Then updateQuote sends PATCH', async () => {
    mockFetchSuccess({ id: 'q1', title: 'Updated' });
    const result = await crmService.updateQuote('q1', { title: 'Updated' } as any);
    expect(result.title).toBe('Updated');
  });

  it('When action / Then deleteQuote sends DELETE', async () => {
    mockFetchSuccess({ message: 'ok' });
    await crmService.deleteQuote('q1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/quotes/q1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('When action / Then getDashboardStats returns fallback on error', async () => {
    mockFetchNetworkError();
    const result = await crmService.getDashboardStats();
    expect(result.financials.totalRevenue).toBe(0);
    expect(result.counts.leads).toBe(0);
  });

  it('When action / Then getCustomers delegates to customersApi.getAll', async () => {
    mockFetchSuccess([{ id: 'c1' }]);
    const result = await crmService.getCustomers();
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('When action / Then logActivity delegates to activitiesApi.create', async () => {
    mockFetchSuccess({ id: 'a1' });
    const result = await crmService.logActivity('d1', {
      type: 'CALL' as any,
      description: 'Called',
    });
    expect(result).toBeDefined();
  });

  it('When action / Then getDailystoreStores fetches stores from dailystore API', async () => {
    mockFetchSuccess([{ id: 's1', name: 'Store 1' }]);
    const result = await crmService.getDailystoreStores();
    expect(result).toEqual([{ id: 's1', name: 'Store 1' }]);
  });

  it('When action / Then getCommerceKPIs fetches from analytics endpoint', async () => {
    mockFetchSuccess({ revenue: 5000, orderCount: 10 });
    const result = await crmService.getCommerceKPIs({ period: 'monthly', year: 2024 });
    expect(result.revenue).toBe(5000);
  });

  // --- Additional legacy layer tests for full coverage ---

  it('When action / Then createLead delegates to leadsApi.create', async () => {
    mockFetchSuccess({ id: 'l-new', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] });
    const result = await crmService.createLead({
      company_name: 'NewCo', contact_name: 'Jim', contact_email: 'j@n.com',
      phone: '555', source: 'Website', status: 'Open', custom_fields: { cf1: 'val' },
    } as any);
    expect(result.id).toBe('l-new');
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.company_name).toBe('NewCo');
    expect(body.meta_data).toEqual({ cf1: 'val' });
  });

  it('When action / Then updateLead whitelists fields and maps owner', async () => {
    mockFetchSuccess({ id: 'l1', status: 'QUALIFIED', notes: [], documents: [], deals: [], tasks: [], activities: [] });
    const result = await crmService.updateLead('l1', {
      contact_name: 'Jane',
      company_name: 'Corp',
      contact_email: 'j@c.com',
      phone: '999',
      source: 'Referral',
      status: 'Qualified',
      owner: { id: 'u2', full_name: 'Bob', email: '', avatar_url: '' } as any,
      custom_fields: { cf: 'v' },
    });
    expect(result.id).toBe('l1');
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.contact_name).toBe('Jane');
    expect(body.owner_id).toBe('u2');
    expect(body.status).toBe('qualified');
    expect(body.meta_data).toEqual({ cf: 'v' });
  });

  it('When action / Then updateLead maps owner_id when no owner object', async () => {
    mockFetchSuccess({ id: 'l1', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] });
    await crmService.updateLead('l1', { owner_id: 'u3' } as any);
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.owner_id).toBe('u3');
  });

  it('When action / Then deleteLead delegates to leadsApi.delete', async () => {
    mockFetchSuccess({});
    await crmService.deleteLead('l1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/leads/l1');
    expect(opts.method).toBe('DELETE');
  });

  it('When action / Then getDeals applies client-side filters', async () => {
    mockFetchSuccess([
      { id: 'd1', name: 'D1', value: '100', company_name: 'Acme', lead_id: 'l1', owner: { id: 'u1' }, owner_id: 'u1', notes: [], documents: [], activities: [], created_at: new Date().toISOString() },
      { id: 'd2', name: 'D2', value: '200', company_name: 'BigCo', lead_id: 'l2', owner: { id: 'u2' }, owner_id: 'u2', notes: [], documents: [], activities: [], created_at: '2020-01-01' },
    ]);
    const result = await crmService.getDeals({ owner_id: 'u1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d1');
  });

  it('When action / Then getDeals filters by company_name', async () => {
    mockFetchSuccess([
      { id: 'd1', value: '0', company_name: 'Acme Corp', owner: { id: 'u1' }, notes: [], documents: [], activities: [] },
      { id: 'd2', value: '0', company_name: 'BigCo', owner: { id: 'u1' }, notes: [], documents: [], activities: [] },
    ]);
    const result = await crmService.getDeals({ company_name: 'acme' });
    expect(result).toHaveLength(1);
  });

  it('When action / Then getDeals filters by lead_id', async () => {
    mockFetchSuccess([
      { id: 'd1', value: '0', lead_id: 'l1', company_name: 'A', owner: { id: 'u1' }, notes: [], documents: [], activities: [] },
      { id: 'd2', value: '0', lead_id: 'l2', company_name: 'B', owner: { id: 'u1' }, notes: [], documents: [], activities: [] },
    ]);
    const result = await crmService.getDeals({ lead_id: 'l1' });
    expect(result).toHaveLength(1);
  });

  it('When action / Then getDeals filters by date_range today', async () => {
    const today = new Date().toISOString();
    mockFetchSuccess([
      { id: 'd1', value: '0', company_name: 'A', owner: { id: 'u1' }, notes: [], documents: [], activities: [], created_at: today },
      { id: 'd2', value: '0', company_name: 'B', owner: { id: 'u1' }, notes: [], documents: [], activities: [], created_at: '2020-01-01' },
    ]);
    const result = await crmService.getDeals({ date_range: 'today' });
    expect(result).toHaveLength(1);
  });

  it('When action / Then getDealById returns undefined on error', async () => {
    mockFetchErrorJson(404, { message: 'Not found' });
    const result = await crmService.getDealById('bad');
    expect(result).toBeUndefined();
  });

  it('When action / Then getPipeline uses dealsApi.getPipeline', async () => {
    mockFetchSuccess([
      { id: 's1', name: 'Lead', deals: [{ id: 'd1', value: '100', notes: [], documents: [], activities: [] }] },
    ]);
    const result = await crmService.getPipeline();
    expect(result.stages).toHaveLength(1);
  });

  it('When action / Then getPipeline falls back to manual merge when primary fails', async () => {
    // First call: pipeline endpoint fails
    mockFetchSuccess([]);
    // Fallback: getSettings (5 calls) and getAll for deals
    // Settings: pipeline-stages
    mockFetchSuccess([{ id: 's1', name: 'Lead' }]);
    // Settings: lead-stages
    mockFetchSuccess([]);
    // Settings: custom-fields LEAD
    mockFetchSuccess([]);
    // Settings: custom-fields DEAL
    mockFetchSuccess([]);
    // Settings: custom-fields PARTNER
    mockFetchSuccess([]);
    // Settings: source-types (added in P2)
    mockFetchSuccess([]);
    // Settings: scoring-rules
    mockFetchSuccess([]);
    // Settings: score-categories
    mockFetchSuccess([]);
    // getAll deals
    mockFetchSuccess([{ id: 'd1', value: '0', stage: 'Lead', stage_id: 's1', notes: [], documents: [], activities: [] }]);
    const result = await crmService.getPipeline();
    expect(result.stages).toHaveLength(1);
  });

  it('When action / Then getDealsByLeadId filters deals by lead_id', async () => {
    mockFetchSuccess([
      { id: 'd1', lead_id: 'l1', value: '0', notes: [], documents: [], activities: [] },
      { id: 'd2', lead_id: 'l2', value: '0', notes: [], documents: [], activities: [] },
    ]);
    const result = await crmService.getDealsByLeadId('l1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d1');
  });

  it('When action / Then deleteDeal delegates to dealsApi.delete', async () => {
    mockFetchSuccess({});
    await crmService.deleteDeal('d1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then getTaskById returns undefined on error', async () => {
    mockFetchErrorJson(404, { message: 'Not found' });
    const result = await crmService.getTaskById('bad');
    expect(result).toBeUndefined();
  });

  it('When action / Then createTask delegates to tasksApi.create', async () => {
    mockFetchSuccess({ id: 't-new', title: 'Task', status: 'open' });
    const result = await crmService.createTask({ title: 'Task' });
    expect(result.id).toBe('t-new');
  });

  it('When action / Then updateTask whitelists fields and uppercases status', async () => {
    mockFetchSuccess({ id: 't1', title: 'Updated', status: 'done' });
    await crmService.updateTask('t1', {
      title: 'Updated', due_date: '2024-06-01', status: 'Done',
      type: 'reminder', assignee_id: 'u1',
      reminder_minutes_before: 15,
      assigned_to: { id: 'u2', full_name: 'Bob', email: '', avatar_url: '' },
    } as any);
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.status).toBe('DONE');
    expect(body.type).toBe('REMINDER');
    expect(body.assignee_id).toBe('u2'); // assigned_to overrides assignee_id
    expect(body.reminder_minutes_before).toBe(15);
  });

  it('When action / Then getTasksByLeadId filters tasks by lead_id', async () => {
    mockFetchSuccess([
      { id: 't1', lead_id: 'l1', title: 'A', status: 'open' },
      { id: 't2', lead_id: 'l2', title: 'B', status: 'open' },
    ]);
    const result = await crmService.getTasksByLeadId('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getTasksByDealId filters tasks by deal_id', async () => {
    mockFetchSuccess([
      { id: 't1', deal_id: 'd1', title: 'A', status: 'open' },
      { id: 't2', deal_id: 'd2', title: 'B', status: 'open' },
    ]);
    const result = await crmService.getTasksByDealId('d1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then deleteTask delegates to tasksApi.delete', async () => {
    mockFetchSuccess({});
    await crmService.deleteTask('t1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then getSettings returns full CRMSettings structure', async () => {
    // pipeline-stages
    mockFetchSuccess([{ id: 's1', name: 'Won', type: 'WON' }]);
    // lead-stages
    mockFetchSuccess([{ id: 'ls1', name: 'Open' }]);
    // custom-fields LEAD
    mockFetchSuccess([{ id: 'cf1', label: 'Industry', type: 'text' }]);
    // custom-fields DEAL
    mockFetchSuccess([{ id: 'cf2', label: 'Budget', type: 'number' }]);
    // source-types (added in P2)
    mockFetchSuccess([]);
    // scoring-rules
    mockFetchSuccess([]);
    // score-categories
    mockFetchSuccess([]);

    const result = await crmService.getSettings();
    expect(result.deal_stages).toHaveLength(1);
    expect(result.deal_stages[0].type).toBe('WON');
    expect(result.lead_stages).toHaveLength(1);
    expect(result.lead_custom_fields).toHaveLength(1);
    expect(result.deal_custom_fields).toHaveLength(1);
  });

  it('When action / Then getSettings infers type for Won/Lost stage names', async () => {
    mockFetchSuccess([
      { id: 's1', name: 'Won' },
      { id: 's2', name: 'Lost' },
      { id: 's3', name: 'Prospect' },
    ]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    // source-types (added in P2)
    mockFetchSuccess([]);
    // scoring-rules
    mockFetchSuccess([]);
    // score-categories
    mockFetchSuccess([]);
    const result = await crmService.getSettings();
    expect(result.deal_stages[0].type).toBe('WON');
    expect(result.deal_stages[1].type).toBe('LOST');
    expect(result.deal_stages[2].type).toBe('OPEN');
  });

  it('When action / Then getSettings returns defaults on error', async () => {
    mockFetchNetworkError();
    const result = await crmService.getSettings();
    expect(result.deal_stages).toEqual([]);
    expect(result.lead_stages).toEqual([]);
  });

  it('When action / Then updateSettings syncs pipeline stages and custom fields (lead stages are read-only, not written)', async () => {
    // Current pipeline-stages
    mockFetchSuccess([{ id: 'existing-1', name: 'Old', order: 1 }]);
    // POST new stage (st- prefix)
    mockFetchSuccess({ id: 'new-1', name: 'New Stage' });
    // PATCH existing stage
    mockFetchSuccess({ id: 'existing-1', name: 'Updated' });
    // DELETE removed stage - none in this test

    // Lead stages are owned by the Flow module — updateSettings makes NO lead-stage calls

    // Current lead custom fields
    mockFetchSuccess([{ id: 'lcf-old', label: 'Old', entity_type: 'LEAD' }]);
    // No new lcf, update existing
    mockFetchSuccess({ id: 'lcf-old', label: 'Updated' });

    // Current deal custom fields
    mockFetchSuccess([{ id: 'dcf-old', label: 'Old', entity_type: 'DEAL' }]);
    // No new dcf, update existing
    mockFetchSuccess({ id: 'dcf-old', label: 'Updated' });

    // Current partner custom fields (step 5 GET)
    mockFetchSuccess([]);

    const newSettings = {
      deal_stages: [
        { id: 'existing-1', name: 'Updated', type: 'OPEN' },
        { id: 'st-new', name: 'New Stage', type: 'OPEN' },
      ],
      lead_stages: [{ id: 'ls-old', name: 'UpdatedLS' }],
      lead_custom_fields: [{ id: 'lcf-old', label: 'Updated', type: 'text', required: false }],
      deal_custom_fields: [{ id: 'dcf-old', label: 'Updated', type: 'number', required: false }],
      lead_sources: [],
      lead_scoring: [],
      default_owner_id: 'u1',
    } as any;

    const result = await crmService.updateSettings(newSettings);
    expect(result).toEqual(newSettings);
    // Lead stages are owned by the Flow module — save must never call the lead-stages API
    expect(
      fetchMock.mock.calls.some(([url]: any[]) => String(url).includes('/settings/lead-stages')),
    ).toBe(false);
  });

  it('When action / Then updateSettings throws on error', async () => {
    mockFetchNetworkError();
    await expect(crmService.updateSettings({ deal_stages: [] } as any)).rejects.toThrow();
  });

  it('Given the Pipeline Stages API fails / When updateSettings runs / Then the other categories are still attempted and the error names only the failed category', async () => {
    // Section 1 — Pipeline Stages GET fails (whole section aborts before any write)
    mockFetchErrorJson(500, { message: 'boom' });
    // Section 2 — Lead custom fields GET (empty → no writes)
    mockFetchSuccess([]);
    // Section 3 — Deal custom fields GET (empty → no writes)
    mockFetchSuccess([]);
    // Section 4 — Partner custom fields GET (empty → no writes)
    mockFetchSuccess([]);

    const settings = {
      deal_stages: [{ id: 'st-x', name: 'X', type: 'OPEN' }],
      lead_stages: [],
      lead_custom_fields: [],
      deal_custom_fields: [],
      partner_custom_fields: [],
      lead_sources: [],
      lead_scoring: [],
      default_owner_id: 'u1',
    } as any;

    await expect(crmService.updateSettings(settings)).rejects.toThrow('Failed to save: Pipeline Stages');

    // Isolation: the remaining categories were still attempted despite the pipeline failure
    const urls = fetchMock.mock.calls.map(([url]: any[]) => String(url));
    expect(urls.some(u => u.includes('custom-fields?entity_type=LEAD'))).toBe(true);
    expect(urls.some(u => u.includes('custom-fields?entity_type=DEAL'))).toBe(true);
    expect(urls.some(u => u.includes('custom-fields?entity_type=PARTNER'))).toBe(true);
  });

  it('Given a Custom Fields category fails / When updateSettings runs / Then the error names that category and later categories still run', async () => {
    // Section 1 — Pipeline Stages GET succeeds (empty → no writes)
    mockFetchSuccess([]);
    // Section 2 — Lead custom fields GET succeeds (empty → no writes)
    mockFetchSuccess([]);
    // Section 3 — Deal custom fields GET fails
    mockFetchErrorJson(500, { message: 'boom' });
    // Section 4 — Partner custom fields GET succeeds (empty → no writes)
    mockFetchSuccess([]);

    const settings = {
      deal_stages: [],
      lead_stages: [],
      lead_custom_fields: [],
      deal_custom_fields: [],
      partner_custom_fields: [],
      lead_sources: [],
      lead_scoring: [],
      default_owner_id: 'u1',
    } as any;

    await expect(crmService.updateSettings(settings)).rejects.toThrow('Failed to save: Deal Fields');

    // The category after the failing one still ran
    const urls = fetchMock.mock.calls.map(([url]: any[]) => String(url));
    expect(urls.some(u => u.includes('custom-fields?entity_type=PARTNER'))).toBe(true);
  });

  it('Given multiple categories fail / When updateSettings runs / Then the error lists every failed category', async () => {
    // Pipeline GET fails
    mockFetchErrorJson(500, { message: 'boom' });
    // Lead fields GET succeeds (empty → no writes)
    mockFetchSuccess([]);
    // Deal fields GET fails
    mockFetchErrorJson(500, { message: 'boom' });
    // Partner fields GET succeeds (empty → no writes)
    mockFetchSuccess([]);

    const settings = {
      deal_stages: [],
      lead_stages: [],
      lead_custom_fields: [],
      deal_custom_fields: [],
      partner_custom_fields: [],
      lead_sources: [],
      lead_scoring: [],
      default_owner_id: 'u1',
    } as any;

    await expect(crmService.updateSettings(settings)).rejects.toThrow('Failed to save: Pipeline Stages, Deal Fields');
  });

  it('Given partner_custom_fields is undefined / When updateSettings runs / Then it defaults to an empty list without error', async () => {
    // All four section GETs succeed (empty → no writes)
    mockFetchSuccess([]); // pipeline
    mockFetchSuccess([]); // lead fields
    mockFetchSuccess([]); // deal fields
    mockFetchSuccess([]); // partner fields

    const settings = {
      deal_stages: [],
      lead_stages: [],
      lead_custom_fields: [],
      deal_custom_fields: [],
      // partner_custom_fields intentionally omitted
      lead_sources: [],
      lead_scoring: [],
      default_owner_id: 'u1',
    } as any;

    const result = await crmService.updateSettings(settings);
    expect(result).toBe(settings);
  });

  it('When action / Then getNotesByLeadId delegates to notesApi.getAllByLead', async () => {
    mockFetchSuccess([{ id: 'n1', content: 'test', author_id: 'u1' }]);
    const result = await crmService.getNotesByLeadId('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getNotesByDealId delegates to notesApi.getAllByDeal', async () => {
    mockFetchSuccess([{ id: 'n1', content: 'test', author_id: 'u1' }]);
    const result = await crmService.getNotesByDealId('d1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getTaskNotes fetches notes for a task', async () => {
    mockFetchSuccess([{ id: 'n1', content: 'task note', author_id: 'u1' }]);
    const result = await crmService.getTaskNotes('t1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then createNote delegates to notesApi.create', async () => {
    mockFetchSuccess({ id: 'n-new', content: 'New note', author_id: 'u1' });
    const result = await crmService.createNote({ content: 'New note', lead_id: 'l1' });
    expect(result.id).toBe('n-new');
  });

  it('When action / Then updateNote delegates to notesApi.update', async () => {
    mockFetchSuccess({ id: 'n1', content: 'Updated' });
    await crmService.updateNote('n1', 'Updated');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notes/n1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('When action / Then deleteNote delegates to notesApi.delete', async () => {
    mockFetchSuccess({});
    await crmService.deleteNote('n1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notes/n1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('When action / Then getUsers maps user format and falls back on error', async () => {
    mockFetchErrorJson(500, { message: 'Server error' });
    const result = await crmService.getUsers();
    // Should fall back to empty or current user
    expect(Array.isArray(result)).toBe(true);
  });

  it('When action / Then getDocumentsByLeadId delegates to documentsApi', async () => {
    mockFetchSuccess([{ id: 'doc1', name: 'file.pdf', uploaded_by_id: 'u1' }]);
    const result = await crmService.getDocumentsByLeadId('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getDocumentsByDealId delegates to documentsApi', async () => {
    mockFetchSuccess([{ id: 'doc1', name: 'file.pdf', uploaded_by_id: 'u1' }]);
    const result = await crmService.getDocumentsByDealId('d1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then deleteDocument delegates to documentsApi.delete', async () => {
    mockFetchSuccess({});
    await crmService.deleteDocument('l1', 'doc1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/documents/doc1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('When action / Then getActivitiesByLeadId delegates to activitiesApi.getAllByLead', async () => {
    mockFetchSuccess([{ id: 'a1', type: 'CALL', notes: 'test', author_id: 'u1' }]);
    const result = await crmService.getActivitiesByLeadId('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getActivitiesByDealId tries tier 1, then returns activities', async () => {
    mockFetchSuccess([{ id: 'a1', type: 'CALL', deal_id: 'd1', notes: 'test', author_id: 'u1' }]);
    const result = await crmService.getActivitiesByDealId('d1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getActivitiesByDealId falls back to tier 2 on tier 1 failure', async () => {
    // Tier 1 fails
    mockFetchErrorJson(404, { message: 'Not found' });
    // Tier 2: /activities returns all
    mockFetchSuccess([
      { id: 'a1', deal_id: 'd1', type: 'CALL', notes: 'test', author_id: 'u1' },
      { id: 'a2', deal_id: 'd2', type: 'EMAIL', notes: 'other', author_id: 'u1' },
    ]);
    const result = await crmService.getActivitiesByDealId('d1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('When action / Then getActivitiesByDealId returns empty on all tiers failing', async () => {
    // Tier 1 fails
    mockFetchErrorJson(500, { message: 'fail' });
    // Tier 2 fails
    mockFetchErrorJson(500, { message: 'fail' });
    // Tier 3: getDealById
    mockFetchErrorJson(500, { message: 'fail' });
    const result = await crmService.getActivitiesByDealId('d1');
    expect(result).toEqual([]);
  });

  it('When action / Then requestInvoice sends POST', async () => {
    mockFetchSuccess({});
    await crmService.requestInvoice('d1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/deals/d1/request-invoice'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('When action / Then getInvoiceStatus returns status or fallback', async () => {
    mockFetchSuccess({ has_invoice: true, invoice_id: 'inv-1' });
    const result = await crmService.getInvoiceStatus('d1');
    expect(result.has_invoice).toBe(true);
  });

  it('When action / Then getInvoiceStatus returns { has_invoice: false } on error', async () => {
    mockFetchErrorJson(500, { message: 'fail' });
    const result = await crmService.getInvoiceStatus('d1');
    expect(result.has_invoice).toBe(false);
  });

  it('When action / Then linkProject sends PATCH', async () => {
    mockFetchSuccess({});
    await crmService.linkProject('d1', 'p1');
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body).project_id).toBe('p1');
  });

  it('When action / Then unlinkProject sends PATCH', async () => {
    mockFetchSuccess({});
    await crmService.unlinkProject('d1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/deals/d1/unlink-project'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('When action / Then createProjectFromDeal sends POST', async () => {
    mockFetchSuccess({ id: 'p-new' });
    const result = await crmService.createProjectFromDeal('d1');
    expect(result.id).toBe('p-new');
  });

  it('When action / Then getProjects returns empty on error', async () => {
    mockFetchErrorJson(500, { message: 'fail' });
    const result = await crmService.getProjects();
    expect(result).toEqual([]);
  });

  it('When action / Then getProjects returns projects list', async () => {
    mockFetchSuccess([{ id: 'p1', title: 'Project' }]);
    const result = await crmService.getProjects();
    expect(result).toHaveLength(1);
  });

  it('When action / Then getQuotes with filters builds query string', async () => {
    mockFetchSuccess([]);
    await crmService.getQuotes({ status: 'draft', deal_id: 'd1', customer_id: 'c1' });
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('status=draft');
    expect(url).toContain('deal_id=d1');
    expect(url).toContain('customer_id=c1');
  });

  it('When action / Then submitQuoteForApproval sends POST', async () => {
    mockFetchSuccess({ status: 'pending_approval' });
    const result = await crmService.submitQuoteForApproval('q1');
    expect(result.status).toBe('pending_approval');
  });

  it('When action / Then approveQuote sends POST', async () => {
    mockFetchSuccess({ status: 'approved' });
    const result = await crmService.approveQuote('q1', 'Looks good');
    expect(result.status).toBe('approved');
  });

  it('When action / Then rejectQuote sends POST', async () => {
    mockFetchSuccess({ status: 'rejected' });
    const result = await crmService.rejectQuote('q1', 'Too expensive');
    expect(result.status).toBe('rejected');
  });

  it('When action / Then convertQuoteToOrder sends POST', async () => {
    mockFetchSuccess({ order_id: 'o1' });
    const result = await crmService.convertQuoteToOrder('q1', { delivery_date: '2024-12-01' });
    expect(result.order_id).toBe('o1');
  });

  it('When action / Then convertQuoteToOrder works without data', async () => {
    mockFetchSuccess({ order_id: 'o1' });
    const result = await crmService.convertQuoteToOrder('q1');
    expect(result.order_id).toBe('o1');
  });

  it('When action / Then getStockAvailability returns items', async () => {
    // This calls fetch directly, not via apiClient
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [{ item_id: 'i1', available_quantity: 10 }] }),
    });
    const result = await crmService.getStockAvailability(['i1']);
    expect(result.items).toHaveLength(1);
  });

  it('When action / Then getStockAvailability returns empty for empty ids', async () => {
    const result = await crmService.getStockAvailability([]);
    expect(result.items).toEqual([]);
  });

  it('When action / Then getStockAvailability returns empty on failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await crmService.getStockAvailability(['i1']);
    expect(result.items).toEqual([]);
  });

  it('When action / Then getStockAvailability returns empty on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fail'));
    const result = await crmService.getStockAvailability(['i1']);
    expect(result.items).toEqual([]);
  });

  it('When action / Then getCustomerStats delegates to customersApi.getStats', async () => {
    mockFetchSuccess({ total: 100 });
    const result = await crmService.getCustomerStats();
    expect(result.total).toBe(100);
  });

  it('When action / Then promoteToCustomer delegates to customersApi.promote', async () => {
    mockFetchSuccess({ id: 'l1', type: 'customer' });
    const result = await crmService.promoteToCustomer('l1');
    expect(result.type).toBe('customer');
  });

  it('When action / Then validateCustomerTaxId delegates', async () => {
    mockFetchSuccess({ valid: true });
    const result = await crmService.validateCustomerTaxId('c1', 'TAX123');
    expect(result.valid).toBe(true);
  });

  it('When action / Then updateCustomerCreditLimit delegates', async () => {
    mockFetchSuccess({ credit_limit: 5000 });
    const result = await crmService.updateCustomerCreditLimit('When action / Then c1', 5000);
    expect(result.credit_limit).toBe(5000);
  });

  // Customer Segments
  it('When action / Then getCustomerSegments fetches segments', async () => {
    mockFetchSuccess([{ id: 'seg1', name: 'VIP' }]);
    const result = await crmService.getCustomerSegments();
    expect(result).toHaveLength(1);
  });

  it('When action / Then getCustomerSegmentById fetches one segment', async () => {
    mockFetchSuccess({ id: 'seg1', name: 'VIP' });
    const result = await crmService.getCustomerSegmentById('seg1');
    expect(result.name).toBe('VIP');
  });

  it('When action / Then createCustomerSegment sends POST', async () => {
    mockFetchSuccess({ id: 'seg-new' });
    const result = await crmService.createCustomerSegment({ name: 'New' });
    expect(result.id).toBe('seg-new');
  });

  it('When action / Then updateCustomerSegment sends PATCH', async () => {
    mockFetchSuccess({ id: 'seg1', name: 'Updated' });
    const result = await crmService.updateCustomerSegment('seg1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('When action / Then deleteCustomerSegment sends DELETE', async () => {
    mockFetchSuccess({ message: 'ok' });
    await crmService.deleteCustomerSegment('seg1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then getCustomerSegmentCustomers fetches customers', async () => {
    mockFetchSuccess([{ id: 'c1' }]);
    const result = await crmService.getCustomerSegmentCustomers('seg1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getCustomerSegmentLeads fetches leads', async () => {
    mockFetchSuccess([{ id: 'l1' }]);
    const result = await crmService.getCustomerSegmentLeads('seg1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getCustomerSegmentMembers fetches with params', async () => {
    mockFetchSuccess({ members: [{ id: 'c1' }] });
    const result = await crmService.getCustomerSegmentMembers('seg1', { type: 'customer' });
    expect(result.members).toHaveLength(1);
  });

  it('When action / Then addCustomerSegmentMembers sends POST', async () => {
    mockFetchSuccess({ added: 2 });
    const result = await crmService.addCustomerSegmentMembers('seg1', [{ id: 'c1', type: 'customer' }]);
    expect(result.added).toBe(2);
  });

  it('When action / Then removeCustomerSegmentMembers sends DELETE', async () => {
    mockFetchSuccess({ removed: 1 });
    const result = await crmService.removeCustomerSegmentMembers('seg1', [{ id: 'c1', type: 'customer' }]);
    expect(result.removed).toBe(1);
  });

  // Marketing APIs
  it('When action / Then getAbandonedCarts fetches carts', async () => {
    mockFetchSuccess([{ id: 'cart1' }]);
    const result = await crmService.getAbandonedCarts('s1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getAbandonedCartStats fetches stats', async () => {
    mockFetchSuccess({ totalAbandoned: 5 });
    const result = await crmService.getAbandonedCartStats('s1');
    expect(result.totalAbandoned).toBe(5);
  });

  it('When action / Then getAbandonedCart fetches single cart', async () => {
    mockFetchSuccess({ id: 'cart1' });
    const result = await crmService.getAbandonedCart('s1', 'cart1');
    expect(result.id).toBe('cart1');
  });

  it('When action / Then sendAbandonedCartRecovery sends POST', async () => {
    mockFetchSuccess({ sent: true });
    const result = await crmService.sendAbandonedCartRecovery('s1', 'cart1');
    expect(result.sent).toBe(true);
  });

  it('When action / Then updateAbandonedCartStatus sends PATCH', async () => {
    mockFetchSuccess({ status: 'recovered' });
    const result = await crmService.updateAbandonedCartStatus('s1', 'cart1', 'recovered');
    expect(result.status).toBe('recovered');
  });

  it('When action / Then getStorefrontActivity fetches activities', async () => {
    mockFetchSuccess([{ id: 'a1' }]);
    const result = await crmService.getStorefrontActivity('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getStorefrontWishlist fetches wishlist', async () => {
    mockFetchSuccess([{ id: 'w1' }]);
    const result = await crmService.getStorefrontWishlist('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getStorefrontReviews fetches reviews', async () => {
    mockFetchSuccess([{ id: 'r1' }]);
    const result = await crmService.getStorefrontReviews('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getStorefrontAbandonedCarts fetches carts', async () => {
    mockFetchSuccess([{ id: 'c1' }]);
    const result = await crmService.getStorefrontAbandonedCarts('l1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getAllStorefrontSearches fetches searches', async () => {
    mockFetchSuccess([{ id: 's1', search_query: 'test' }]);
    const result = await crmService.getAllStorefrontSearches();
    expect(result).toHaveLength(1);
  });

  it('When action / Then getMarketingReviews fetches reviews', async () => {
    mockFetchSuccess([{ id: 'r1' }]);
    const result = await crmService.getMarketingReviews('s1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getMarketingWishlist fetches wishlist', async () => {
    mockFetchSuccess([{ id: 'w1' }]);
    const result = await crmService.getMarketingWishlist('s1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then getCampaigns fetches campaigns', async () => {
    mockFetchSuccess({ data: [{ id: 'c1' }] });
    const result = await crmService.getCampaigns('s1');
    expect(result.data).toHaveLength(1);
  });

  it('When action / Then getCampaign fetches single campaign', async () => {
    mockFetchSuccess({ id: 'c1' });
    const result = await crmService.getCampaign('s1', 'c1');
    expect(result.id).toBe('c1');
  });

  it('When action / Then createCampaign sends POST', async () => {
    mockFetchSuccess({ id: 'c-new' });
    const result = await crmService.createCampaign('s1', { name: 'Camp' });
    expect(result.id).toBe('c-new');
  });

  it('When action / Then updateCampaign sends PUT', async () => {
    mockFetchSuccess({ id: 'c1', name: 'Updated' });
    const result = await crmService.updateCampaign('s1', 'c1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('When action / Then deleteCampaign sends DELETE', async () => {
    mockFetchSuccess({});
    await crmService.deleteCampaign('s1', 'c1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then sendCampaignNow sends POST', async () => {
    mockFetchSuccess({ sent: true });
    await crmService.sendCampaignNow('s1', 'c1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then scheduleCampaign sends POST with scheduleAt', async () => {
    mockFetchSuccess({ scheduled: true });
    await crmService.scheduleCampaign('s1', 'c1', '2024-12-01T10:00:00Z');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then pauseCampaign sends POST', async () => {
    mockFetchSuccess({});
    await crmService.pauseCampaign('s1', 'c1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then testSendCampaign sends POST with email', async () => {
    mockFetchSuccess({});
    await crmService.testSendCampaign('s1', 'c1', 'test@test.com');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then getCampaignRecipients fetches recipients', async () => {
    mockFetchSuccess({ data: [{ email: 'a@b.com' }] });
    const result = await crmService.getCampaignRecipients('s1', 'c1');
    expect(result.data).toHaveLength(1);
  });

  it('When action / Then getMarketingSegments fetches segments', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getMarketingSegments('s1');
    expect(result.data).toBeDefined();
  });

  it('When action / Then getMarketingProductInterest fetches data', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getMarketingProductInterest('s1');
    expect(result).toBeDefined();
  });

  it('When action / Then getMarketingBestSellingProducts fetches data', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getMarketingBestSellingProducts('s1');
    expect(result).toBeDefined();
  });

  it('When action / Then getMarketingTopBuyers fetches data', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getMarketingTopBuyers('s1');
    expect(result).toBeDefined();
  });

  it('When action / Then getMarketingInactiveCustomers fetches data', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getMarketingInactiveCustomers('s1');
    expect(result).toBeDefined();
  });

  it('When action / Then getMarketingConversionFunnel fetches data', async () => {
    mockFetchSuccess({ funnel: {} });
    const result = await crmService.getMarketingConversionFunnel('s1');
    expect(result).toBeDefined();
  });

  it('When action / Then getMarketingEmailPerformance fetches data', async () => {
    mockFetchSuccess({ openRate: 45 });
    const result = await crmService.getMarketingEmailPerformance('s1');
    expect(result.openRate).toBe(45);
  });

  // Newsletter
  it('When action / Then getNewsletterSubscribers fetches subscribers', async () => {
    mockFetchSuccess([{ id: 'sub1' }]);
    const result = await crmService.getNewsletterSubscribers('s1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then addNewsletterSubscriber sends POST', async () => {
    mockFetchSuccess({ id: 'sub-new' });
    const result = await crmService.addNewsletterSubscriber('s1', { email: 'a@b.com' });
    expect(result.id).toBe('sub-new');
  });

  it('When action / Then unsubscribeNewsletter sends POST', async () => {
    mockFetchSuccess({});
    await crmService.unsubscribeNewsletter('s1', 'sub1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then deleteNewsletterSubscriber sends DELETE', async () => {
    mockFetchSuccess({});
    await crmService.deleteNewsletterSubscriber('s1', 'sub1');
    expect(fetchMock).toHaveBeenCalled();
  });

  // Coupons
  it('When action / Then getCoupons fetches coupons', async () => {
    mockFetchSuccess([{ id: 'cp1' }]);
    const result = await crmService.getCoupons('s1');
    expect(result).toHaveLength(1);
  });

  it('When action / Then createCoupon sends POST', async () => {
    mockFetchSuccess({ id: 'cp-new' });
    const result = await crmService.createCoupon('s1', { code: 'SAVE10' });
    expect(result.id).toBe('cp-new');
  });

  it('When action / Then getCoupon fetches single coupon', async () => {
    mockFetchSuccess({ id: 'cp1', code: 'SAVE10' });
    const result = await crmService.getCoupon('s1', 'cp1');
    expect(result.code).toBe('SAVE10');
  });

  it('When action / Then updateCoupon sends PUT', async () => {
    mockFetchSuccess({ id: 'cp1', code: 'SAVE20' });
    const result = await crmService.updateCoupon('s1', 'cp1', { code: 'SAVE20' });
    expect(result.code).toBe('SAVE20');
  });

  it('When action / Then deleteCoupon sends DELETE', async () => {
    mockFetchSuccess({});
    await crmService.deleteCoupon('s1', 'cp1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('When action / Then getFulfillmentOrderByDeal returns null when no orders', async () => {
    mockFetchSuccess({ data: [] });
    const result = await crmService.getFulfillmentOrderByDeal('d1');
    expect(result).toBeNull();
  });

  it('When action / Then getFulfillmentOrderByDeal returns first order', async () => {
    mockFetchSuccess({ data: [{ id: 'fo1', status: 'pending' }] });
    const result = await crmService.getFulfillmentOrderByDeal('d1');
    expect(result.id).toBe('fo1');
  });

  it('When action / Then getFulfillmentOrderByDeal returns null on error', async () => {
    mockFetchNetworkError();
    const result = await crmService.getFulfillmentOrderByDeal('d1');
    expect(result).toBeNull();
  });

  it('When action / Then setUserId sets user id', () => {
    expect(() => crmService.setUserId('u-test')).not.toThrow();
  });

  it('When action / Then getDashboardStats with period param uses analytics endpoint', async () => {
    // Analytics dashboard
    mockFetchSuccess({
      financials: { totalRevenue: 1000, pipelineValue: 500, avgDealSize: 250 },
      metrics: { winRate: 50 },
      counts: { totalLeads: 10, totalDeals: 5 },
      chartData: { labels: ['Jan'], values: [1000] },
    });
    // Performance
    mockFetchSuccess([]);
    // Tasks
    mockFetchSuccess([]);

    const result = await crmService.getDashboardStats({ period: 'monthly', year: 2024, month: 1 });
    expect(result.financials.totalRevenue).toBe(1000);
    expect(result.chartLabels).toEqual(['Jan']);
  });

  it('When action / Then getDashboardStats with period and performance data', async () => {
    mockFetchSuccess({
      financials: { totalRevenue: 5000, pipelineValue: 2000, avgDealSize: 500 },
      metrics: { winRate: 60 },
      counts: { totalLeads: 20, totalDeals: 10 },
      chartData: { labels: ['Q1'], values: [5000] },
    });
    mockFetchSuccess([
      { user: { id: 'u1', name: 'Alice', email: 'a@b.com' }, metrics: { won: 3, leads: 10, activityPoints: 50, conversionRate: 30 } },
    ]);
    mockFetchSuccess([
      { id: 't1', status: 'Open', type: 'REMINDER', due_date: '2024-01-01' },
      { id: 't2', status: 'Open', type: 'TODO', due_date: '2024-02-01' },
    ]);

    const result = await crmService.getDashboardStats({ period: 'quarterly', year: 2024, quarter: 1 });
    expect(result.teamStats).toHaveLength(1);
    expect(result.reminders).toHaveLength(1);
    expect(result.counts.tasks).toBe(2);
  });

  it('When action / Then getDashboardStats legacy path (no period)', async () => {
    // getLeads
    mockFetchSuccess([
      { id: 'l1', status: 'NEW', owner: { id: 'u1' }, owner_id: 'u1', notes: [], documents: [], deals: [], tasks: [], activities: [] },
    ]);
    // getDeals
    mockFetchSuccess([
      { id: 'd1', stage: 'Won', value: '1000', owner: { id: 'u1' }, owner_id: 'u1', notes: [], documents: [], activities: [], created_at: new Date().toISOString() },
    ]);
    // getUsers
    mockFetchSuccess([{ id: 'u1', full_name: 'Alice', email: 'a@b.com' }]);
    // getTasks
    mockFetchSuccess([
      { id: 't1', status: 'open', type: 'REMINDER', due_date: '2099-01-01' },
    ]);
    // getSettings (8 calls — pipeline-stages, lead-stages, custom-fields LEAD, custom-fields DEAL, custom-fields PARTNER, source-types, scoring-rules, score-categories)
    mockFetchSuccess([{ id: 's1', name: 'Won', type: 'WON' }, { id: 's2', name: 'Lost', type: 'LOST' }]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);
    mockFetchSuccess([]);

    const result = await crmService.getDashboardStats();
    expect(result.financials.totalRevenue).toBe(1000);
    expect(result.counts.leads).toBe(1);
    expect(result.teamStats).toHaveLength(1);
  });
});

// ============================================================================
// LEADS API - update method
// ============================================================================
describe('Given leadsApi additional', () => {
  it('When action / Then update maps FE status to BE format in payload', async () => {
    mockFetchSuccess({ id: 'l1', status: 'QUALIFIED', notes: [], documents: [], deals: [], tasks: [], activities: [] });
    await leadsApi.update('l1', { status: 'Qualified' });
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.status).toBe('qualified');
  });

  it('When action / Then getStats fetches lead stats', async () => {
    mockFetchSuccess({ stats: [{ status: 'NEW', count: 5 }] });
    const result = await leadsApi.getStats();
    expect(result.stats).toHaveLength(1);
  });
});

// ============================================================================
// DEALS API - additional methods
// ============================================================================
describe('Given dealsApi additional', () => {
  it('When action / Then getById fetches a single deal', async () => {
    mockFetchSuccess({ id: 'd1', name: 'Deal', value: '100', notes: [], documents: [], activities: [] });
    const deal = await dealsApi.getById('d1');
    expect(deal.id).toBe('d1');
    expect(deal.value).toBe(100);
  });

  it('When action / Then update returns deal with mapped owner', async () => {
    mockFetchSuccess({ id: 'd1', owner: { id: 'u1', full_name: 'Alice' }, owner_id: 'u1' });
    const result = await dealsApi.update('d1', { name: 'Updated' });
    expect(result.owner.full_name).toBe('Alice');
  });

  it('When action / Then getSalesPerformanceByPerson fetches performance', async () => {
    mockFetchSuccess([{ person_id: 'p1', total_deals: 5 }]);
    const result = await dealsApi.getSalesPerformanceByPerson({ start_date: '2024-01-01' });
    expect(result).toHaveLength(1);
  });

  it('When action / Then getDealsByPerson fetches deals for a person', async () => {
    mockFetchSuccess([{ id: 'd1', value: '100', notes: [], documents: [], activities: [] }]);
    const result = await dealsApi.getDealsByPerson('p1');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(100);
  });
});

// ============================================================================
// TASKS API - additional methods
// ============================================================================
describe('Given tasksApi additional', () => {
  it('When action / Then getById fetches a single task', async () => {
    mockFetchSuccess({ id: 't1', title: 'Task', status: 'done' });
    const task = await tasksApi.getById('t1');
    expect(task.status).toBe('DONE');
  });

  it('When action / Then delete sends DELETE request', async () => {
    mockFetchSuccess({});
    await tasksApi.delete('t1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/tasks/t1');
    expect(opts.method).toBe('DELETE');
  });
});

// ============================================================================
// NOTES API - additional methods
// ============================================================================
describe('Given notesApi additional', () => {
  it('When action / Then update sends PATCH', async () => {
    mockFetchSuccess({ id: 'n1', content: 'Updated' });
    const result = await notesApi.update('n1', { content: 'Updated' });
    expect(result.content).toBe('Updated');
  });
});

// ============================================================================
// DOCUMENTS API - additional methods
// ============================================================================
describe('Given documentsApi additional', () => {
  it('When action / Then create sends POST', async () => {
    mockFetchSuccess({ id: 'doc-new', name: 'file.pdf', uploaded_by_id: 'u1' });
    const result = await documentsApi.create({ name: 'file.pdf', lead_id: 'l1' });
    expect(result.id).toBe('doc-new');
  });

  it('When action / Then delete sends DELETE request', async () => {
    mockFetchSuccess({});
    await documentsApi.delete('doc1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/documents/doc1');
    expect(opts.method).toBe('DELETE');
  });
});

// ============================================================================
// ACTIVITIES API - additional methods
// ============================================================================
describe('Given activitiesApi additional', () => {
  it('When action / Then update sends PATCH', async () => {
    mockFetchSuccess({ id: 'a1', type: 'CALL', notes: 'Updated' });
    const result = await activitiesApi.update('a1', { notes: 'Updated' });
    expect(result.notes).toBe('Updated');
  });

  it('When action / Then delete sends DELETE request', async () => {
    mockFetchSuccess({});
    await activitiesApi.delete('a1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/activities/a1');
    expect(opts.method).toBe('DELETE');
  });
});

// ============================================================================
// CUSTOMERS API - additional methods
// ============================================================================
describe('Given customersApi additional', () => {
  it('When action / Then getStats fetches customer stats', async () => {
    mockFetchSuccess({ total: 50 });
    const result = await customersApi.getStats();
    expect(result.total).toBe(50);
  });

  it('When action / Then promote sends PATCH to promote endpoint', async () => {
    mockFetchSuccess({ type: 'customer' });
    const result = await customersApi.promote('l1');
    expect(result.type).toBe('customer');
  });

  it('When action / Then validateTaxId sends PATCH', async () => {
    mockFetchSuccess({ valid: true });
    const result = await customersApi.validateTaxId('c1', 'TAX123');
    expect(result.valid).toBe(true);
  });

  it('When action / Then updateCreditLimit sends PATCH', async () => {
    mockFetchSuccess({ credit_limit: 10000 });
    const result = await customersApi.updateCreditLimit('When action / Then c1', 10000);
    expect(result.credit_limit).toBe(10000);
  });
});
