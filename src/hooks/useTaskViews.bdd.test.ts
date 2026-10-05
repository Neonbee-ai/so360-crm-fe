import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { toast } from '@so360/design-system';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockSetDefault = vi.fn();

vi.mock('../services/crmService', () => ({
    crmService: {
        gridViews: {
            list: (...a: any[]) => mockList(...a),
            create: (...a: any[]) => mockCreate(...a),
            update: (...a: any[]) => mockUpdate(...a),
            remove: (...a: any[]) => mockRemove(...a),
            setDefault: (...a: any[]) => mockSetDefault(...a),
        },
    },
}));

import { useTaskViews } from './useTaskViews';
import { DEFAULT_TASK_FILTERS } from '../utils/taskListFilters';

const view = (id: string, over: Record<string, any> = {}) => ({
    id,
    name: `View ${id}`,
    entity_type: 'task',
    config: { version: 1, query: 'due=overdue' },
    is_shared: false,
    is_default: false,
    user_id: 'user-1',
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockList.mockResolvedValue([view('a'), view('b', { is_default: true })]);
});

describe('useTaskViews', () => {
    describe('Given the user has saved views', () => {
        it('When the page loads / Then the task entity is listed and views become available', async () => {
            const { result } = renderHook(() => useTaskViews());
            expect(result.current.loaded).toBe(false);
            await waitFor(() => expect(result.current.loaded).toBe(true));
            expect(mockList).toHaveBeenCalledWith('task');
            expect(result.current.views.map(v => v.id)).toEqual(['a', 'b']);
            expect(result.current.available).toBe(true);
        });
    });

    describe('Given the views API is not reachable', () => {
        it('When the page loads / Then it finishes loading with views switched off', async () => {
            mockList.mockRejectedValue(new Error('403'));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            expect(result.current.available).toBe(false);
            expect(result.current.views).toEqual([]);
        });
    });

    describe('Given the hook unmounts before the list answers', () => {
        it('When the list resolves later / Then nothing is set', async () => {
            let resolve!: (v: any) => void;
            mockList.mockReturnValue(new Promise(r => (resolve = r)));
            const { result, unmount } = renderHook(() => useTaskViews());
            unmount();
            await act(async () => resolve([view('a')]));
            expect(result.current.views).toEqual([]);
        });

        it('When the list fails later / Then nothing is set either', async () => {
            let reject!: (e: any) => void;
            mockList.mockReturnValue(new Promise((_r, rej) => (reject = rej)));
            const { result, unmount } = renderHook(() => useTaskViews());
            unmount();
            await act(async () => reject(new Error('late')));
            expect(result.current.available).toBe(true);
        });
    });

    describe('Given saving the current filters', () => {
        it('When a view is saved / Then it is created private, non-default, as a task view, and appended', async () => {
            mockCreate.mockResolvedValue(view('new', { name: 'Mine' }));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let created: any;
            await act(async () => {
                created = await result.current.save('Mine', { ...DEFAULT_TASK_FILTERS, due: 'today', scope: 'team' });
            });
            expect(mockCreate).toHaveBeenCalledWith({
                name: 'Mine',
                entity_type: 'task',
                config: { version: 1, query: 'due=today' },
                is_shared: false,
                is_default: false,
            });
            expect(created.id).toBe('new');
            expect(result.current.views.map(v => v.id)).toEqual(['a', 'b', 'new']);
        });

        it('When saving fails / Then an error toast shows and nothing is added', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockCreate.mockRejectedValue(new Error('boom'));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let created: any = 'unset';
            await act(async () => {
                created = await result.current.save('Mine', DEFAULT_TASK_FILTERS);
            });
            expect(created).toBeNull();
            expect(toastError).toHaveBeenCalledWith('Could not save the view');
            expect(result.current.views).toHaveLength(2);
        });
    });

    describe('Given renaming', () => {
        it('When it succeeds / Then the view is replaced by the server copy', async () => {
            mockUpdate.mockResolvedValue(view('a', { name: 'Renamed' }));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let ok = false;
            await act(async () => {
                ok = await result.current.rename('a', 'Renamed');
            });
            expect(ok).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith('a', { name: 'Renamed' });
            expect(result.current.views[0].name).toBe('Renamed');
            expect(result.current.views[1].name).toBe('View b');
        });

        it('When it fails / Then a toast shows and the name is unchanged', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockUpdate.mockRejectedValue(new Error('boom'));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let ok = true;
            await act(async () => {
                ok = await result.current.rename('a', 'Renamed');
            });
            expect(ok).toBe(false);
            expect(toastError).toHaveBeenCalledWith('Could not rename the view');
            expect(result.current.views[0].name).toBe('View a');
        });
    });

    describe('Given deleting', () => {
        it('When it succeeds / Then the view disappears', async () => {
            mockRemove.mockResolvedValue({ deleted: true });
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            await act(async () => {
                await result.current.remove('a');
            });
            expect(mockRemove).toHaveBeenCalledWith('a');
            expect(result.current.views.map(v => v.id)).toEqual(['b']);
        });

        it('When it fails / Then a toast shows and the view stays', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockRemove.mockRejectedValue(new Error('boom'));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let ok = true;
            await act(async () => {
                ok = await result.current.remove('a');
            });
            expect(ok).toBe(false);
            expect(toastError).toHaveBeenCalledWith('Could not delete the view');
            expect(result.current.views).toHaveLength(2);
        });
    });

    describe('Given setting the default', () => {
        it('When it succeeds / Then exactly that view is the default', async () => {
            mockSetDefault.mockResolvedValue(view('a', { is_default: true }));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            await act(async () => {
                await result.current.setDefault('a');
            });
            expect(mockSetDefault).toHaveBeenCalledWith('a');
            expect(result.current.views.map(v => v.is_default)).toEqual([true, false]);
        });

        it('When it fails / Then a toast shows and defaults are unchanged', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockSetDefault.mockRejectedValue(new Error('boom'));
            const { result } = renderHook(() => useTaskViews());
            await waitFor(() => expect(result.current.loaded).toBe(true));
            let ok = true;
            await act(async () => {
                ok = await result.current.setDefault('a');
            });
            expect(ok).toBe(false);
            expect(toastError).toHaveBeenCalledWith('Could not set the default view');
            expect(result.current.views.map(v => v.is_default)).toEqual([false, true]);
        });
    });
});
