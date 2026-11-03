import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';

const mockSearchProjects = vi.fn();
const mockGetProjectById = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    searchProjects: (...a: any[]) => mockSearchProjects(...a),
    getProjectById: (...a: any[]) => mockGetProjectById(...a),
  },
}));

import { ProjectSelect } from './ProjectSelect';

const open = () => fireEvent.click(within(screen.getByTestId('project-select')).getByRole('combobox'));
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockSearchProjects.mockResolvedValue({ data: [{ id: 'p1', title: 'Alpha' }], hasMore: false });
  mockGetProjectById.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe('Given the ProjectSelect picker', () => {
  it('When the user types quickly / Then only one debounced search is sent for the final text', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    mockSearchProjects.mockClear();

    const input = screen.getByTestId('project-select-input');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.change(input, { target: { value: 'alp' } });
    await flush(100);
    expect(mockSearchProjects).not.toHaveBeenCalled();

    await flush(300);
    expect(mockSearchProjects).toHaveBeenCalledTimes(1);
    expect(mockSearchProjects).toHaveBeenCalledWith(expect.objectContaining({ search: 'alp', page: 1 }));
  });

  it('When an older search resolves after a newer one / Then the stale response is ignored', async () => {
    let resolveOld: (v: any) => void = () => {};
    mockSearchProjects
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; })) // open: slow
      .mockResolvedValueOnce({ data: [{ id: 'p2', title: 'Newer' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();

    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'new' } });
    await flush(300);
    expect(screen.getByRole('option', { name: 'Newer' })).toBeInTheDocument();

    await act(async () => { resolveOld({ data: [{ id: 'p0', title: 'Stale' }], hasMore: false }); });
    expect(screen.queryByRole('option', { name: 'Stale' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Newer' })).toBeInTheDocument();
  });

  it('When Escape is pressed / Then the list closes without changing the selection', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="" onChange={onChange} />);
    open();
    await flush();
    fireEvent.keyDown(screen.getByTestId('project-select-input'), { key: 'Escape' });
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('When "No Project" is chosen / Then onChange receives an empty id', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="p1" onChange={onChange} />);
    open();
    await flush();
    fireEvent.click(screen.getByTestId('project-option-none'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('When the search text has filter syntax / Then the service is asked to search it (sanitising lives in the service)', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'a,b)' } });
    await flush(300);
    expect(mockSearchProjects).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'a,b)' }));
  });
});
