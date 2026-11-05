import { useShellBridge } from '@so360/shell-context';

/**
 * Pulse 552552b8: the priority-driven Tasks list (overdue first, counter
 * strip, type/priority/due/reminder filters, Up Next agenda, saved views).
 * Off, or while flags are still loading, the page keeps the original list.
 */
export const TASK_SMART_LIST_FLAG = 'submodule:crm:task_smart_list';

export function useTaskSmartListEnabled(): boolean {
    const bridge = useShellBridge();
    if (bridge?.effectiveFlagsLoaded === false) return false;
    return bridge?.isFeatureEnabled?.(TASK_SMART_LIST_FLAG) === true;
}
