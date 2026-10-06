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

describe('Given project rows with different shapes', () => {
  it('When a row has only a name, only an id, or a code / Then the label falls back title → name → id and the code is shown', async () => {
    mockSearchProjects.mockResolvedValue({
      data: [
        { id: 'p-title', title: 'By Title', name: 'ignored', code: 'T-1' },
        { id: 'p-name', name: 'By Name', project_code: 'N-2' },
        { id: 'p-id' },
      ],
      hasMore: false,
    });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByRole('option', { name: /By Title/ })).toHaveTextContent('T-1');
    expect(screen.getByRole('option', { name: /By Name/ })).toHaveTextContent('N-2');
    expect(screen.getByRole('option', { name: 'p-id' })).toBeInTheDocument();
  });

  it('When a row has no status / Then it is offered (only completed, cancelled and archived are hidden)', async () => {
    mockSearchProjects.mockResolvedValue({
      data: [{ id: 'a', title: 'No Status' }, { id: 'b', title: 'Closed', status: 'completed' }],
      hasMore: false,
    });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByRole('option', { name: 'No Status' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();
  });

  it('When the response carries no data array / Then the list is simply empty', async () => {
    mockSearchProjects.mockResolvedValue(undefined);
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByTestId('project-select-empty')).toBeInTheDocument();
  });
});

describe('Given the current selection is resolved by id', () => {
  it('When the project is not in the loaded page / Then its name comes from getProjectById', async () => {
    mockGetProjectById.mockResolvedValue({ id: 'far', title: 'Far Away' });
    render(<ProjectSelect value="far" onChange={vi.fn()} />);
    await flush();
    expect(screen.getByTestId('project-select')).toHaveTextContent('Far Away');
  });

  it('When the lookup returns nothing / Then a placeholder is shown instead of crashing', async () => {
    mockGetProjectById.mockResolvedValue(null);
    render(<ProjectSelect value="gone" onChange={vi.fn()} />);
    await flush();
    expect(screen.getByTestId('project-select')).toHaveTextContent('…');
  });

  it('When the lookup fails / Then the label stays empty and nothing throws', async () => {
    mockGetProjectById.mockRejectedValue(new Error('boom'));
    render(<ProjectSelect value="bad" onChange={vi.fn()} />);
    await flush();
    expect(screen.getByTestId('project-select')).toHaveTextContent('…');
  });

  it('When the value changes before the lookup resolves / Then the stale answer is ignored', async () => {
    let resolveFirst: (v: any) => void = () => {};
    mockGetProjectById
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce({ id: 'two', title: 'Second' });
    const { rerender } = render(<ProjectSelect value="one" onChange={vi.fn()} />);
    rerender(<ProjectSelect value="two" onChange={vi.fn()} />);
    await flush();
    await act(async () => { resolveFirst({ id: 'one', title: 'First (stale)' }); });
    expect(screen.getByTestId('project-select')).toHaveTextContent('Second');
    expect(screen.getByTestId('project-select')).not.toHaveTextContent('First (stale)');
  });

  it('When the lookup rejects after the value changed / Then the stale failure is ignored', async () => {
    let rejectFirst: (e: any) => void = () => {};
    mockGetProjectById
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce({ id: 'two', title: 'Second' });
    const { rerender } = render(<ProjectSelect value="one" onChange={vi.fn()} />);
    rerender(<ProjectSelect value="two" onChange={vi.fn()} />);
    await flush();
    await act(async () => { rejectFirst(new Error('late')); });
    expect(screen.getByTestId('project-select')).toHaveTextContent('Second');
  });

  it('When the selected project is among the loaded options / Then no extra lookup is made', async () => {
    render(<ProjectSelect value="p1" onChange={vi.fn()} />);
    open();
    await flush();
    mockGetProjectById.mockClear();
    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'al' } });
    await flush(300);
    expect(mockGetProjectById).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Given interaction details of the picker', () => {
  it('When the user clicks outside / Then the list closes and the typed text is cleared', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'abc' } });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    open();
    await flush();
    expect(screen.getByTestId('project-select-input')).toHaveValue('');
  });

  it('When the search box is clicked / Then the click does not bubble to the field (it stays open and keeps its text)', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    const input = screen.getByTestId('project-select-input');
    fireEvent.change(input, { target: { value: 'kept' } });
    fireEvent.click(input);
    expect(screen.getByTestId('project-select-list')).toBeInTheDocument();
    expect(screen.getByTestId('project-select-input')).toHaveValue('kept');
  });

  it('When the user clicks inside the picker / Then it stays open', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.mouseDown(screen.getByTestId('project-select-list'));
    expect(screen.getByTestId('project-select-list')).toBeInTheDocument();
  });

  it('When arrows move the highlight / Then ArrowUp never goes above the first row and Enter picks the highlighted row', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="" onChange={onChange} />);
    open();
    await flush();
    const input = screen.getByTestId('project-select-input');
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // clamps at 0 → the "none" row
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('');

    open();
    await flush();
    const input2 = screen.getByTestId('project-select-input');
    fireEvent.keyDown(input2, { key: 'ArrowDown' });
    fireEvent.keyDown(input2, { key: 'ArrowDown' }); // first project
    fireEvent.keyDown(input2, { key: 'ArrowDown' }); // clamps at the last row
    fireEvent.keyDown(input2, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('p1');
  });

  it('When Enter is pressed with nothing highlighted / Then nothing is selected', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="" onChange={onChange} />);
    open();
    await flush();
    fireEvent.keyDown(screen.getByTestId('project-select-input'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('When another key is pressed / Then it is ignored', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.keyDown(screen.getByTestId('project-select-input'), { key: 'a' });
    expect(screen.getByTestId('project-select-list')).toBeInTheDocument();
  });

  it('When the picker is disabled / Then it does not open', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} disabled />);
    open();
    await flush();
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('project-select')).getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  it('When a value is selected and the picker is closed / Then the clear button resets it', async () => {
    const onChange = vi.fn();
    mockGetProjectById.mockResolvedValue({ id: 'p1', title: 'Alpha' });
    render(<ProjectSelect value="p1" onChange={onChange} />);
    await flush();
    fireEvent.click(screen.getByTestId('project-select-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('When a second page loads / Then rows already shown are not duplicated', async () => {
    mockSearchProjects
      .mockResolvedValueOnce({ data: [{ id: 'p1', title: 'Alpha' }], hasMore: true })
      .mockResolvedValueOnce({ data: [{ id: 'p1', title: 'Alpha' }, { id: 'p2', title: 'Beta' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.click(screen.getByTestId('project-select-more'));
    await flush();
    expect(screen.getAllByRole('option', { name: 'Alpha' })).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByTestId('project-select-more')).not.toBeInTheDocument();
  });

  it('When an older search fails after a newer one succeeded / Then the stale failure is ignored (no error banner)', async () => {
    let rejectOld: (e: any) => void = () => {};
    mockSearchProjects
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectOld = rej; }))
      .mockResolvedValueOnce({ data: [{ id: 'p2', title: 'Newer' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'new' } });
    await flush(300);
    await act(async () => { rejectOld(new Error('old failed')); });
    expect(screen.queryByTestId('project-select-error')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Newer' })).toBeInTheDocument();
  });

  it('When className props are supplied / Then they are applied to the wrapper and the field', () => {
    render(<ProjectSelect value="" onChange={vi.fn()} className="extra-wrap" inputClassName="extra-field" placeholder="Find…" />);
    expect(screen.getByTestId('project-select').className).toContain('extra-wrap');
    expect(within(screen.getByTestId('project-select')).getByRole('combobox').className).toContain('extra-field');
  });
});

describe('Given whole pages of closed projects', () => {
  const closed = (n: number, start = 0) =>
    Array.from({ length: n }, (_, i) => ({ id: `c${start + i}`, title: `Closed ${start + i}`, status: 'ARCHIVED' }));

  it('When the first page is all closed but more pages exist / Then the next page is read automatically (no false "No projects found")', async () => {
    mockSearchProjects
      .mockResolvedValueOnce({ data: closed(3), hasMore: true })
      .mockResolvedValueOnce({ data: [{ id: 'open1', title: 'Open One', status: 'IN_PROGRESS' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByRole('option', { name: 'Open One' })).toBeInTheDocument();
    expect(screen.queryByTestId('project-select-empty')).not.toBeInTheDocument();
    expect(mockSearchProjects).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }));
    expect(mockSearchProjects).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
  });

  it('When every page is closed and there is nothing more / Then "No projects found" is shown', async () => {
    mockSearchProjects.mockResolvedValue({ data: closed(2), hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByTestId('project-select-empty')).toBeInTheDocument();
    expect(mockSearchProjects).toHaveBeenCalledTimes(1);
  });

  it('When closed pages keep coming / Then reading stops at the bound and "Load more" is offered instead of an empty message', async () => {
    mockSearchProjects.mockResolvedValue({ data: closed(2), hasMore: true });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(mockSearchProjects).toHaveBeenCalledTimes(5);
    expect(screen.queryByTestId('project-select-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-select-more')).toBeInTheDocument();

    mockSearchProjects.mockResolvedValueOnce({ data: [{ id: 'late', title: 'Late Open' }], hasMore: false });
    fireEvent.click(screen.getByTestId('project-select-more'));
    await flush();
    expect(screen.getByRole('option', { name: 'Late Open' })).toBeInTheDocument();
    expect(mockSearchProjects).toHaveBeenLastCalledWith(expect.objectContaining({ page: 6 }));
  });

  it('When a later page is all closed / Then "Load more" continues through it to the next open project', async () => {
    mockSearchProjects
      .mockResolvedValueOnce({ data: [{ id: 'p1', title: 'Alpha' }], hasMore: true })
      .mockResolvedValueOnce({ data: closed(2), hasMore: true })
      .mockResolvedValueOnce({ data: [{ id: 'p3', title: 'Gamma' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    fireEvent.click(screen.getByTestId('project-select-more'));
    await flush();
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeInTheDocument();
  });

  it('When the search fails while reading ahead / Then the error with Retry is shown', async () => {
    mockSearchProjects
      .mockResolvedValueOnce({ data: closed(2), hasMore: true })
      .mockRejectedValueOnce(new Error('503'));
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    expect(screen.getByTestId('project-select-error')).toBeInTheDocument();
  });
});

describe('Given assistive technology', () => {
  it('When the picker opens / Then the search box controls the listbox and no option is announced as active yet', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    const input = screen.getByTestId('project-select-input');
    const list = screen.getByRole('listbox', { name: 'Projects' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('When arrows move the highlight / Then aria-activedescendant points at the highlighted option', async () => {
    mockSearchProjects.mockResolvedValue({ data: [{ id: 'p1', title: 'Alpha' }, { id: 'p2', title: 'Beta' }], hasMore: false });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    open();
    await flush();
    const input = screen.getByTestId('project-select-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByTestId('project-option-none'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByTestId('project-option-p1'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(screen.getByTestId('project-option-p2'));
  });

  it('When two pickers are on the page / Then their listbox and option ids never collide', async () => {
    render(<><ProjectSelect value="" onChange={vi.fn()} /><ProjectSelect value="" onChange={vi.fn()} /></>);
    for (const combo of screen.getAllByRole('combobox')) fireEvent.click(combo);
    await flush();
    const ids = Array.from(document.querySelectorAll('[role="listbox"], [role="option"]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
