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

const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const combo = () => within(screen.getByTestId('project-select')).getByRole('combobox');

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockSearchProjects.mockResolvedValue({
    data: [{ id: 'p1', title: 'Alpha' }, { id: 'p2', title: 'Beta' }],
    hasMore: false,
  });
  mockGetProjectById.mockResolvedValue({ id: 'px', title: 'Remote project' });
});
afterEach(() => vi.useRealTimers());

describe('Given the closed Project picker', () => {
  it('When it is rendered / Then the control is a focusable button with combobox semantics', () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    const trigger = combo();
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Project');
    expect(trigger.tabIndex).toBe(0);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it.each([['Enter'], [' '], ['ArrowDown'], ['ArrowUp']])('When %j is pressed on it / Then the list opens and focus moves to the search box', async (key) => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    combo().focus();
    fireEvent.keyDown(combo(), { key });
    await flush();
    expect(screen.getByTestId('project-select-list')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('project-select-input'));
  });

  it('When another key is pressed on it / Then it stays closed', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    fireEvent.keyDown(combo(), { key: 'a' });
    await flush();
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
  });

  it('When it is disabled / Then it is not focusable-operable and keys do not open it', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} disabled />);
    expect(combo()).toBeDisabled();
    fireEvent.keyDown(combo(), { key: 'ArrowDown' });
    await flush();
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
  });

  it('When a project is selected / Then the clear button is a separate control, not nested in the combobox', () => {
    render(<ProjectSelect value="p1" onChange={vi.fn()} />);
    expect(within(combo()).queryByTestId('project-select-clear')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear project' })).toBeInTheDocument();
  });
});

describe('Given the open Project picker', () => {
  it('When it opens and closes / Then aria-expanded follows the open state on the combobox', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(combo(), { key: 'ArrowDown' });
    await flush();
    const input = combo();
    expect(input).toBe(screen.getByTestId('project-select-input'));
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    fireEvent.keyDown(input, { key: 'Escape' });
    await flush();
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('When Escape is pressed / Then it closes and focus returns to the trigger', async () => {
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    combo().focus();
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    fireEvent.keyDown(screen.getByTestId('project-select-input'), { key: 'Escape' });
    await flush();
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(combo());
  });

  it('When Escape is pressed / Then it does not bubble to a surrounding dialog', async () => {
    const onKeyDown = vi.fn();
    render(<div onKeyDown={onKeyDown}><ProjectSelect value="" onChange={vi.fn()} /></div>);
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    onKeyDown.mockClear();
    fireEvent.keyDown(screen.getByTestId('project-select-input'), { key: 'Escape' });
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('When the user arrows to a project and presses Enter / Then it is selected and focus returns to the trigger', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="" onChange={onChange} />);
    fireEvent.keyDown(combo(), { key: 'ArrowDown' });
    await flush();
    const input = screen.getByTestId('project-select-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // none row
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // Alpha
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // Beta
    const active = document.getElementById(input.getAttribute('aria-activedescendant')!)!;
    expect(active).toHaveAttribute('role', 'option');
    expect(active).toHaveTextContent('Beta');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flush();
    expect(onChange).toHaveBeenCalledWith('p1');
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(combo());
  });

  it('When options are rendered / Then each has role=option, a selected state, and is kept out of the Tab order', async () => {
    render(<ProjectSelect value="p2" onChange={vi.fn()} />);
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
    options.forEach((o) => expect(o).toHaveAttribute('tabindex', '-1'));
  });

  it('When focus leaves the picker (Tab) / Then it closes without trapping focus or stealing it back', async () => {
    render(<><ProjectSelect value="" onChange={vi.fn()} /><button data-testid="next">next</button></>);
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    const next = screen.getByTestId('next');
    next.focus();
    fireEvent.blur(screen.getByTestId('project-select-input'), { relatedTarget: next });
    await flush();
    expect(screen.queryByTestId('project-select-list')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(next);
  });

  it('When focus moves within the picker (e.g. to Load more) / Then it stays open', async () => {
    mockSearchProjects.mockResolvedValue({ data: [{ id: 'p1', title: 'Alpha' }], hasMore: true });
    render(<ProjectSelect value="" onChange={vi.fn()} />);
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    const more = screen.getByTestId('project-select-more');
    fireEvent.blur(screen.getByTestId('project-select-input'), { relatedTarget: more });
    expect(screen.getByTestId('project-select-list')).toBeInTheDocument();
  });

  it('When the pointer is used / Then clicking the control opens it and clicking an option selects it', async () => {
    const onChange = vi.fn();
    render(<ProjectSelect value="" onChange={onChange} />);
    fireEvent.click(combo());
    await flush();
    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('p1');
  });
});

describe('Given a selected project outside the loaded page', () => {
  it('When the picker re-renders and options change / Then getProjectById is called once, not per render', async () => {
    mockSearchProjects.mockResolvedValue({ data: [{ id: 'p1', title: 'Alpha' }], hasMore: false });
    const { rerender } = render(<ProjectSelect value="px" onChange={vi.fn()} />);
    await flush();
    expect(mockGetProjectById).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Remote project')).toBeInTheDocument();

    rerender(<ProjectSelect value="px" onChange={vi.fn()} placeholder="other" />);
    fireEvent.keyDown(combo(), { key: 'Enter' }); // loads options, none matching px
    await flush();
    fireEvent.change(screen.getByTestId('project-select-input'), { target: { value: 'al' } });
    await flush(400);
    expect(mockGetProjectById).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('project-select-input')).toHaveAttribute('placeholder', 'Remote project');
  });

  it('When the selected id changes / Then its name is resolved once for the new id', async () => {
    const { rerender } = render(<ProjectSelect value="px" onChange={vi.fn()} />);
    await flush();
    mockGetProjectById.mockResolvedValue({ id: 'py', title: 'Other remote' });
    rerender(<ProjectSelect value="py" onChange={vi.fn()} />);
    await flush();
    expect(mockGetProjectById).toHaveBeenCalledTimes(2);
    expect(mockGetProjectById).toHaveBeenLastCalledWith('py');
    expect(screen.getByText('Other remote')).toBeInTheDocument();
  });

  it('When the selection is among the loaded options / Then no by-id lookup is needed afterwards', async () => {
    render(<ProjectSelect value="p1" onChange={vi.fn()} />);
    await flush();
    expect(mockGetProjectById).toHaveBeenCalledTimes(1); // closed picker: nothing loaded yet
    fireEvent.keyDown(combo(), { key: 'Enter' });
    await flush();
    expect(mockGetProjectById).toHaveBeenCalledTimes(1);
  });
});
