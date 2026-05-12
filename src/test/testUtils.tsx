import React from 'react';
import { vi } from 'vitest';

// ============================================================================
// Shared mock factories for CRM FE tests
// ============================================================================

// Standard react-router-dom mock
export const mockNavigate = vi.fn();
export const mockUseParams = vi.fn(() => ({ id: 'test-id' }));
export const mockSearchParams = new URLSearchParams();
export const mockSetSearchParams = vi.fn();

// Standard shell context mock
export const mockShellContext = {
  user: { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null },
  tenantId: 'tenant-1',
  orgId: 'org-1',
  accessToken: 'test-token',
  currentTenant: { id: 'tenant-1' },
  currentOrg: { id: 'org-1' },
  isFeatureEnabled: vi.fn().mockReturnValue(true),
  isFeatureHidden: vi.fn().mockReturnValue(false),
  isModuleEnabled: vi.fn().mockReturnValue(true),
};

// Standard crmService mock data
export const mockSettings = {
  deal_stages: [{ id: 'stage-1', name: 'Lead', type: 'OPEN' }, { id: 'stage-2', name: 'Won', type: 'WON' }],
  lead_stages: [{ id: 'ls-1', name: 'Open' }, { id: 'ls-2', name: 'Qualified' }],
  lead_custom_fields: [],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [],
  default_owner_id: 'user-1',
};

export const mockDashboardStats = {
  financials: { totalRevenue: 50000, pipelineValue: 100000, avgDealSize: 25000, winRate: 65.5 },
  counts: { leads: 10, deals: 5, tasks: 3, reminders: 1 },
  teamStats: [
    {
      user: { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null, role: 'Sales Rep' },
      revenue: 50000, dealCount: 2, activeLeads: 5, activityCount: 10, conversionRate: 40.0,
    },
  ],
  monthlyRevenue: Array(12).fill(0),
  chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  reminders: [],
};

export const mockUsers = [
  { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null },
  { id: 'user-2', full_name: 'Other User', email: 'other@test.com', avatar_url: null },
];
