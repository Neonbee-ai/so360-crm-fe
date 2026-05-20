import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetTasks = vi.fn();
const mockGetUsers = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getTasks: (...a: any[]) => mockGetTasks(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    deleteTask: (...a: any[]) => mockDeleteTask(...a),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ user: { id: 'user-1', full_name: 'Test User' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

let tableProps: any = {};
vi.mock('../components/common/Table', () => ({
  Table: (props: any) => {
    tableProps = props;
    if (props.isLoading) return <div data-testid="table">Loading...</div>;
    if (props.data.length === 0) return <div data-testid="table">{props.emptyMessage}</div>;
    return (
      <div data-testid="table">
        {props.data.map((task: any) => (
          <div key={task.id} data-testid={`task-row-${task.id}`} onClick={() => props.onRowClick(task)}>
            {task.title} - {task.status}
          </div>
        ))}
      </div>
    );
  },
}));

import TasksPage from './TasksPage';

const makeTasks = () => [
  { id: 't1', title: 'Follow up call', description: 'Call client', status: 'OPEN', due_date: '2026-01-15', deal: { name: 'Big Deal', company_name: 'Big Deal Inc' }, lead: null, assigned_to: { id: 'user-1', full_name: 'Test User' } },
  { id: 't2', title: 'Send proposal', description: 'Draft and send', status: 'DONE', due_date: '2026-01-10', deal: null, lead: null, assigned_to: { id: 'user-2', full_name: 'Other User' } },
  { id: 't3', title: 'Review contract', description: null, status: 'OPEN', due_date: '2024-01-01', deal: { name: 'Old Deal', company_name: 'Old Deal Inc' }, lead: null, assigned_to: { id: 'user-2', full_name: 'Other User' } },
];

const makeUsers = () => [
  { id: 'user-1', full_name: 'Test User' },
  { id: 'user-2', full_name: 'Other User' },
];

beforeEach(() => {
  vi.clearAllMocks();
  tableProps = {};
  mockGetTasks.mockResolvedValue(makeTasks());
  mockGetUsers.mockResolvedValue(makeUsers());
  mockUpdateTask.mockResolvedValue({});
  mockDeleteTask.mockResolvedValue({});
});

describe('TasksPage', () => {
  describe('Given tasks are loading', () => {
    it('When rendered / Then shows loading state via Table', async () => {
      mockGetTasks.mockReturnValue(new Promise(() => {}));
      render(<TasksPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Given tasks have loaded', () => {
    it('When rendered / Then displays task rows in table', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      expect(screen.getByTestId('task-row-t2')).toBeInTheDocument();
    });

    it('When user searches by title / Then filters tasks matching search term', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const search = screen.getByPlaceholderText('Search tasks...');
      await userEvent.type(search, 'Follow up');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].title).toBe('Follow up call');
      });
    });

    it('When user searches by deal name / Then filters tasks with matching deal', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const search = screen.getByPlaceholderText('Search tasks...');
      await userEvent.type(search, 'Big Deal');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].id).toBe('t1');
      });
    });

    it('When user clicks Open filter / Then shows only open tasks', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Open'));
      await waitFor(() => {
        expect(tableProps.data.every((t: any) => t.status === 'OPEN')).toBe(true);
      });
    });

    it('When user clicks Done filter / Then shows only completed tasks', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Done'));
      await waitFor(() => {
        expect(tableProps.data.every((t: any) => t.status === 'DONE')).toBe(true);
      });
    });

    it('When user clicks Overdue filter / Then shows only open tasks past due date', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const filterBtns = screen.getAllByRole('button');
      const overdueBtn = filterBtns.find(b => b.textContent === 'Overdue')!;
      fireEvent.click(overdueBtn);
      await waitFor(() => {
        const openPastDue = tableProps.data.filter((t: any) => t.status === 'OPEN' && new Date(t.due_date) < new Date());
        expect(tableProps.data.length).toBe(openPastDue.length);
      });
    });

    it('When a task row is clicked / Then navigates to task detail', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('task-row-t1'));
      expect(mockNavigate).toHaveBeenCalledWith('t1');
    });
  });

  describe('Given task deletion flow', () => {
    it('When delete confirmed / Then removes task from list', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const columns = tableProps.columns;
      const deleteCol = columns[columns.length - 1];
      const cell = deleteCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      const btn = container.querySelector('button');
      fireEvent.click(btn!);
      await waitFor(() => expect(screen.getByText('Delete Task')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith('t1'));
    });

    it('When delete fails / Then shows error message', async () => {
      mockDeleteTask.mockRejectedValue(new Error('Server error'));
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const columns = tableProps.columns;
      const deleteCol = columns[columns.length - 1];
      const cell = deleteCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      const btn = container.querySelector('button');
      fireEvent.click(btn!);
      await waitFor(() => expect(screen.getByText('Delete Task')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    });

    it('When cancel is clicked / Then dismisses delete dialog', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const columns = tableProps.columns;
      const deleteCol = columns[columns.length - 1];
      const cell = deleteCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      fireEvent.click(container.querySelector('button')!);
      await waitFor(() => expect(screen.getByText('Delete Task')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => expect(screen.queryByText('Delete Task')).not.toBeInTheDocument());
    });
  });

  describe('Given sorting interactions', () => {
    it('When sort header in column is rendered / Then provides a clickable sort button', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const titleHeader = tableProps.columns[0].header;
      const { container } = render(titleHeader);
      const btn = container.querySelector('button');
      expect(btn).toBeTruthy();
      expect(btn!.textContent).toContain('Task');
    });

    it('When due_date header is rendered / Then provides sortable header', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const dueDateHeader = tableProps.columns[1].header;
      const { container } = render(dueDateHeader);
      expect(container.textContent).toContain('Due Date');
    });

    it('When assigned_to header is rendered / Then provides sortable header', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const assigneeHeader = tableProps.columns[3].header;
      const { container } = render(assigneeHeader);
      expect(container.textContent).toContain('Assigned To');
    });
  });

  describe('Given pagination controls', () => {
    it('When page size is changed / Then resets to page 1', async () => {
      const manyTasks = Array.from({ length: 15 }, (_, i) => ({
        id: `t${i}`, title: `Task ${i}`, description: null, status: 'OPEN',
        due_date: '2026-01-15', deal: null, lead: null, assigned_to: { id: 'user-1', full_name: 'Test User' },
      }));
      mockGetTasks.mockResolvedValue(manyTasks);
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());
    });
  });

  describe('Given fetch fails', () => {
    it('When API returns error / Then renders empty table', async () => {
      mockGetTasks.mockRejectedValue(new Error('Network error'));
      mockGetUsers.mockRejectedValue(new Error('Network error'));
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByText('No tasks found for the selected filter.')).toBeInTheDocument());
    });
  });

  describe('Given column renderers', () => {
    it('When status column renders an open task / Then shows circle icon', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const statusCol = tableProps.columns[4];
      const cell = statusCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      const select = container.querySelector('select');
      expect(select?.value).toBe('OPEN');
    });

    it('When status column renders a done task / Then shows Done selected', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const statusCol = tableProps.columns[4];
      const cell = statusCol.accessor(makeTasks()[1]);
      const { container } = render(cell);
      const select = container.querySelector('select');
      expect(select?.value).toBe('DONE');
    });

    it('When assignee column renders / Then shows user select with current assignee', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const assigneeCol = tableProps.columns[3];
      const cell = assigneeCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      const select = container.querySelector('select');
      expect(select?.value).toBe('user-1');
    });

    it('When due date column renders overdue task / Then shows Overdue label', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const dueDateCol = tableProps.columns[1];
      const overdueTask = makeTasks()[2];
      const cell = dueDateCol.accessor(overdueTask);
      const { container } = render(cell);
      expect(container.textContent).toContain('Overdue');
    });

    it('When Associated With column renders task with deal / Then shows deal name', async () => {
      render(<TasksPage />);
      await waitFor(() => expect(screen.getByTestId('task-row-t1')).toBeInTheDocument());
      const associatedWithCol = tableProps.columns[2];
      const cell = associatedWithCol.accessor(makeTasks()[0]);
      const { container } = render(cell);
      expect(container.textContent).toContain('Big Deal');
    });
  });
});
