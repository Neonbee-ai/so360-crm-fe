import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

/**
 * Data Layer on an older Shell: shell-context exposes none of the dataLayer
 * exports (nor useShellBridge), so CRM pages must render natively.
 */

vi.mock('@so360/shell-context', () => ({}));

import {
    isDataLayerAvailable, useCrmDataLayer, useCrmSlot, CrmSlotRegion, CrmCreateSection,
    useCrmInjectedTabs, ensureCrmRecordLayouts,
} from './crmDataLayer';

describe('Feature: Data layer on a Shell without the dataLayer API', () => {
    describe('Given shell-context has no dataLayer exports', () => {
        it('then the capability check reports unavailable and layouts are not registered', () => {
            // When / Then
            expect(isDataLayerAvailable()).toBe(false);
            expect(ensureCrmRecordLayouts()).toBe(false);
        });

        it('then useCrmDataLayer is disabled with no fields', () => {
            const { result } = renderHook(() => useCrmDataLayer('crm.lead'));
            expect(result.current).toEqual({ enabled: false, entity: 'crm.lead', profile: 'internal', isAdmin: false, fields: [] });
        });

        it('then slots resolve empty even for a state claiming to be enabled', () => {
            const state = { enabled: true, entity: 'crm.deal' as const, profile: 'internal', isAdmin: false, fields: [] };
            const { result } = renderHook(() => useCrmSlot(state, 'detail.section'));
            expect(result.current).toEqual([]);
            const tabs = renderHook(() => useCrmInjectedTabs(state, { recordId: 'd1', record: null }));
            expect(tabs.result.current).toEqual([]);
            const { container } = render(
                <div>
                    <CrmSlotRegion dl={state} slot="detail.section" region="main" ctx={{ recordId: 'd1', record: null }} />
                    <CrmCreateSection dl={state} mode="create" values={{}} onValuesChange={vi.fn()} />
                </div>,
            );
            expect(container.firstChild?.childNodes.length).toBe(0);
        });
    });
});
