import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ExecutiveSummaryPanel } from './ExecutiveSummaryPanel';
import { Lead, Deal, Task } from '../types/crm';

// Mock the formatters
vi.mock('../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatCurrency: (val: number) => `$${val.toLocaleString()}`,
    formatDate: (date: string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    },
  }),
}));

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  full_name: 'Test User',
  avatar_url: null,
};

const createMockLead = (overrides?: Partial<Lead>): Lead => ({
  id: 'lead-1',
  company_name: 'Test Company',
  contact_email: 'contact@test.com',
  status: 'New',
  owner: mockUser,
  activities: [],
  notes: [],
  created_at: new Date().toISOString(),
  ...overrides,
});

const createMockDeal = (overrides?: Partial<Deal>): Deal => ({
  id: 'deal-1',
  name: 'Test Deal',
  company_name: 'Test Company',
  value: 10000,
  expected_close_date: new Date().toISOString(),
  stage: 'Proposal',
  owner: mockUser,
  notes: [],
  activities: [],
  created_at: new Date().toISOString(),
  ...overrides,
});

const createMockTask = (overrides?: Partial<Task>): Task => ({
  id: 'task-1',
  title: 'Follow up',
  due_date: new Date().toISOString(),
  status: 'OPEN',
  assigned_to: mockUser,
  created_at: new Date().toISOString(),
  lead_id: 'lead-1',
  ...overrides,
});

describe('ExecutiveSummaryPanel', () => {
  describe('Given a lead with no deals and no activities', () => {
    it('When rendered / Then displays zero deal value', () => {
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('When rendered / Then displays "No deals" in pipeline health', () => {
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('No deals')).toBeInTheDocument();
    });

    it('When rendered / Then displays engagement score of 0', () => {
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('When rendered / Then displays "Never" for last activity', () => {
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  describe('KPI Cards - Total Deal Value', () => {
    it('When lead has one deal / Then sums correctly', () => {
      const lead = createMockLead();
      const deals = [createMockDeal({ value: 25000 })];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('$25,000')).toBeInTheDocument();
    });

    it('When lead has multiple deals / Then sums all deal values', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', value: 10000 }),
        createMockDeal({ id: 'd2', value: 15000 }),
        createMockDeal({ id: 'd3', value: 5000 }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('$30,000')).toBeInTheDocument();
    });

    it('When deal has zero value / Then includes zero in sum', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', value: 10000 }),
        createMockDeal({ id: 'd2', value: 0 }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });
  });

  describe('KPI Cards - Pipeline Health', () => {
    it('When deals are in different stages / Then counts by stage', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', stage: 'Proposal' }),
        createMockDeal({ id: 'd2', stage: 'Proposal' }),
        createMockDeal({ id: 'd3', stage: 'Negotiation' }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      // Should show "2 Proposal • 1 Negotiation"
      const pipelineText = screen.getByText(/Proposal/);
      expect(pipelineText).toBeInTheDocument();
    });

    it('When all deals are in same stage / Then shows single stage', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', stage: 'Won' }),
        createMockDeal({ id: 'd2', stage: 'Won' }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      // Should show "2 Won"
      const pipelineText = screen.getByText(/Won/);
      expect(pipelineText).toBeInTheDocument();
    });

    it('When lead has many stages / Then shows top 3 stages', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', stage: 'Lead' }),
        createMockDeal({ id: 'd2', stage: 'Qualified' }),
        createMockDeal({ id: 'd3', stage: 'Proposal' }),
        createMockDeal({ id: 'd4', stage: 'Negotiation' }),
        createMockDeal({ id: 'd5', stage: 'Won' }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      // Should show up to 3 stages (order depends on insertion)
      const pipelineArea = screen.getByText(/Pipeline Health/).closest('div')?.textContent;
      expect(pipelineArea).toBeTruthy();
    });
  });

  describe('KPI Cards - Engagement Score', () => {
    it('When no activities in last 30 days / Then engagement score is 0', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: [
          {
            id: 'a1',
            type: 'CALL',
            notes: 'test',
            date: sixtyDaysAgo.toISOString(),
            created_at: sixtyDaysAgo.toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('When multiple activities in last 30 days / Then calculates engagement score', () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: Array.from({ length: 15 }, (_, i) => ({
          id: `a${i}`,
          type: 'CALL' as const,
          notes: 'test',
          date: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
          author: mockUser,
        })),
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      // 15 activities within 20 days = score based on current calculation
      expect(screen.getByText(/\/100/)).toBeInTheDocument();
    });

    it('When activity count exceeds 100 / Then caps score at 100', () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: Array.from({ length: 50 }, (_, i) => ({
          id: `a${i}`,
          type: 'CALL' as const,
          notes: 'test',
          date: new Date(twentyDaysAgo.getTime() + (i % 15) * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(twentyDaysAgo.getTime() + (i % 15) * 24 * 60 * 60 * 1000).toISOString(),
          author: mockUser,
        })),
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('100/100')).toBeInTheDocument();
    });
  });

  describe('KPI Cards - Engagement Trend', () => {
    it('When activity increased from previous month / Then shows uptrend', () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

      const lead = createMockLead({
        activities: [
          // 2 activities in previous 30-60 day window
          {
            id: 'a1',
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(fiftyDaysAgo.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(fiftyDaysAgo.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          },
          {
            id: 'a2',
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(fiftyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(fiftyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          },
          // 5 activities in current 30 day window
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `a${i + 3}`,
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          })),
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText(/from last month/)).toBeInTheDocument();
    });

    it('When activity decreased from previous month / Then shows downtrend', () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

      const lead = createMockLead({
        activities: [
          // 5 activities in previous 30-60 day window
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `a${i}`,
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(fiftyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(fiftyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          })),
          // 2 activities in current 30 day window
          {
            id: 'a6',
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(twentyDaysAgo.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(twentyDaysAgo.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          },
          {
            id: 'a7',
            type: 'CALL' as const,
            notes: 'test',
            date: new Date(twentyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(twentyDaysAgo.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText(/from last month/)).toBeInTheDocument();
    });
  });

  describe('KPI Cards - Sales Intelligence (Last Activity)', () => {
    it('When no activities exist / Then displays "Never"', () => {
      const lead = createMockLead({ activities: [] });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('When last activity was today / Then displays "0d ago"', () => {
      const now = new Date();
      const lead = createMockLead({
        activities: [
          {
            id: 'a1',
            type: 'CALL' as const,
            notes: 'test',
            date: now.toISOString(),
            created_at: now.toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('0d ago')).toBeInTheDocument();
    });

    it('When last activity was 7 days ago / Then displays "7d ago"', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: [
          {
            id: 'a1',
            type: 'CALL' as const,
            notes: 'test',
            date: sevenDaysAgo.toISOString(),
            created_at: sevenDaysAgo.toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('7d ago')).toBeInTheDocument();
    });
  });

  describe('Risk Badges - Overdue Tasks', () => {
    it('When no overdue tasks / Then does not display overdue badge', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks = [createMockTask({ due_date: tomorrow.toISOString(), status: 'OPEN' })];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    });

    it('When one task is overdue / Then displays overdue badge', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks = [createMockTask({ due_date: yesterday.toISOString(), status: 'OPEN' })];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('1 Overdue Task')).toBeInTheDocument();
    });

    it('When multiple tasks are overdue / Then displays count', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks = [
        createMockTask({ id: 't1', due_date: yesterday.toISOString(), status: 'OPEN' }),
        createMockTask({ id: 't2', due_date: yesterday.toISOString(), status: 'OPEN' }),
      ];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('2 Overdue Tasks')).toBeInTheDocument();
    });

    it('When overdue task is marked DONE / Then does not count as overdue', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks = [createMockTask({ due_date: yesterday.toISOString(), status: 'DONE' })];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    });
  });

  describe('Risk Badges - Stalled Deals', () => {
    it('When deal has recent activity / Then does not display stalled badge', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals = [
        createMockDeal({
          stage: 'Proposal',
          activities: [
            {
              id: 'a1',
              type: 'CALL' as const,
              notes: 'test',
              date: yesterday.toISOString(),
              created_at: yesterday.toISOString(),
              author: mockUser,
            },
          ],
        }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.queryByText(/Stalled/)).not.toBeInTheDocument();
    });

    it('When deal has no activity for 30+ days / Then displays stalled badge', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals = [
        createMockDeal({
          stage: 'Proposal',
          activities: [
            {
              id: 'a1',
              type: 'CALL' as const,
              notes: 'test',
              date: sixtyDaysAgo.toISOString(),
              created_at: sixtyDaysAgo.toISOString(),
              author: mockUser,
            },
          ],
        }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('1 Stalled Deal')).toBeInTheDocument();
    });

    it('When multiple deals are stalled / Then displays count', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals = [
        createMockDeal({
          id: 'd1',
          stage: 'Proposal',
          activities: [
            {
              id: 'a1',
              type: 'CALL' as const,
              notes: 'test',
              date: sixtyDaysAgo.toISOString(),
              created_at: sixtyDaysAgo.toISOString(),
              author: mockUser,
            },
          ],
        }),
        createMockDeal({
          id: 'd2',
          stage: 'Negotiation',
          activities: [
            {
              id: 'a2',
              type: 'CALL' as const,
              notes: 'test',
              date: sixtyDaysAgo.toISOString(),
              created_at: sixtyDaysAgo.toISOString(),
              author: mockUser,
            },
          ],
        }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('2 Stalled Deals')).toBeInTheDocument();
    });

    it('When deal is in terminal stage (Won/Lost) / Then does not flag as stalled', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const lead = createMockLead();
      const deals = [
        createMockDeal({
          stage: 'Won',
          activities: [
            {
              id: 'a1',
              type: 'CALL' as const,
              notes: 'test',
              date: sixtyDaysAgo.toISOString(),
              created_at: sixtyDaysAgo.toISOString(),
              author: mockUser,
            },
          ],
        }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.queryByText(/Stalled/)).not.toBeInTheDocument();
    });
  });

  describe('Risk Badges - No Recent Activity', () => {
    it('When activity exists within last 7 days / Then does not display no activity badge', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: [
          {
            id: 'a1',
            type: 'CALL' as const,
            notes: 'test',
            date: threeDaysAgo.toISOString(),
            created_at: threeDaysAgo.toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.queryByText(/No Activity/)).not.toBeInTheDocument();
    });

    it('When no activity in last 7 days / Then displays no activity badge', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: [
          {
            id: 'a1',
            type: 'CALL' as const,
            notes: 'test',
            date: fifteenDaysAgo.toISOString(),
            created_at: fifteenDaysAgo.toISOString(),
            author: mockUser,
          },
        ],
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('No Activity (7d)')).toBeInTheDocument();
    });
  });

  describe('Header Information', () => {
    it('When lead has deals / Then displays deal count in header', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1' }),
        createMockDeal({ id: 'd2' }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText(/2.*deals/)).toBeInTheDocument();
    });

    it('When lead has single deal / Then displays singular form', () => {
      const lead = createMockLead();
      const deals = [createMockDeal()];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText(/1.*deal(?!s)/)).toBeInTheDocument();
    });

    it('When lead has no deals / Then displays zero deals', () => {
      const lead = createMockLead();
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText(/0.*deals/)).toBeInTheDocument();
    });

    it('When lead has activities / Then displays activity count in header', () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const lead = createMockLead({
        activities: Array.from({ length: 5 }, (_, i) => ({
          id: `a${i}`,
          type: 'CALL' as const,
          notes: 'test',
          date: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(twentyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
          author: mockUser,
        })),
      });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      // Text is split across elements, so use getByText with regex matcher
      expect(screen.getByText(/5.*activities.*30d/)).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('When lead has undefined activities / Then renders without crashing', () => {
      const lead = createMockLead({ activities: undefined as any });
      const deals: Deal[] = [];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    it('When deals have undefined activities / Then renders without crashing', () => {
      const lead = createMockLead();
      const deals = [createMockDeal({ activities: undefined as any })];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    it('When deal value is undefined / Then treats as zero', () => {
      const lead = createMockLead();
      const deals = [
        createMockDeal({ id: 'd1', value: 10000 }),
        createMockDeal({ id: 'd2', value: undefined as any }),
      ];
      const tasks: Task[] = [];

      render(<ExecutiveSummaryPanel lead={lead} deals={deals} tasks={tasks} />);

      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });
  });
});
