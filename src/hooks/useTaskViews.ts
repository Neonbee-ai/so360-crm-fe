import { useCallback, useEffect, useState } from 'react';
import { toast } from '@so360/design-system';
import { crmService, GridView } from '../services/crmService';
import { TaskListFilters } from '../utils/taskListFilters';
import { TASK_VIEW_ENTITY, toViewConfig } from '../utils/taskViews';

export interface TaskViewsApi {
    views: GridView[];
    /** The first load finished (successfully or not). */
    loaded: boolean;
    /** false when saved views cannot be used (e.g. the grid-views API is not reachable for this user). */
    available: boolean;
    save: (name: string, filters: TaskListFilters) => Promise<GridView | null>;
    rename: (id: string, name: string) => Promise<boolean>;
    remove: (id: string) => Promise<boolean>;
    setDefault: (id: string) => Promise<boolean>;
}

/**
 * The user's saved Tasks views, stored in the shared crm_grid_views table
 * (entity_type 'task'). Views are private to their owner: they are always
 * created unshared, and sharing with the team is not offered here.
 */
export function useTaskViews(): TaskViewsApi {
    const [views, setViews] = useState<GridView[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [available, setAvailable] = useState(true);

    useEffect(() => {
        let cancelled = false;
        crmService.gridViews
            .list(TASK_VIEW_ENTITY)
            .then(rows => {
                if (!cancelled) setViews(rows);
            })
            .catch(err => {
                console.error('Failed to load saved task views', err);
                if (!cancelled) setAvailable(false);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const save = useCallback(async (name: string, filters: TaskListFilters) => {
        try {
            const created = await crmService.gridViews.create({
                name,
                entity_type: TASK_VIEW_ENTITY,
                config: toViewConfig(filters),
                is_shared: false,
                is_default: false,
            });
            setViews(prev => [...prev, created]);
            return created;
        } catch (err) {
            console.error('Failed to save task view', err);
            toast.error('Could not save the view');
            return null;
        }
    }, []);

    const rename = useCallback(async (id: string, name: string) => {
        try {
            const updated = await crmService.gridViews.update(id, { name });
            setViews(prev => prev.map(v => (v.id === id ? updated : v)));
            return true;
        } catch (err) {
            console.error('Failed to rename task view', err);
            toast.error('Could not rename the view');
            return false;
        }
    }, []);

    const remove = useCallback(async (id: string) => {
        try {
            await crmService.gridViews.remove(id);
            setViews(prev => prev.filter(v => v.id !== id));
            return true;
        } catch (err) {
            console.error('Failed to delete task view', err);
            toast.error('Could not delete the view');
            return false;
        }
    }, []);

    const setDefault = useCallback(async (id: string) => {
        try {
            await crmService.gridViews.setDefault(id);
            // One default per user: the server cleared the previous one.
            setViews(prev => prev.map(v => ({ ...v, is_default: v.id === id })));
            return true;
        } catch (err) {
            console.error('Failed to set default task view', err);
            toast.error('Could not set the default view');
            return false;
        }
    }, []);

    return { views, loaded, available, save, rename, remove, setDefault };
}
