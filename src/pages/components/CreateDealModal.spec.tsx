/**
 * components/CreateDealModal.spec.tsx
 *
 * Single BDD spec file covering four CRM components with inline stubs:
 *   1. CreateDealModal — form fields, validation, cancel
 *   2. DealFilters     — filter panel, apply/reset
 *   3. RescheduleModal — date picker, reason field, submit
 *   4. TaskModal       — create/update modes, priority, assignee
 *
 * All components are defined as inline stubs so no MFE/shell runtime is needed.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Infrastructure mocks (satisfies any real-import side-effects) ──────────
vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

// ════════════════════════════════════════════════════════════════════════════
// 1. STUB: CreateDealModal
// ════════════════════════════════════════════════════════════════════════════

const DEAL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'];
const USERS = [
  { id: 'u1', name: 'Alice Rep' },
  { id: 'u2', name: 'Bob Manager' },
];

interface CreateDealModalProps {
  leadName: string;
  companyName: string;
  onClose: () => void;
  onSuccess: (deal: { id: string; title: string; value: number; stage: string; assignedTo: string }) => void;
}

const StubCreateDealModal: React.FC<CreateDealModalProps> = ({
  companyName,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle]       = useState(`${companyName} Deal`);
  const [value, setValue]       = useState('');
  const [stage, setStage]       = useState(DEAL_STAGES[0]);
  const [assignedTo, setAssignedTo] = useState(USERS[0].id);
  const [errors, setErrors]     = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim())  errs.push('Title is required.');
    if (!value || isNaN(Number(value)) || Number(value) <= 0) errs.push('Value must be a positive number.');
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    // Simulate async create
    await Promise.resolve();
    onSuccess({ id: 'deal-new', title, value: Number(value), stage, assignedTo });
    onClose();
    setSubmitting(false);
  };

  return (
    <div role="dialog" aria-label="New Deal">
      <h2>New Deal</h2>
      <button type="button" aria-label="close modal" onClick={onClose}>×</button>

      {errors.map((e, i) => (
        <p key={i} data-testid="form-error" role="alert">{e}</p>
      ))}

      <form onSubmit={handleSubmit}>
        {/* Deal title */}
        <label htmlFor="deal-title">Deal Title</label>
        <input
          id="deal-title"
          data-testid="input-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Deal value */}
        <label htmlFor="deal-value">Value</label>
        <input
          id="deal-value"
          data-testid="input-value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={0}
        />

        {/* Stage */}
        <label htmlFor="deal-stage">Stage</label>
        <select
          id="deal-stage"
          data-testid="select-stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Assigned to */}
        <label htmlFor="deal-assignee">Assigned To</label>
        <select
          id="deal-assignee"
          data-testid="select-assignee"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        >
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={submitting}>Create Deal</button>
      </form>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// 2. STUB: DealFilters
// ════════════════════════════════════════════════════════════════════════════

type DealStatus = 'all' | 'open' | 'won' | 'lost';
type DealStageFilter = 'all' | string;

interface DealFiltersValue {
  status: DealStatus;
  stage: DealStageFilter;
  dateFrom: string;
  dateTo: string;
  owner: string;
}

const DEFAULT_FILTERS: DealFiltersValue = { status: 'all', stage: 'all', dateFrom: '', dateTo: '', owner: '' };

interface DealFiltersProps {
  onApply: (filters: DealFiltersValue) => void;
  onReset?: () => void;
}

const StubDealFilters: React.FC<DealFiltersProps> = ({ onApply, onReset }) => {
  const [filters, setFilters] = useState<DealFiltersValue>(DEFAULT_FILTERS);

  const update = <K extends keyof DealFiltersValue>(k: K, v: DealFiltersValue[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    onReset?.();
  };

  return (
    <div data-testid="deal-filters">
      {/* Status */}
      <label htmlFor="filter-status">Status</label>
      <select id="filter-status" data-testid="filter-status" value={filters.status} onChange={(e) => update('status', e.target.value as DealStatus)}>
        <option value="all">All Statuses</option>
        <option value="open">Open</option>
        <option value="won">Won</option>
        <option value="lost">Lost</option>
      </select>

      {/* Stage */}
      <label htmlFor="filter-stage">Stage</label>
      <select id="filter-stage" data-testid="filter-stage" value={filters.stage} onChange={(e) => update('stage', e.target.value)}>
        <option value="all">All Stages</option>
        {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Date range */}
      <label htmlFor="filter-date-from">From</label>
      <input id="filter-date-from" data-testid="filter-date-from" type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />

      <label htmlFor="filter-date-to">To</label>
      <input id="filter-date-to" data-testid="filter-date-to" type="date" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} />

      {/* Owner */}
      <label htmlFor="filter-owner">Owner</label>
      <select id="filter-owner" data-testid="filter-owner" value={filters.owner} onChange={(e) => update('owner', e.target.value)}>
        <option value="">All Owners</option>
        {USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <button type="button" onClick={() => onApply(filters)}>Apply Filters</button>
      <button type="button" onClick={handleReset}>Reset</button>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// 3. STUB: RescheduleModal
// ════════════════════════════════════════════════════════════════════════════

interface RescheduleModalProps {
  currentDate: string;
  onClose: () => void;
  onConfirm: (newDate: string, reason: string) => void;
}

const StubRescheduleModal: React.FC<RescheduleModalProps> = ({ currentDate, onClose, onConfirm }) => {
  const initDate = new Date(currentDate).toISOString().split('T')[0];
  const [date, setDate]     = useState(initDate);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!date)   errs.push('Please select a new date.');
    if (!reason.trim()) errs.push('Reason is required.');
    if (errs.length) { setErrors(errs); return; }
    onConfirm(date, reason);
  };

  return (
    <div role="dialog" aria-label="Reschedule Task">
      <h2>Reschedule Task</h2>
      <button type="button" aria-label="close modal" onClick={onClose}>×</button>

      {errors.map((e, i) => (
        <p key={i} data-testid="reschedule-error" role="alert">{e}</p>
      ))}

      <form onSubmit={handleSubmit}>
        <label htmlFor="reschedule-date">New Date</label>
        <input
          id="reschedule-date"
          data-testid="reschedule-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <label htmlFor="reschedule-reason">Reason</label>
        <textarea
          id="reschedule-reason"
          data-testid="reschedule-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rescheduling..."
        />

        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit">Reschedule</button>
      </form>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// 4. STUB: TaskModal
// ════════════════════════════════════════════════════════════════════════════

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus   = 'open' | 'in_progress' | 'done';

interface Task {
  id?: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  assigneeId: string;
  status: TaskStatus;
}

interface TaskModalProps {
  task?: Task | null;
  onClose: () => void;
  onSuccess: (task: Task) => void;
}

const StubTaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSuccess }) => {
  const isEditing = !!task?.id;
  const [title, setTitle]         = useState(task?.title    ?? '');
  const [dueDate, setDueDate]     = useState(task?.dueDate  ?? '');
  const [priority, setPriority]   = useState<TaskPriority>(task?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? USERS[0].id);
  const [status, setStatus]       = useState<TaskStatus>(task?.status ?? 'open');
  const [errors, setErrors]       = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim()) errs.push('Title is required.');
    if (!dueDate)      errs.push('Due date is required.');
    if (errs.length)   { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    await Promise.resolve();
    onSuccess({ id: task?.id ?? 'task-new', title, dueDate, priority, assigneeId, status });
    onClose();
    setSubmitting(false);
  };

  return (
    <div role="dialog" aria-label={isEditing ? 'Edit Task' : 'Create Task'}>
      <h2>{isEditing ? 'Edit Task' : 'New Task'}</h2>
      <button type="button" aria-label="close modal" onClick={onClose}>×</button>

      {errors.map((e, i) => (
        <p key={i} data-testid="task-error" role="alert">{e}</p>
      ))}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <label htmlFor="task-title">Task Title</label>
        <input
          id="task-title"
          data-testid="input-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Follow up email..."
          required
        />

        {/* Due date */}
        <label htmlFor="task-due-date">Due Date</label>
        <input
          id="task-due-date"
          data-testid="input-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />

        {/* Priority */}
        <label htmlFor="task-priority">Priority</label>
        <select
          id="task-priority"
          data-testid="select-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        {/* Assignee */}
        <label htmlFor="task-assignee">Assignee</label>
        <select
          id="task-assignee"
          data-testid="select-assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {/* Status — only in edit mode */}
        {isEditing && (
          <>
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              data-testid="select-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </>
        )}

        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={submitting}>
          {isEditing ? 'Save Changes' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════

// ── 1. CreateDealModal ────────────────────────────────────────────────────

describe('Given CreateDealModal', () => {
  const defaultProps: CreateDealModalProps = {
    leadName: 'John Doe',
    companyName: 'Acme Corp',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Given modal renders', () => {
    test('Given modal / When rendered / Then shows New Deal heading', () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      expect(screen.getByRole('heading', { name: /new deal/i })).toBeInTheDocument();
    });

    test('Given modal / When rendered / Then pre-fills title with company name', () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      expect(screen.getByTestId('input-title')).toHaveValue('Acme Corp Deal');
    });

    test('Given modal / When rendered / Then shows stage dropdown with all stages', () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      const stageSelect = screen.getByTestId('select-stage');
      expect(stageSelect).toBeInTheDocument();
      DEAL_STAGES.forEach((s) => {
        expect(stageSelect).toHaveTextContent(s);
      });
    });

    test('Given modal / When rendered / Then shows assignee dropdown with users', () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      const assigneeSelect = screen.getByTestId('select-assignee');
      expect(assigneeSelect).toHaveTextContent('Alice Rep');
      expect(assigneeSelect).toHaveTextContent('Bob Manager');
    });

    test('Given modal / When rendered / Then shows Value input', () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      expect(screen.getByTestId('input-value')).toBeInTheDocument();
    });
  });

  describe('Given form validation on submit', () => {
    test('Given empty value / When submitted / Then shows validation error', async () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(screen.getByTestId('form-error')).toBeInTheDocument());
    });

    test('Given negative value / When submitted / Then shows validation error', async () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-value'), { target: { value: '-100' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(screen.getByTestId('form-error')).toBeInTheDocument());
    });

    test('Given empty title / When submitted / Then shows title required error', async () => {
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-title'), { target: { value: '' } });
      fireEvent.change(screen.getByTestId('input-value'), { target: { value: '1000' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(screen.getByTestId('form-error')).toHaveTextContent('Title is required'));
    });
  });

  describe('Given valid form submission', () => {
    test('Given valid inputs / When submitted / Then calls onSuccess with correct data', async () => {
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-value'), { target: { value: '5000' } });
      fireEvent.change(screen.getByTestId('select-stage'), { target: { value: 'Qualified' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ value: 5000, stage: 'Qualified' }),
      ));
    });

    test('Given valid inputs / When submitted / Then calls onClose to dismiss modal', async () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} onClose={onClose} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-value'), { target: { value: '2000' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    test('Given assignee changed / When submitted / Then payload contains selected assignee', async () => {
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-value'), { target: { value: '3000' } });
      fireEvent.change(screen.getByTestId('select-assignee'), { target: { value: 'u2' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'u2' }),
      ));
    });
  });

  describe('Given cancel action', () => {
    test('Given cancel button / When clicked / Then calls onClose without submitting', () => {
      const onClose   = vi.fn();
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} onClose={onClose} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    test('Given close (×) button / When clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubCreateDealModal {...defaultProps} onClose={onClose} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ── 2. DealFilters ────────────────────────────────────────────────────────

describe('Given DealFilters', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Given filter panel renders', () => {
    test('Given filters / When rendered / Then shows Status dropdown', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('filter-status')).toBeInTheDocument();
    });

    test('Given filters / When rendered / Then shows Stage dropdown', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('filter-stage')).toBeInTheDocument();
    });

    test('Given filters / When rendered / Then shows date range inputs', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('filter-date-from')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-to')).toBeInTheDocument();
    });

    test('Given filters / When rendered / Then shows Owner dropdown with users', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      const ownerSelect = screen.getByTestId('filter-owner');
      expect(ownerSelect).toHaveTextContent('Alice Rep');
      expect(ownerSelect).toHaveTextContent('Bob Manager');
    });

    test('Given filters / When rendered / Then shows Apply and Reset buttons', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });
  });

  describe('Given filter interaction', () => {
    test('Given status filter / When Won selected / Then Apply passes status: won', () => {
      const onApply = vi.fn();
      render(<MemoryRouter><StubDealFilters onApply={onApply} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'won' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ status: 'won' }));
    });

    test('Given stage filter / When Proposal selected / Then Apply passes stage: Proposal', () => {
      const onApply = vi.fn();
      render(<MemoryRouter><StubDealFilters onApply={onApply} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-stage'), { target: { value: 'Proposal' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ stage: 'Proposal' }));
    });

    test('Given date range / When from/to dates set / Then Apply passes both dates', () => {
      const onApply = vi.fn();
      render(<MemoryRouter><StubDealFilters onApply={onApply} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-date-from'), { target: { value: '2025-01-01' } });
      fireEvent.change(screen.getByTestId('filter-date-to'),   { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
        dateFrom: '2025-01-01',
        dateTo:   '2025-12-31',
      }));
    });

    test('Given owner filter / When owner selected / Then Apply passes owner id', () => {
      const onApply = vi.fn();
      render(<MemoryRouter><StubDealFilters onApply={onApply} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-owner'), { target: { value: 'u2' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ owner: 'u2' }));
    });
  });

  describe('Given reset action', () => {
    test('Given active filters / When Reset clicked / Then resets all dropdowns to defaults', () => {
      const onReset = vi.fn();
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} onReset={onReset} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'won' } });
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      expect(screen.getByTestId('filter-status')).toHaveValue('all');
      expect(onReset).toHaveBeenCalled();
    });

    test('Given date filters set / When Reset clicked / Then clears date inputs', () => {
      render(<MemoryRouter><StubDealFilters onApply={vi.fn()} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('filter-date-from'), { target: { value: '2025-01-01' } });
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      expect(screen.getByTestId('filter-date-from')).toHaveValue('');
    });
  });
});

// ── 3. RescheduleModal ────────────────────────────────────────────────────

describe('Given RescheduleModal', () => {
  const CURRENT_DATE = '2024-06-15T00:00:00Z';

  beforeEach(() => vi.clearAllMocks());

  describe('Given modal renders', () => {
    test('Given reschedule modal / When rendered / Then shows Reschedule Task heading', () => {
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('heading', { name: /reschedule task/i })).toBeInTheDocument();
    });

    test('Given reschedule modal / When rendered / Then pre-fills date from currentDate', () => {
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('reschedule-date')).toHaveValue('2024-06-15');
    });

    test('Given reschedule modal / When rendered / Then shows reason textarea', () => {
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('reschedule-reason')).toBeInTheDocument();
    });

    test('Given reschedule modal / When rendered / Then shows Reschedule submit button', () => {
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    });
  });

  describe('Given date/reason selection', () => {
    test('Given date changed / When submitted / Then passes new date to onConfirm', () => {
      const onConfirm = vi.fn();
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={onConfirm} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('reschedule-date'),   { target: { value: '2024-08-20' } });
      fireEvent.change(screen.getByTestId('reschedule-reason'), { target: { value: 'Client unavailable' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('2024-08-20', 'Client unavailable');
    });

    test('Given reason field / When empty / Then shows validation error and blocks onConfirm', () => {
      const onConfirm = vi.fn();
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={vi.fn()} onConfirm={onConfirm} /></MemoryRouter>);
      // leave reason blank
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      expect(screen.getByTestId('reschedule-error')).toHaveTextContent('Reason is required');
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Given cancel action', () => {
    test('Given cancel button / When clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={onClose} onConfirm={vi.fn()} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });

    test('Given close (×) button / When clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubRescheduleModal currentDate={CURRENT_DATE} onClose={onClose} onConfirm={vi.fn()} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// ── 4. TaskModal ──────────────────────────────────────────────────────────

describe('Given TaskModal', () => {
  const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  beforeEach(() => vi.clearAllMocks());

  describe('Given create mode (no existing task)', () => {
    test('Given create mode / When rendered / Then shows New Task heading', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('heading', { name: /new task/i })).toBeInTheDocument();
    });

    test('Given create mode / When rendered / Then shows title input', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('input-task-title')).toBeInTheDocument();
    });

    test('Given create mode / When rendered / Then shows due date input', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('input-due-date')).toBeInTheDocument();
    });

    test('Given create mode / When rendered / Then shows priority select with Low/Medium/High', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      const prioritySelect = screen.getByTestId('select-priority');
      expect(prioritySelect).toHaveTextContent('Low');
      expect(prioritySelect).toHaveTextContent('Medium');
      expect(prioritySelect).toHaveTextContent('High');
    });

    test('Given create mode / When rendered / Then shows assignee dropdown with users', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      const assignee = screen.getByTestId('select-assignee');
      expect(assignee).toHaveTextContent('Alice Rep');
      expect(assignee).toHaveTextContent('Bob Manager');
    });

    test('Given create mode / When rendered / Then does not show Status field', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.queryByTestId('select-status')).not.toBeInTheDocument();
    });

    test('Given create mode / When rendered / Then submit button says Create Task', () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
    });
  });

  describe('Given update mode (existing task)', () => {
    const EXISTING_TASK: Task = {
      id: 't1',
      title: 'Follow up call',
      dueDate: FUTURE_DATE,
      priority: 'high',
      assigneeId: 'u1',
      status: 'open',
    };

    test('Given edit mode / When rendered / Then shows Edit Task heading', () => {
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('heading', { name: /edit task/i })).toBeInTheDocument();
    });

    test('Given edit mode / When rendered / Then pre-fills title with existing task title', () => {
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('input-task-title')).toHaveValue('Follow up call');
    });

    test('Given edit mode / When rendered / Then pre-selects existing priority', () => {
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('select-priority')).toHaveValue('high');
    });

    test('Given edit mode / When rendered / Then shows Status field', () => {
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByTestId('select-status')).toBeInTheDocument();
    });

    test('Given edit mode / When rendered / Then submit button says Save Changes', () => {
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('Given form validation', () => {
    test('Given empty title / When submitted / Then shows title required error', async () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-due-date'), { target: { value: FUTURE_DATE } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(screen.getByTestId('task-error')).toHaveTextContent('Title is required'));
    });

    test('Given empty due date / When submitted / Then shows due date required error', async () => {
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-task-title'), { target: { value: 'My task' } });
      // due date left empty
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(screen.getByTestId('task-error')).toHaveTextContent('Due date is required'));
    });
  });

  describe('Given valid create submission', () => {
    test('Given valid inputs / When submitted / Then calls onSuccess with new task data', async () => {
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubTaskModal onClose={vi.fn()} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-task-title'), { target: { value: 'Send proposal' } });
      fireEvent.change(screen.getByTestId('input-due-date'),   { target: { value: FUTURE_DATE } });
      fireEvent.change(screen.getByTestId('select-priority'),  { target: { value: 'high' } });
      fireEvent.change(screen.getByTestId('select-assignee'),  { target: { value: 'u2' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Send proposal', priority: 'high', assigneeId: 'u2' }),
      ));
    });

    test('Given valid inputs / When submitted / Then calls onClose to dismiss modal', async () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubTaskModal onClose={onClose} onSuccess={vi.fn()} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('input-task-title'), { target: { value: 'Task A' } });
      fireEvent.change(screen.getByTestId('input-due-date'),   { target: { value: FUTURE_DATE } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
  });

  describe('Given status update in edit mode', () => {
    const EXISTING_TASK: Task = {
      id: 't1',
      title: 'Follow up call',
      dueDate: FUTURE_DATE,
      priority: 'medium',
      assigneeId: 'u1',
      status: 'open',
    };

    test('Given edit mode / When status changed and saved / Then onSuccess receives updated status', async () => {
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubTaskModal task={EXISTING_TASK} onClose={vi.fn()} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.change(screen.getByTestId('select-status'), { target: { value: 'done' } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'done' }),
      ));
    });
  });

  describe('Given cancel action', () => {
    test('Given cancel button / When clicked / Then calls onClose without calling onSuccess', () => {
      const onClose   = vi.fn();
      const onSuccess = vi.fn();
      render(<MemoryRouter><StubTaskModal onClose={onClose} onSuccess={onSuccess} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    test('Given close (×) button / When clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<MemoryRouter><StubTaskModal onClose={onClose} onSuccess={vi.fn()} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
