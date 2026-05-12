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
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

import SettingsPage from './SettingsPage';

const settings = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue(settings);
  mockUpdateSettings.mockResolvedValue(settings);
});

describe('SettingsPage', () => {
  it('shows loading spinner initially', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    render(<SettingsPage />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it('renders settings page with pipeline tab by default', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Lead')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Won')).toBeInTheDocument();
    });
  });

  it('saves settings when Save button is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/save configuration/i));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith('Configuration saved!');
    });
  });

  it('shows error when save fails', async () => {
    mockUpdateSettings.mockRejectedValue(new Error('fail'));
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/save configuration/i));
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Error saving settings.');
    });
  });

  it('adds a new pipeline stage', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/add stage/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('New Stage')).toBeInTheDocument();
    });
  });

  it('removes a pipeline stage', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Lead')).not.toBeInTheDocument();
    });
  });

  it('prevents removing last pipeline stage', async () => {
    mockGetSettings.mockResolvedValue({
      ...settings,
      deal_stages: [{ id: 's1', name: 'Only', type: 'OPEN' }],
    });
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Only'));
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
    expect(mockShowError).toHaveBeenCalledWith('Pipeline must have at least one stage.');
  });

  it('edits pipeline stage name', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const input = screen.getByDisplayValue('Lead');
    fireEvent.change(input, { target: { value: 'Prospect' } });
    expect(screen.getByDisplayValue('Prospect')).toBeInTheDocument();
  });

  it('changes pipeline stage type', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    const selects = screen.getAllByDisplayValue('OPEN');
    fireEvent.change(selects[0], { target: { value: 'LOST' } });
    expect(screen.getByDisplayValue('LOST')).toBeInTheDocument();
  });

  it('switches to lead-stages tab', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('New')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Contacted')).toBeInTheDocument();
    });
  });

  it('adds and removes lead stages', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => screen.getByDisplayValue('New'));

    // Add
    const addButtons = screen.getAllByText(/add stage/i);
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(screen.getByDisplayValue('New Lead Stage')).toBeInTheDocument();

    // Remove one
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
  });

  it('prevents removing last lead stage', async () => {
    mockGetSettings.mockResolvedValue({
      ...settings,
      lead_stages: [{ id: 'ls1', name: 'Only' }],
    });
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => screen.getByDisplayValue('Only'));
    const removeButtons = screen.getAllByTitle('Remove Stage');
    fireEvent.click(removeButtons[0]);
    expect(mockShowError).toHaveBeenCalledWith('Lead stages must have at least one stage.');
  });

  it('edits lead stage name', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead stages/i));
    await waitFor(() => screen.getByDisplayValue('New'));
    fireEvent.change(screen.getByDisplayValue('New'), { target: { value: 'Fresh' } });
    expect(screen.getByDisplayValue('Fresh')).toBeInTheDocument();
  });

  it('switches to custom-fields tab and shows lead/deal fields', async () => {
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

  it('adds and removes lead custom fields', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/custom fields/i));
    await waitFor(() => screen.getByDisplayValue('Industry'));

    // Add lead field
    const addButtons = screen.getAllByText(/add/i);
    fireEvent.click(addButtons[0]);
    expect(screen.getByDisplayValue('New Field')).toBeInTheDocument();
  });

  it('edits lead custom field label and type', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/custom fields/i));
    await waitFor(() => screen.getByDisplayValue('Industry'));

    fireEvent.change(screen.getByDisplayValue('Industry'), { target: { value: 'Sector' } });
    expect(screen.getByDisplayValue('Sector')).toBeInTheDocument();
  });

  it('switches to sources tab and shows lead sources', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Website')).toBeInTheDocument();
    });
  });

  it('adds a new source', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByDisplayValue('Website'));
    fireEvent.click(screen.getByText(/add source/i));
    expect(screen.getByDisplayValue('New Source')).toBeInTheDocument();
  });

  it('edits source name', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByDisplayValue('Website'));
    fireEvent.change(screen.getByDisplayValue('Website'), { target: { value: 'LinkedIn' } });
    expect(screen.getByDisplayValue('LinkedIn')).toBeInTheDocument();
  });

  it('toggles archive on source', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead sources/i));
    await waitFor(() => screen.getByDisplayValue('Website'));
    const archiveBtn = screen.getByTitle(/archive/i);
    fireEvent.click(archiveBtn);
    // Source should now be archived (class change)
    expect(screen.getByDisplayValue('Website')).toBeInTheDocument();
  });

  it('switches to scoring tab and shows rules', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead scoring/i));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Has email')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });
  });

  it('adds a new scoring rule', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Lead'));
    fireEvent.click(screen.getByText(/lead scoring/i));
    await waitFor(() => screen.getByDisplayValue('Has email'));
    fireEvent.click(screen.getByText(/add rule/i));
    expect(screen.getByDisplayValue('New Rule')).toBeInTheDocument();
  });

  it('edits scoring rule criteria, type, and points', async () => {
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
