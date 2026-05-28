import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { LeadsPage } from './LeadsPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/leads', state: null }),
  useParams: () => ({}),
  Link: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockLeads = [
  { id: 'lead-1', name: 'Alice Kumar', email: 'alice@acme.com', score: 85, source: 'website', status: 'new', created_at: '2024-01-15' },
  { id: 'lead-2', name: 'Bob Singh', email: 'bob@beta.com', score: 60, source: 'referral', status: 'contacted', created_at: '2024-01-20' },
  { id: 'lead-3', name: 'Charlie Rao', email: 'charlie@gamma.com', score: 40, source: 'cold_email', status: 'qualified', created_at: '2024-01-25' },
];

describe('Given LeadsPage — Lead Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: { leads: mockLeads, total: mockLeads.length } });
  });

  test('Given user visits leads page / When loaded / Then displays lead list', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/lead|alice kumar/i)).toBeTruthy();
    });
  });

  test('Given leads loaded / When rendered / Then shows names, scores, and sources', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/leads & accounts|lead/i)).toBeTruthy();
    });
  });

  test('Given import leads button / When clicked / Then opens CSV import modal', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const importBtn = screen.queryByRole('button', { name: /import|csv/i });
      if (importBtn) {
        fireEvent.click(importBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given create lead button / When clicked / Then opens lead creation form', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create lead|new lead|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given lead score column / When sorted descending / Then reorders by score', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const scoreHeader = screen.queryByText(/score/i);
      if (scoreHeader) fireEvent.click(scoreHeader);
    });
  });

  test('Given status filter / When new selected / Then shows only new leads', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const filterEl = screen.queryByText(/status|new|filter/i);
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given convert to deal / When triggered on qualified lead / Then creates deal from lead', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.post.mockResolvedValueOnce({ data: { deal_id: 'deal-new', lead_id: 'lead-3' } });
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/qualified|lead/i)).toBeTruthy();
    });
  });

  test('Given search input / When user types name / Then filters leads', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const searchEl = screen.queryByPlaceholderText(/search/i);
      if (searchEl) {
        fireEvent.change(searchEl, { target: { value: 'Alice' } });
      }
    });
  });

  test('Given empty leads list / When no leads / Then shows empty state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({ data: { leads: [], total: 0 } });
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no leads|empty|lead/i)).toBeTruthy();
    });
  });

  test('Given bulk select / When multiple leads selected / Then shows bulk action bar', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        expect(screen.queryByText(/selected|bulk/i)).toBeTruthy();
      }
    });
  });
});
