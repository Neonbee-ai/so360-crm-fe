import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TargetPlansPage from './TargetPlansPage';

/**
 * Given/When/Then coverage for the "rep plan with no owner" bug: a plan
 * created with owner_type 'rep' and no owner_id is invisible to every
 * person's /target-plans/me/overview query (see TargetPlansService.getOverview),
 * so the create form must never allow that combination to reach the API.
 */

const mockTargetPlanService = vi.hoisted(() => ({
  setTenantId: vi.fn(),
  setOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  listPlans: vi.fn(),
  listChannels: vi.fn(),
  provisionPacks: vi.fn(),
  createPlan: vi.fn(),
}));

const mockSalesTargetService = vi.hoisted(() => ({
  setTenantId: vi.fn(),
  setOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  listTaskTypes: vi.fn(),
  getMetricCatalog: vi.fn(),
  createTaskType: vi.fn(),
}));

const mockCrmService = vi.hoisted(() => ({
  getSalesReps: vi.fn(),
}));

vi.mock('../../services/targetPlanService', () => ({
  targetPlanService: mockTargetPlanService,
}));

vi.mock('../../services/salesTargetService', () => ({
  salesTargetService: mockSalesTargetService,
}));

vi.mock('../../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentTenant: { id: 't1' },
    currentOrg: { id: 'o1' },
    accessToken: 'token',
    hasPermission: () => true,
  }),
}));

const ONE_PERSON = [{ id: 'per1', full_name: 'Ada Lovelace' }];
const ONE_TASK_TYPE = [{ id: 'tt1', name: 'Calls Made', kind: 'COUNT', unit: 'count' }];

async function fillRequiredPlanFields() {
  fireEvent.change(screen.getByPlaceholderText('Sales Intern — Sep–Dec 2026'), {
    target: { value: 'Q4 Plan' },
  });
  const [startInput, endInput] = document.querySelectorAll('input[type="date"]');
  fireEvent.change(startInput, { target: { value: '2026-09-01' } });
  fireEvent.change(endInput, { target: { value: '2026-09-30' } });

  const addLineButton = await screen.findByRole('button', { name: /Add Metric Row/i });
  await waitFor(() => expect(addLineButton).not.toBeDisabled());
  fireEvent.click(addLineButton);
}

describe('TargetPlansPage — create form owner requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetPlanService.listPlans.mockResolvedValue([]);
    mockTargetPlanService.listChannels.mockResolvedValue([]);
    mockTargetPlanService.createPlan.mockResolvedValue({ id: 'p1' });
    mockSalesTargetService.listTaskTypes.mockResolvedValue(ONE_TASK_TYPE);
    mockSalesTargetService.getMetricCatalog.mockResolvedValue(null);
    mockCrmService.getSalesReps.mockResolvedValue(ONE_PERSON);
  });

  it('Given an individual (rep) plan with every field filled except the owner / When the form is otherwise complete / Then Save plan stays disabled', async () => {
    render(<TargetPlansPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'New plan' }));
    await fillRequiredPlanFields();

    const save = screen.getByRole('button', { name: /Save plan/i });
    expect(save).toBeDisabled();
    expect(mockTargetPlanService.createPlan).not.toHaveBeenCalled();
  });

  it('Given an individual plan with an owner selected / When Save plan is submitted / Then createPlan is called with that owner_id', async () => {
    render(<TargetPlansPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'New plan' }));
    await fillRequiredPlanFields();

    fireEvent.focus(screen.getByRole('combobox', { name: 'Person' }));
    fireEvent.click(await screen.findByText('Ada Lovelace'));

    const save = screen.getByRole('button', { name: /Save plan/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(mockTargetPlanService.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ owner_type: 'rep', owner_id: 'per1' }),
      ),
    );
  });

  it('Given the owner type is switched to Organisation / When the rest of the form is complete / Then Save plan is enabled without picking a person', async () => {
    render(<TargetPlansPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'New plan' }));

    fireEvent.change(screen.getByDisplayValue('Individual'), {
      target: { value: 'org' },
    });
    await fillRequiredPlanFields();

    expect(screen.getByRole('button', { name: /Save plan/i })).toBeEnabled();
  });
});
