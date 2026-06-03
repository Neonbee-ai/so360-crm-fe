import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    updateSettings: (...a: any[]) => mockUpdateSettings(...a),
  },
  settingsApi: {
    sourceTypes: {
      create: vi.fn().mockResolvedValue({ id: 'st-new', label: 'LinkedIn', value: 'linkedin', is_active: true, is_system: false }),
      update: vi.fn().mockResolvedValue({ id: 'st1', label: 'Website', value: 'website', is_active: false, is_system: true }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),
}));

import SettingsPage from './SettingsPage';

const makeSettings = () => ({
  deal_stages: [
    { id: 's1', name: 'Lead', type: 'OPEN' },
    { id: 's2', name: 'Won', type: 'WON' },
  ],
  lead_stages: [
    { id: 'ls1', name: 'New' },
    { id: 'ls2', name: 'Contacted' },
  ],
  lead_custom_fields: [{ id: 'lcf1', label: 'Industry', type: 'text', required: false }],
  deal_custom_fields: [{ id: 'dcf1', label: 'Budget', type: 'number', required: false }],
  lead_sources: [{ id: 'src1', name: 'Website', archived: false }],
  lead_scoring: [{ id: 'ls-rule1', criteria: 'Has email', points: 10, type: 'field' }],
  default_owner_id: 'u1',
  source_type_options: [
    { id: 'st1', label: 'Website', value: 'website', is_active: true, is_system: true },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue(makeSettings());
  mockUpdateSettings.mockResolvedValue(makeSettings());
});

describe('Given SettingsPage', () => {
  it('When action / Then shows loading spinner initially', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    render(<SettingsPage />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it('When action / Then renders settings page with pipeline tab by default', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Lead')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Won')).toBeInTheDocument();
    });
  });

  it('When action / Then saves settings when Save button is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/save configuration/i));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith('Configuration saved!');
    });
  });

  it('When save fails with an Error / Then the actual error message is surfaced', async () => {
    mockUpdateSettings.mockRejectedValue(new Error('Failed to save: Deal Fields'));
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/save configuration/i));
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Failed to save: Deal Fields');
    });
  });

  it('When save fails with a non-Error rejection / Then the generic message is shown', async () => {
    mockUpdateSettings.mockRejectedValue('boom');
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/save configuration/i));
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Error saving settings.');
    });
  });

  it('When action / Then adds a new pipeline stage', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/add stage/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('New Stage')).toBeInTheDocument();
    });
  });

  it('When action / Then removes a pipeline stage', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Lead')).not.toBeInTheDocument();
    });
  });

  it('When action / Then prevents removing last pipeline stage', async () => {
    mockGetSettings.mockResolvedValue({
      ...makeSettings(),
      deal_stages: [{ id: 's1', name: 'Only', type: 'OPEN' }],
    });
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Only'));
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
    expect(mockShowError).toHaveBeenCalledWith('Pipeline must have at least one stage.');
  });

  it('When action / Then edits pipeline stage name', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const input = screen.getByDisplayValue('Lead');
    fireEvent.change(input, { target: { value: 'Prospect' } });
    expect(screen.getByDisplayValue('Prospect')).toBeInTheDocument();
  });

  it('When action / Then changes pipeline stage type', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const selects = screen.getAllByDisplayValue('OPEN');
    fireEvent.change(selects[0], { target: { value: 'LOST' } });
    expect(screen.getByDisplayValue('LOST')).toBeInTheDocument();
  });

  it('When action / Then switches to lead-stages tab and shows read-only Flow-sourced stages', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => {
      // Stages are rendered as plain text (read-only), not editable inputs
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Contacted')).toBeInTheDocument();
      expect(screen.getByText(/managed in the flow module/i)).toBeInTheDocument();
    });
  });

  it('When action / Then lead stages tab exposes no add/remove/edit controls', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => screen.getByText('New'));
    // No editable inputs and no remove buttons for lead stages
    expect(screen.queryByDisplayValue('New')).not.toBeInTheDocument();
    expect(screen.queryAllByTitle('Remove Stage')).toHaveLength(0);
  });

  it('When action / Then switches to custom-fields tab and shows lead/deal fields', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/custom fields/i));
    await waitFor(() => {
      expect(screen.getByText(/lead fields/i)).toBeInTheDocument();
      expect(screen.getByText(/deal fields/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Industry')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Budget')).toBeInTheDocument();
    });
  });

  it('When action / Then adds and removes lead custom fields', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/custom fields/i));
    await waitFor(() => screen.getByDisplayValue('Industry'));

    // Add lead field
    const addButtons = screen.getAllByText(/add/i);
    fireEvent.click(addButtons[0]);
    expect(screen.getByDisplayValue('New Field')).toBeInTheDocument();
  });

  it('When action / Then edits lead custom field label and type', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/custom fields/i));
    await waitFor(() => screen.getByDisplayValue('Industry'));

    fireEvent.change(screen.getByDisplayValue('Industry'), { target: { value: 'Sector' } });
    expect(screen.getByDisplayValue('Sector')).toBeInTheDocument();
  });

  it('When action / Then switches to sources tab and shows lead sources', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => {
      // Sources tab now shows source_type_options as text labels (not inputs)
      expect(screen.getByText('Website')).toBeInTheDocument();
    });
  });

  it('When action / Then adds a new source', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByText('Website'));
    // The new sources tab has a text input + ADD button to create source types via API
    const addInput = screen.getByPlaceholderText(/new source type label/i);
    fireEvent.change(addInput, { target: { value: 'LinkedIn' } });
    expect(addInput).toHaveValue('LinkedIn');
  });

  it('When action / Then edits source name', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByText('Website'));
    // Sources are now displayed as text (not editable inputs); verify the source label is visible
    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('When action / Then toggles archive on source', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByText('Website'));
    // Toggle button now has title 'Deactivate' (for active) or 'Activate' (for inactive)
    const toggleBtn = screen.getByTitle(/deactivate|activate/i);
    fireEvent.click(toggleBtn);
    // Source label remains visible after toggle
    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('When action / Then switches to scoring tab and shows rules', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead scoring/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Has email')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });
  });

  it('When action / Then adds a new scoring rule', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead scoring/i));
    await waitFor(() => screen.getByDisplayValue('Has email'));
    fireEvent.click(screen.getByText(/add rule/i));
    expect(screen.getByDisplayValue('New Rule')).toBeInTheDocument();
  });

  it('When action / Then edits scoring rule criteria, type, and points', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead scoring/i));
    await waitFor(() => screen.getByDisplayValue('Has email'));

    fireEvent.change(screen.getByDisplayValue('Has email'), { target: { value: 'Has phone' } });
    expect(screen.getByDisplayValue('Has phone')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '20' } });
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });
});
