/**
 * BDD Spec — online meetings helpers (Pulse ab92e893)
 */
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const bridgeState = vi.hoisted(() => ({ bridge: null as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => bridgeState.bridge }));

import { ONLINE_MEETINGS_FLAG, parseAttendeeEmails, providerOptionLabel, useOnlineMeetingsEnabled } from './onlineMeetingsFlag';

beforeEach(() => { bridgeState.bridge = null; });

describe('Given useOnlineMeetingsEnabled', () => {
    it('When flags are still loading / Then it is off', () => {
        bridgeState.bridge = { effectiveFlagsLoaded: false, isFeatureEnabled: () => true };
        expect(renderHook(() => useOnlineMeetingsEnabled()).result.current).toBe(false);
    });
    it('When the flag is enabled / Then it is on and asks for the online meetings key', () => {
        const isFeatureEnabled = vi.fn(() => true);
        bridgeState.bridge = { effectiveFlagsLoaded: true, isFeatureEnabled };
        expect(renderHook(() => useOnlineMeetingsEnabled()).result.current).toBe(true);
        expect(isFeatureEnabled).toHaveBeenCalledWith(ONLINE_MEETINGS_FLAG);
    });
    it('When the flag is disabled / Then it is off', () => {
        bridgeState.bridge = { isFeatureEnabled: () => false };
        expect(renderHook(() => useOnlineMeetingsEnabled()).result.current).toBe(false);
    });
    it('When there is no shell bridge / Then it is off', () => {
        expect(renderHook(() => useOnlineMeetingsEnabled()).result.current).toBe(false);
    });
});

describe('Given providerOptionLabel', () => {
    it('When the provider is available / Then it is the plain label', () => {
        expect(providerOptionLabel({ label: 'Google Meet', available: true })).toBe('Google Meet');
    });
    it.each([
        ['not_connected', 'Microsoft Teams (not connected)'],
        ['not_configured', 'Microsoft Teams (not set up)'],
        ['unavailable', 'Microsoft Teams (unavailable)'],
        [undefined, 'Microsoft Teams (unavailable)'],
        ['weird', 'Microsoft Teams (unavailable)'],
    ])('When unavailable with reason %s / Then it reads "%s"', (reason, expected) => {
        expect(providerOptionLabel({ label: 'Microsoft Teams', available: false, reason })).toBe(expected);
    });
});

describe('Given parseAttendeeEmails', () => {
    it('When given mixed separators, case and duplicates / Then it returns clean unique emails', () => {
        expect(parseAttendeeEmails(' A@x.com, b@y.io;a@X.com\nc@z.org ')).toEqual({ emails: ['a@x.com', 'b@y.io', 'c@z.org'], invalid: [] });
    });
    it('When some entries are not emails / Then they are reported as invalid', () => {
        expect(parseAttendeeEmails('ok@x.com, nope, also@bad')).toEqual({ emails: ['ok@x.com'], invalid: ['nope', 'also@bad'] });
    });
    it('When empty / Then nothing is returned', () => {
        expect(parseAttendeeEmails('  ')).toEqual({ emails: [], invalid: [] });
    });
});
