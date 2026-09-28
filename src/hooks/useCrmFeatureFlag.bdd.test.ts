import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseShellBridge = vi.hoisted(() => vi.fn());
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockUseShellBridge() }));

import { useCrmFeatureFlag, RE_FLAGS } from './useCrmFeatureFlag';

beforeEach(() => { mockUseShellBridge.mockReset(); });

describe('Given the useCrmFeatureFlag hook', () => {
    describe('When the shell has loaded flags and the key is enabled', () => {
        it('Then it returns true and asks the shell for exactly that key', () => {
            const isFeatureEnabled = vi.fn(() => true);
            mockUseShellBridge.mockReturnValue({ effectiveFlagsLoaded: true, isFeatureEnabled });
            const { result } = renderHook(() => useCrmFeatureFlag(RE_FLAGS.UNIT_BOOKING));
            expect(result.current).toBe(true);
            expect(isFeatureEnabled).toHaveBeenCalledWith('submodule:crm:unit_booking');
        });
    });

    describe('When the key is disabled', () => {
        it('Then it returns false', () => {
            mockUseShellBridge.mockReturnValue({ effectiveFlagsLoaded: true, isFeatureEnabled: () => false });
            const { result } = renderHook(() => useCrmFeatureFlag(RE_FLAGS.RE_WIDGETS));
            expect(result.current).toBe(false);
        });
    });

    describe('When effective flags have not loaded yet', () => {
        it('Then it returns false even though the key would be on', () => {
            mockUseShellBridge.mockReturnValue({ effectiveFlagsLoaded: false, isFeatureEnabled: () => true });
            const { result } = renderHook(() => useCrmFeatureFlag(RE_FLAGS.BULK_IMPORT));
            expect(result.current).toBe(false);
        });
    });

    describe('When the bridge is missing or has no isFeatureEnabled', () => {
        it('Then it fails closed', () => {
            mockUseShellBridge.mockReturnValue(undefined);
            expect(renderHook(() => useCrmFeatureFlag(RE_FLAGS.LEAD_ASSIGNMENT)).result.current).toBe(false);
            mockUseShellBridge.mockReturnValue({});
            expect(renderHook(() => useCrmFeatureFlag(RE_FLAGS.LEAD_ASSIGNMENT)).result.current).toBe(false);
        });
    });

    describe('When the RE flag catalogue is read', () => {
        it('Then it carries the agreed keys', () => {
            expect(RE_FLAGS).toEqual({
                LEAD_ASSIGNMENT: 'submodule:crm:lead_assignment',
                BULK_IMPORT: 'action:crm:bulk_import',
                UNIT_BOOKING: 'submodule:crm:unit_booking',
                PROPERTY_MATCHING: 'submodule:crm:property_matching',
                RE_WIDGETS: 'submodule:crm:re_widgets',
            });
        });
    });
});
