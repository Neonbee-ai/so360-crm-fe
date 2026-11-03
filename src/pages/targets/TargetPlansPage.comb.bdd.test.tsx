import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TargetPlansPage from './TargetPlansPage';

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

vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')) }));

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

const MUTED = 'rgb(var(--nb-fg-muted))';
const stage = (over: any = {}) => ({ stage_id: 's1', name: 'New', color: '#3B82F6', order: 1, linked: false, task_type_id: null, ...over });
const catalogOf = (lead_stage_metrics: any[]) => ({ stages_source: 'flow', lead_stage_metrics, standard_metrics: [], custom_metrics: [] });

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'New plan' }));
}
const addBtn = () => screen.findByRole('button', { name: /Lead Stage Metric/ });

describe('Feature: TargetPlans "+ Lead Stage Metric" Comb Button and stage dot token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetPlanService.listPlans.mockResolvedValue([]);
    mockTargetPlanService.listChannels.mockResolvedValue([]);
    mockSalesTargetService.listTaskTypes.mockResolvedValue([{ id: 'tt1', name: 'Calls', kind: 'COUNT', unit: 'count' }]);
    mockSalesTargetService.getMetricCatalog.mockResolvedValue(catalogOf([stage()]));
    mockSalesTargetService.createTaskType.mockResolvedValue({ id: 'tt9' });
    mockCrmService.getSalesReps.mockResolvedValue([]);
  });

  describe('Scenario: render / visibility', () => {
    it('Given a catalog with an unlinked stage When the form opens Then the button is a secondary sm Comb Button, enabled', async () => {
      render(<TargetPlansPage />);
      await openForm();
      const b = await addBtn();
      expect(b).toHaveAttribute('data-comb', 'button');
      expect(b).toHaveAttribute('data-variant', 'secondary');
      expect(b).toHaveAttribute('data-size', 'sm');
      expect(b).toHaveAttribute('type', 'button');
      expect(b).not.toBeDisabled();
      expect(b).toHaveAttribute('title', 'Add a CRM Lead Stage as a measurable metric');
    });
    it('Given the catalog is null When the form opens Then the button is not rendered', async () => {
      mockSalesTargetService.getMetricCatalog.mockResolvedValue(null);
      render(<TargetPlansPage />);
      await openForm();
      await screen.findByRole('button', { name: /Custom Metric/ });
      expect(screen.queryByRole('button', { name: /Lead Stage Metric/ })).toBeNull();
    });
    it('Given the catalog request rejects When the form opens Then the button is not rendered', async () => {
      mockSalesTargetService.getMetricCatalog.mockRejectedValue(new Error('x'));
      render(<TargetPlansPage />);
      await openForm();
      await screen.findByRole('button', { name: /Custom Metric/ });
      expect(screen.queryByRole('button', { name: /Lead Stage Metric/ })).toBeNull();
    });
  });

  describe('Scenario: disabled', () => {
    it('Given every stage is linked When the form opens Then the button is disabled with an explanatory title', async () => {
      mockSalesTargetService.getMetricCatalog.mockResolvedValue(catalogOf([stage({ linked: true, task_type_id: 'tt1' })]));
      render(<TargetPlansPage />);
      await openForm();
      const b = await addBtn();
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute('title', 'Every CRM Lead Stage already has a metric');
    });
    it('Given an empty stage list When clicked Then no modal opens', async () => {
      mockSalesTargetService.getMetricCatalog.mockResolvedValue(catalogOf([]));
      const user = userEvent.setup();
      render(<TargetPlansPage />);
      await openForm();
      await user.click(await addBtn());
      expect(screen.queryByText('Add Lead Stage Metric')).toBeNull();
    });
  });

  describe('Scenario: interaction', () => {
    it('When clicked Then the Add Lead Stage Metric modal opens listing unlinked stages as Comb Buttons', async () => {
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      expect(await screen.findByText('Add Lead Stage Metric')).toBeInTheDocument();
      const row = screen.getByRole('button', { name: 'New' });
      expect(row).toHaveAttribute('data-variant', 'secondary');
    });
    it('When focused and Enter pressed Then the modal opens', async () => {
      const user = userEvent.setup();
      render(<TargetPlansPage />);
      await openForm();
      (await addBtn()).focus();
      await user.keyboard('{Enter}');
      expect(await screen.findByText('Add Lead Stage Metric')).toBeInTheDocument();
    });
    it('When focused and Space pressed Then the modal opens', async () => {
      const user = userEvent.setup();
      render(<TargetPlansPage />);
      await openForm();
      (await addBtn()).focus();
      await user.keyboard(' ');
      expect(await screen.findByText('Add Lead Stage Metric')).toBeInTheDocument();
    });
    it('Given the modal is open When Close is clicked Then it closes', async () => {
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
      expect(screen.queryByText('Add Lead Stage Metric')).toBeNull();
    });
  });

  describe('Scenario: stage dot colour token', () => {
    const dot = (name: string) =>
      screen.getByRole('button', { name }).querySelector('span span[style], span[style]') as HTMLElement;
    it('Given a stage with its own colour When the modal opens Then the dot uses it', async () => {
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      expect(dot('New').getAttribute('style')).toMatch(/background-color:\s*(#3B82F6|rgb\(59, 130, 246\))/i);
    });
    it.each([['undefined', undefined], ['empty string', ''], ['null', null]])(
      'Given a stage colour that is %s When the modal opens Then the dot uses the muted token', async (_n, color) => {
        mockSalesTargetService.getMetricCatalog.mockResolvedValue(catalogOf([stage({ color })]));
        render(<TargetPlansPage />);
        await openForm();
        fireEvent.click(await addBtn());
        await screen.findByText('Add Lead Stage Metric');
        const el = dot('New');
        expect(el.style.backgroundColor === MUTED || (el.getAttribute('style') || '').includes('--nb-fg-muted') || el.outerHTML.includes('nb-fg-muted')).toBe(true);
      });
    it('Given a mix of linked and unlinked stages When the modal opens Then only unlinked are listed, ordered by order', async () => {
      mockSalesTargetService.getMetricCatalog.mockResolvedValue(catalogOf([
        stage({ stage_id: 'b', name: 'Beta', order: 2 }),
        stage({ stage_id: 'a', name: 'Alpha', order: 1 }),
        stage({ stage_id: 'c', name: 'Gamma', order: 3, linked: true, task_type_id: 'x' }),
      ]));
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      const dlg = screen.getByText('Add Lead Stage Metric').parentElement!.parentElement!;
      const names = Array.from(dlg.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t !== 'Close' && !/close/i.test(t));
      expect(names).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
      expect(names.indexOf('Alpha')).toBeLessThan(names.indexOf('Beta'));
      expect(names).not.toContain('Gamma');
    });
  });

  describe('Scenario: selecting a stage', () => {
    it('When a stage Button is clicked Then createTaskType gets the flow-transition payload, catalog refreshes and modal closes', async () => {
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      fireEvent.click(screen.getByRole('button', { name: 'New' }));
      await waitFor(() => expect(mockSalesTargetService.createTaskType).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New', source: 'FLOW_TRANSITION', flow_trigger: { entity_type: 'lead', to_state: 's1' }, kind: 'COUNT' }),
      ));
      await waitFor(() => expect(screen.queryByText('Add Lead Stage Metric')).toBeNull());
      expect(mockSalesTargetService.getMetricCatalog).toHaveBeenCalledTimes(2);
    });
    it('Given createTaskType rejects When a stage is clicked Then the error message is shown', async () => {
      mockSalesTargetService.createTaskType.mockRejectedValue(new Error('Nope'));
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      fireEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(await screen.findByText('Nope')).toBeInTheDocument();
    });
    it('Given createTaskType rejects without a message When clicked Then the fallback message is shown', async () => {
      mockSalesTargetService.createTaskType.mockRejectedValue({});
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      fireEvent.click(screen.getByRole('button', { name: 'New' }));
      expect(await screen.findByText('Failed to add lead stage metric')).toBeInTheDocument();
    });
    it('Given the saving stage When createTaskType is pending Then that stage button is disabled', async () => {
      let release: (v: any) => void = () => {};
      mockSalesTargetService.createTaskType.mockReturnValue(new Promise(r => { release = r; }));
      render(<TargetPlansPage />);
      await openForm();
      fireEvent.click(await addBtn());
      await screen.findByText('Add Lead Stage Metric');
      fireEvent.click(screen.getByRole('button', { name: 'New' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'New' })).toBeDisabled());
      release({ id: 'tt9' });
    });
  });
});
