import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

let flagOn = true;
const mockCreateTask = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: vi.fn().mockResolvedValue([{ id: 'u1', full_name: 'Test User', email: 't@t.com', avatar_url: null }]),
    createTask: (...a: any[]) => mockCreateTask(...a),
    updateTask: vi.fn(),
    getLeads: vi.fn().mockResolvedValue([]),
    getDeals: vi.fn().mockResolvedValue([]),
    searchProjects: vi.fn().mockResolvedValue([]),
    getProjectById: vi.fn(),
    connectTaskToProject: vi.fn(),
    getProjectTeamUserIds: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShell: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useNotify: () => ({ emitNotification: vi.fn() }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => flagOn, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));
vi.mock('../../utils/taskUtils', () => ({ canCurrentUserBeAssigned: () => true }));

import TaskModal from './TaskModal';

const futureDate = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];

const fill = async () => {
  await waitFor(() => screen.getByPlaceholderText(/follow up/i));
  fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Call back' } });
  const dates = document.querySelectorAll('input[type="date"]');
  fireEvent.change((dates[1] ?? dates[0]) as HTMLInputElement, { target: { value: futureDate } });
};

beforeEach(() => { flagOn = true; mockCreateTask.mockReset().mockResolvedValue({ id: 't1' }); });

describe('Given the task_reminders flag', () => {
  it('When on and a TODO task has an offset Then it is sent as reminder_offset_minutes', async () => {
    render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
    await fill();
    fireEvent.change(document.querySelector('input[name="task-reminder-offset"]')!, { target: { value: '45' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ reminder_offset_minutes: 45 })));
  });
  it('When on and the offset is blank Then the payload omits it (org default applies)', async () => {
    render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
    await fill();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0]).not.toHaveProperty('reminder_offset_minutes');
  });
  it('When off Then the field is hidden and nothing is sent', async () => {
    flagOn = false;
    render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
    await fill();
    expect(document.querySelector('input[name="task-reminder-offset"]')).toBeNull();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0]).not.toHaveProperty('reminder_offset_minutes');
  });
  it('When the type is REMINDER Then the per-task offset field is hidden', async () => {
    render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => screen.getByPlaceholderText(/follow up/i));
    fireEvent.change(document.querySelector('select[name="task-type"]')!, { target: { value: 'REMINDER' } });
    expect(document.querySelector('input[name="task-reminder-offset"]')).toBeNull();
  });
});
