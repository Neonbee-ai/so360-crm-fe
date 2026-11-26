import { describe, it, expect, vi, beforeEach } from 'vitest';

const loaded = vi.hoisted(() => new Set<string>());
const stub = vi.hoisted(() => (name: string) => () => { loaded.add(name); return { default: () => null }; });

vi.mock('./pages/DashboardPage', stub('dashboard'));
vi.mock('./pages/Customer360Page', stub('customer360'));
vi.mock('./pages/LeadsPage', stub('leads'));
vi.mock('./pages/PipelinePage', stub('pipeline'));
vi.mock('./pages/LeadDetailPage', stub('leadDetail'));
vi.mock('./pages/DealDetailPage', stub('dealDetail'));

async function evalAppAt(pathname: string) {
  window.history.pushState({}, '', pathname);
  vi.resetModules();
  loaded.clear();
  await import('./App');
  // Let the dynamic import() promises settle.
  await new Promise((r) => setTimeout(r, 0));
  return new Set(loaded);
}

beforeEach(() => loaded.clear());

describe('Given a deep link into the CRM remote', () => {
  it.each([
    ['/crm/dashboard', 'dashboard'],
    ['/crm/leads', 'leads'],
    ['/crm/pipeline', 'pipeline'],
    ['/crm/customers/abc/360', 'customer360'],
    ['/crm/leads/abc', 'leadDetail'],
    ['/crm/deal/abc', 'dealDetail'],
  ])('When the module evaluates at %s, Then only the %s chunk starts downloading', async (path, chunk) => {
    const started = await evalAppAt(path);
    expect([...started]).toEqual([chunk]);
  });

  it('When the module evaluates at an unrelated route, Then no landing page chunk is requested', async () => {
    const started = await evalAppAt('/crm/settings');
    expect([...started]).toEqual([]);
  });
});
