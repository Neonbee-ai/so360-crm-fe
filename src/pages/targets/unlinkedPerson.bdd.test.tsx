import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MyTargetsPage from './MyTargetsPage';
import PerformanceHistoryPage from './PerformanceHistoryPage';
import MeasurementPage from './MeasurementPage';
import { isUnlinkedPayload } from './targetUi';

const svc = vi.hoisted(() => ({
  setTenantId: vi.fn(),
  setOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  myOverview: vi.fn(),
  myHistory: vi.fn(),
  myMeasurement: vi.fn(),
}));

vi.mock('@so360/design-system', async () => ({ ...(await import('../../test/__mocks__/design-system')) }));
vi.mock('../../services/targetPlanService', () => ({ targetPlanService: svc }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentTenant: { id: 't1' },
    currentOrg: { id: 'o1' },
    accessToken: 'token',
    hasPermission: () => true,
  }),
}));

const UNLINKED = { linked: false, person_id: null, plans: [], metrics: [], periods: [] };
const TITLE = /isn't linked to People Connect/i;

describe('Feature: unlinked user opens a personal targets page', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Scenario: payload detection', () => {
    it('Given linked:false / When checked / Then it is unlinked', () => {
      expect(isUnlinkedPayload(UNLINKED)).toBe(true);
    });
    it('Given a normal linked payload without the flag / When checked / Then it is not unlinked', () => {
      expect(isUnlinkedPayload({ person_id: 'p1', plans: [] })).toBe(false);
    });
    it('Given linked:true / When checked / Then it is not unlinked', () => {
      expect(isUnlinkedPayload({ linked: true })).toBe(false);
    });
    it('Given null / When checked / Then it is not unlinked', () => {
      expect(isUnlinkedPayload(null)).toBe(false);
    });
  });

  describe('Scenario: My Targets', () => {
    it('Given the API returns linked:false / When the page loads / Then the linking empty state shows, not an error', async () => {
      svc.myOverview.mockResolvedValue(UNLINKED);
      render(<MyTargetsPage />);
      expect(await screen.findByText(TITLE)).toBeTruthy();
      expect(screen.queryByText(/couldn't load this page/i)).toBeNull();
    });
  });

  describe('Scenario: Performance History', () => {
    it('Given the API returns linked:false / When the page loads / Then the linking empty state shows', async () => {
      svc.myHistory.mockResolvedValue(UNLINKED);
      render(<PerformanceHistoryPage />);
      await waitFor(() => expect(screen.getByText(TITLE)).toBeTruthy());
    });
  });

  describe('Scenario: Measurement', () => {
    it('Given the API returns linked:false / When the page loads / Then the linking empty state shows', async () => {
      svc.myMeasurement.mockResolvedValue(UNLINKED);
      render(<MeasurementPage />);
      await waitFor(() => expect(screen.getByText(TITLE)).toBeTruthy());
    });
  });
});
