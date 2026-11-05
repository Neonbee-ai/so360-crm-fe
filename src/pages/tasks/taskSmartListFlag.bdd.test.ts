/** submodule:crm:task_smart_list gate (Pulse 552552b8). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({ bridge: null as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => state.bridge }));

import { TASK_SMART_LIST_FLAG, useTaskSmartListEnabled } from './taskSmartListFlag';

const enabled = () => renderHook(() => useTaskSmartListEnabled()).result.current;

describe('useTaskSmartListEnabled', () => {
    beforeEach(() => { state.bridge = null; });

    it('Given flags still loading / When read / Then the legacy list is kept (false)', () => {
        state.bridge = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
        expect(enabled()).toBe(false);
    });

    it('Given the flag on / When read / Then true, asked with the registered key', () => {
        const isFeatureEnabled = vi.fn(() => true);
        state.bridge = { effectiveFlagsLoaded: true, isFeatureEnabled };
        expect(enabled()).toBe(true);
        expect(isFeatureEnabled).toHaveBeenCalledWith(TASK_SMART_LIST_FLAG);
        expect(TASK_SMART_LIST_FLAG).toBe('submodule:crm:task_smart_list');
    });

    it('Given the flag off / When read / Then false', () => {
        state.bridge = { effectiveFlagsLoaded: true, isFeatureEnabled: () => false };
        expect(enabled()).toBe(false);
    });

    it('Given no shell bridge (standalone) / When read / Then false', () => {
        expect(enabled()).toBe(false);
    });
});
