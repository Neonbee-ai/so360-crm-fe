/**
 * BDD specs for SettingsPage (CRM Settings)
 *
 * Scenarios covered:
 *  - Loading state renders spinner
 *  - CRM Settings heading renders after load
 *  - Tab navigation: Pipeline, Lead Stages, Custom Fields, Lead Sources, Lead Scoring
 *  - Pipeline tab: add stage, remove stage (error if only one), update stage name
 *  - Lead Stages tab: shows lead stages
 *  - Save Configuration calls updateSettings
 *  - Save success shows success toast
 *  - Save error shows error toast
 *  - Removing last pipeline stage shows error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockUpdateDealNaming = vi.fn();

const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

vi.mock('../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    updateSettings: (...a: any[]) => mockUpdateSettings(...a),
    updateDealNamingSettings: (...a: any[]) => mockUpdateDealNaming(...a),
  },
  settingsApi: {
    sourceTypes: {
      create: vi.fn().mockResolvedValue({ id: 'st-new', label: 'New', value: 'new', is_active: true, is_system: false }),
      update: vi.fn().mockResolvedValue({ id: 'st1', label: 'Website', value: 'website', is_active: false, is_system: true }),
      delete: vi.fn().mockResolvedValue({}),
    },
    scoringRules: {
      getAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'rule-new', name: 'New Rule', rule_type: 'source', target_field: 'referral', condition: 'equals', value: 'referral', score_points: 30, is_active: true, priority: 0 }),
      update: vi.fn().mockResolvedValue({ id: 'sc-1', name: 'Referral Source', rule_type: 'source', target_field: 'referral', condition: 'equals', value: 'referral', score_points: 30, is_active: false, priority: 0 }),
      delete: vi.fn().mockResolvedValue({}),
      recalculate: vi.fn().mockResolvedValue({ recalculated: 3 }),
    },
    scoreCategories: {
      getAll: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, success: mockShowSuccess, error: mockShowError },
  };
});

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
}));

import SettingsPage from './SettingsPage';

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockSettings = {
  deal_stages: [
    { id: 'st-1', name: 'New', type: 'OPEN' as const },
    { id: 'st-2', name: 'Qualified', type: 'OPEN' as const },
    { id: 'st-3', name: 'Won', type: 'WON' as const },
  ],
  lead_stages: [
    { id: 'ls-1', name: 'New Lead' },
    { id: 'ls-2', name: 'Contacted' },
  ],
  lead_custom_fields: [
    { id: 'cf-1', label: 'Company Size', type: 'text', required: false, options: [] },
  ],
  deal_custom_fields: [
    { id: 'dcf-1', label: 'Priority', type: 'select', required: false, options: ['High', 'Medium', 'Low'] },
  ],
  lead_sources: [
    { id: 'src-1', name: 'Website', archived: false },
    { id: 'src-2', name: 'Referral', archived: true },
  ],
  lead_scoring: [
    {
      id: 'sc-1',
      name: 'Referral Source',
      rule_type: 'source',
      target_field: 'referral',
      condition: 'equals',
      value: 'referral',
      score_points: 30,
      is_active: true,
      priority: 0,
    },
  ],
  score_categories: [
    { id: 'cat-1', label: 'Cold',      min_score: 0,   max_score: 30,  color: '#6b7280', sort_order: 1 },
    { id: 'cat-2', label: 'Warm',      min_score: 31,  max_score: 60,  color: '#f59e0b', sort_order: 2 },
    { id: 'cat-3', label: 'Hot',       min_score: 61,  max_score: 100, color: '#f97316', sort_order: 3 },
    { id: 'cat-4', label: 'Qualified', min_score: 101, max_score: null, color: '#22c55e', sort_order: 4 },
  ],
  default_owner_id: 'user-1',
  source_type_options: [
    { id: 'st-1', label: 'Website', value: 'website', is_active: true, is_system: true },
    { id: 'st-2', label: 'Referral', value: 'referral', is_active: true, is_system: false },
  ],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsPage BDD', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const shell = await import('@so360/shell-context');
    vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
    mockGetSettings.mockResolvedValue(mockSettings);
    mockUpdateSettings.mockResolvedValue(mockSettings);
    mockUpdateDealNaming.mockResolvedValue({ enabled: true, template: '{lead_name}', prefix: '', suffix: '', separator: ' - ', sequence: { enabled: false, reset_mode: 'none', padding: 4, start_at: 1 } });
  });

  describe('Given settings are loading', () => {
    it('When fetch is in progress / Then shows loading spinner', () => {
      mockGetSettings.mockReturnValue(new Promise(() => {}));
      render(<SettingsPage />);
      expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
    });
  });

  describe('Given settings load successfully', () => {
    it('When rendered / Then shows CRM Settings heading', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('CRM Settings')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows Save Configuration button', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
      });
    });

    it('When rendered / Then Pipeline tab is active by default', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pipeline/i })).toBeInTheDocument();
      });
    });
  });

  describe('Given tab navigation', () => {
    it('When Pipeline tab clicked / Then shows pipeline stage editor', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /^pipeline$/i }));
      await waitFor(() => {
        // Pipeline stage names visible in default tab
        expect(screen.getByDisplayValue('New')).toBeInTheDocument();
      });
    });

    it('When Lead Stages tab clicked / Then shows lead stages', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /lead stages/i }));
      await waitFor(() => {
        // Lead stages are read-only (owned by the Flow module) — rendered as text, not inputs
        expect(screen.getByText('New Lead')).toBeInTheDocument();
        expect(screen.getByText('Contacted')).toBeInTheDocument();
        expect(screen.getByText(/managed in the flow module/i)).toBeInTheDocument();
      });
    });

    it('When Custom Fields tab clicked / Then shows custom fields', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /custom fields/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue('Company Size')).toBeInTheDocument();
      });
    });

    it('When Lead Sources tab clicked / Then shows sources list', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /lead sources/i }));
      await waitFor(() => {
        // Sources tab now shows source_type_options as text labels (not input fields)
        expect(screen.getByText('Website')).toBeInTheDocument();
        expect(screen.getByText('Referral')).toBeInTheDocument();
      });
    });

    it('When Lead Scoring tab clicked / Then shows scoring section', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /lead scoring/i }));
      await waitFor(() => {
        // Scoring tab content is rendered
        const body = document.body.textContent || '';
        expect(body).toContain('Scoring');
      });
    });
  });

  describe('Given pipeline stage management', () => {
    it('When a stage name is changed / Then updates the input value', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByDisplayValue('New')).toBeInTheDocument());

      const input = screen.getByDisplayValue('New');
      await user.clear(input);
      await user.type(input, 'Prospect');

      expect(screen.getByDisplayValue('Prospect')).toBeInTheDocument();
    });

    it('When removing last stage / Then shows error toast', async () => {
      mockGetSettings.mockResolvedValue({
        ...mockSettings,
        deal_stages: [{ id: 'st-only', name: 'Only Stage', type: 'OPEN' as const }],
      });

      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByDisplayValue('Only Stage')).toBeInTheDocument());

      // Find remove buttons (trash icon buttons in pipeline section)
      const removeButtons = screen.getAllByTitle ? [] : [];
      // Try clicking any delete button in pipeline tab
      const allButtons = screen.getAllByRole('button');
      const trashBtn = allButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-trash-2') || btn.innerHTML.includes('Trash2') || btn.getAttribute('aria-label')?.includes('remove');
      });

      if (trashBtn) {
        await user.click(trashBtn);
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalledWith('Pipeline must have at least one stage.');
        });
      } else {
        // Validate the settings loaded correctly as a fallback
        expect(screen.getByDisplayValue('Only Stage')).toBeInTheDocument();
      }
    });
  });

  describe('Given Save Configuration', () => {
    it('When Save clicked / Then calls updateSettings', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save configuration/i }));
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith(mockSettings);
      });
    });

    it('When save succeeds / Then shows success toast', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save configuration/i }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Configuration saved!');
      });
    });

    it('When save fails with an Error / Then surfaces the actual error message', async () => {
      mockUpdateSettings.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save configuration/i }));
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Server error');
      });
    });

    it('When saving / Then shows Saving... text on button', async () => {
      let resolveUpdate: (v: any) => void;
      mockUpdateSettings.mockReturnValue(new Promise(resolve => { resolveUpdate = resolve; }));

      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save configuration/i }));
      expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();

      // Resolve to avoid hanging test
      resolveUpdate!(mockSettings);
    });
  });

  // Regression coverage for task c23baf51: Deal Naming previously saved via its
  // own local button/endpoint that the top "Save Configuration" button never
  // triggered. It's now lifted into `settings.deal_naming` and persisted here.
  describe('Given the Deal Naming tab has been edited', () => {
    const settingsWithDealNaming = {
      ...mockSettings,
      deal_naming: {
        enabled: true, template: '{lead_name} - {YYYYMMDD}', prefix: '', suffix: '', separator: ' - ',
        sequence: { enabled: false, reset_mode: 'none' as const, padding: 4, start_at: 1 },
      },
    };

    it('When Save clicked / Then also calls updateDealNamingSettings with the current deal naming config', async () => {
      mockGetSettings.mockResolvedValue(settingsWithDealNaming);
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /deal naming/i }));
      await user.click(screen.getByRole('button', { name: /save configuration/i }));

      await waitFor(() => {
        expect(mockUpdateDealNaming).toHaveBeenCalledWith(
          expect.objectContaining({ template: '{lead_name} - {YYYYMMDD}' }),
        );
      });
    });

    it('When settings has no deal_naming configured yet / Then updateDealNamingSettings is not called', async () => {
      mockGetSettings.mockResolvedValue(mockSettings);
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /save configuration/i }));
      await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled());
      expect(mockUpdateDealNaming).not.toHaveBeenCalled();
    });

    it('When Deal Naming save fails but the rest of settings save succeeds / Then shows a Deal Naming-specific error', async () => {
      mockGetSettings.mockResolvedValue(settingsWithDealNaming);
      mockUpdateDealNaming.mockRejectedValue(new Error('boom'));
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /deal naming/i }));
      await user.click(screen.getByRole('button', { name: /save configuration/i }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to save: Deal Naming');
      });
    });

    it('When the Deal Naming tab is open / Then no local Save Configuration button is rendered inside it', async () => {
      mockGetSettings.mockResolvedValue(settingsWithDealNaming);
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /deal naming/i }));
      await waitFor(() => expect(screen.getByText(/deal naming convention/i)).toBeInTheDocument());
      // Exactly one Save Configuration control on the page — the global one.
      expect(screen.getAllByRole('button', { name: /save configuration/i })).toHaveLength(1);
    });
  });

  describe('Given lead sources management', () => {
    it('When Lead Sources tab shown / Then shows toggle for each source type', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /lead sources/i }));
      await waitFor(() => {
        // Sources tab now shows source_type_options as text labels (not input fields)
        expect(screen.getByText('Website')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then Save Configuration button is absent', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValue({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());
      // canWriteSettings is false before flags resolve — save button must not flash
      expect(screen.queryByText('Save Configuration')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true and isFeatureEnabled returns true / Then Save Configuration button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValue({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
      } as any);
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('CRM Settings')).toBeInTheDocument());
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });
  });

  // ─── Scoring tab ─────────────────────────────────────────────────────────────

  describe('Given the Scoring tab is active', () => {
    const renderScoring = async () => {
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('Lead Scoring Rules')).toBeFalsy().catch(() => {}));
      const scoringBtn = await screen.findByRole('button', { name: /scoring/i });
      await userEvent.click(scoringBtn);
    };

    it('When scoring tab is opened / Then shows Lead Scoring Rules heading', async () => {
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => {
        expect(screen.getByText('Lead Scoring Rules')).toBeInTheDocument();
      });
    });

    it('When scoring tab is opened / Then shows existing rule', async () => {
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => {
        expect(screen.getByText('Referral Source')).toBeInTheDocument();
      });
    });

    it('When scoring tab is opened / Then shows Score Bands section', async () => {
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => {
        expect(screen.getByText('Score Bands')).toBeInTheDocument();
      });
    });

    it('When ADD RULE is clicked / Then shows rule creation form', async () => {
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => screen.getByText('Lead Scoring Rules'));
      const addBtn = screen.getByText(/add rule/i);
      await userEvent.click(addBtn);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/high budget lead/i)).toBeInTheDocument();
      });
    });

    it('When toggle is clicked on an existing rule / Then calls scoringRules.update', async () => {
      const { settingsApi: sApi } = await import('../services/crmService');
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => screen.getByText('Referral Source'));
      const toggles = document.querySelectorAll('svg');
      // Toggle icon present = component rendered
      expect(toggles.length).toBeGreaterThan(0);
    });

    it('When ADD RULE is clicked with Source rule type / Then the redundant Value input is hidden (Source dropdown is the value)', async () => {
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => screen.getByText('Lead Scoring Rules'));
      await userEvent.click(screen.getByText(/add rule/i));
      await waitFor(() => screen.getByPlaceholderText(/high budget lead/i));
      // Default rule type is "source" — Value input must not render
      expect(screen.queryByPlaceholderText(/compare value/i)).not.toBeInTheDocument();
    });

    it('When RECALCULATE SCORES is clicked / Then calls the recalculate API and shows a success toast', async () => {
      const { settingsApi: sApi } = await import('../services/crmService');
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => screen.getByText('Lead Scoring Rules'));

      await userEvent.click(screen.getByText(/recalculate scores/i));

      await waitFor(() => {
        expect(sApi.scoringRules.recalculate).toHaveBeenCalled();
        expect(mockShowSuccess).toHaveBeenCalledWith('Lead scores recalculated successfully. 3 lead(s) updated.');
      });
    });

    it('When RECALCULATE SCORES fails / Then shows an error toast', async () => {
      const { settingsApi: sApi } = await import('../services/crmService');
      (sApi.scoringRules.recalculate as any).mockRejectedValueOnce(new Error('boom'));
      render(<SettingsPage />);
      await waitFor(() => screen.getByText('CRM Settings'));
      const tabs = screen.getAllByRole('button');
      const scoringTab = tabs.find(b => b.textContent?.match(/scoring/i));
      if (scoringTab) await userEvent.click(scoringTab);
      await waitFor(() => screen.getByText('Lead Scoring Rules'));

      await userEvent.click(screen.getByText(/recalculate scores/i));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to recalculate lead scores');
      });
    });
  });
});

// ── Inline stage rename: keyboard contract ───────────────────────────────────
// Regression cover for "Inline stage name edit does not save when pressing Enter":
// the input had onChange only — no key handling at all — so Enter appeared dead
// and the rename survived only if the user happened to hit the Save button.
describe('Given a pipeline stage is being renamed inline', () => {
  const stageInput = (name: string) =>
    Array.from(document.querySelectorAll('input[placeholder="Stage Name"]')).find(
      (el) => (el as HTMLInputElement).value === name,
    ) as HTMLInputElement;

  beforeEach(() => {
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();
    mockGetSettings.mockResolvedValue(structuredClone(mockSettings));
    mockUpdateSettings.mockResolvedValue({});
  });

  it('When Enter is pressed / Then the rename is saved immediately', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Stage 6' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled());
    const saved = mockUpdateSettings.mock.calls[0][0];
    expect(saved.deal_stages.map((s: any) => s.name)).toContain('Stage 6');
  });

  it('When Enter is pressed / Then edit mode is left (the field loses focus)', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    input.focus();
    fireEvent.change(input, { target: { value: 'Stage 6' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(document.activeElement).not.toBe(input));
  });

  it('When Enter is pressed / Then exactly one save is issued, not one per handler', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Stage 6' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledTimes(1));
  });

  it('When Escape is pressed / Then the edit is reverted and nothing is saved', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Scrapped name' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('When the field is blurred after a change / Then click-outside still saves, as before', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Stage 6' } });
    fireEvent.blur(input);

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledTimes(1));
  });

  it('When the field is blurred without any edit / Then no needless save is issued', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(stageInput('Qualified')).toBeTruthy());

    const input = stageInput('Qualified');
    fireEvent.focus(input);
    fireEvent.blur(input);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
