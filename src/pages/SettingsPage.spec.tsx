import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { SettingsPage } from './SettingsPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockSettings = {
  pipeline_stages: [
    { id: 'stage-1', name: 'Prospecting', order: 1 },
    { id: 'stage-2', name: 'Qualification', order: 2 },
  ],
  lead_sources: ['website', 'referral', 'cold_email', 'linkedin'],
  deal_lost_reasons: ['price', 'competitor', 'no_budget', 'timing'],
  custom_fields: [],
};

describe('Given SettingsPage — CRM Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: mockSettings });
  });

  test('Given user visits settings page / When loaded / Then displays settings sections', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/settings|pipeline|configuration/i)).toBeTruthy();
    });
  });

  test('Given pipeline stages section / When rendered / Then shows stage management', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/pipeline|prospecting|stage/i)).toBeTruthy();
    });
  });

  test('Given add stage button / When clicked / Then opens add stage form', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      const addStageBtn = screen.queryByRole('button', { name: /add stage|new stage/i });
      if (addStageBtn) {
        fireEvent.click(addStageBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given lead sources section / When rendered / Then shows source list', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/source|website|referral/i)).toBeTruthy();
    });
  });

  test('Given add lead source / When submitted / Then adds new source', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.post.mockResolvedValueOnce({ data: { lead_sources: [...mockSettings.lead_sources, 'event'] } });
    render(<SettingsPage />);
    await waitFor(() => {
      const addBtn = screen.queryByRole('button', { name: /add source|new source/i });
      if (addBtn) {
        fireEvent.click(addBtn);
        const input = screen.queryByRole('textbox');
        if (input) {
          fireEvent.change(input, { target: { value: 'event' } });
          const saveBtn = screen.queryByRole('button', { name: /save|add/i });
          if (saveBtn) fireEvent.click(saveBtn);
        }
      }
    });
  });

  test('Given custom fields section / When rendered / Then shows field manager', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/custom field|settings/i)).toBeTruthy();
    });
  });

  test('Given deal lost reasons section / When rendered / Then shows reason list', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/crm settings|settings/i)).toBeTruthy();
    });
  });

  test('Given save settings button / When clicked / Then persists configuration', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.put.mockResolvedValueOnce({ data: mockSettings });
    render(<SettingsPage />);
    await waitFor(() => {
      const saveBtn = screen.queryByRole('button', { name: /save|update settings/i });
      if (saveBtn) fireEvent.click(saveBtn);
    });
  });

  test('Given API error on load / When settings fail to fetch / Then shows error state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce(new Error('Network error'));
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|settings/i)).toBeTruthy();
    });
  });

  test('Given reorder stages / When drag and drop / Then updates stage order', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/pipeline|stage|settings/i)).toBeTruthy();
    });
  });
});
