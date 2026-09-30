import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';

const bridge = vi.hoisted(() => ({ value: {} as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => bridge.value }));

import ExportMenu, { useCanExport } from './ExportMenu';

/** Feature: RE §48 export buttons and their permission / flag gating. */
beforeEach(() => {
    bridge.value = {
        permissionsLoaded: true,
        hasPermission: () => true,
        isFeatureEnabled: () => true,
        effectiveFlagsLoaded: true,
    };
});

describe('Feature: ExportMenu', () => {
    describe('Given the menu is shown', () => {
        it('then one labelled button per format is offered', () => {
            render(<ExportMenu label="Export leads" onExport={vi.fn()} />);
            expect(screen.getByRole('group', { name: 'Export leads' })).toBeTruthy();
            for (const f of ['CSV', 'Excel', 'PDF']) {
                expect(screen.getByRole('button', { name: `Export leads as ${f}` }).textContent).toContain(f);
            }
        });
    });

    describe('When a format is clicked', () => {
        it('then the export runs with that format and all buttons are disabled while busy', async () => {
            let finish: () => void = () => {};
            const onExport = vi.fn(() => new Promise<void>((r) => { finish = r; }));
            render(<ExportMenu label="Export deals" onExport={onExport} />);
            fireEvent.click(screen.getByRole('button', { name: 'Export deals as Excel' }));
            expect(onExport).toHaveBeenCalledWith('xlsx');
            await waitFor(() => expect((screen.getByRole('button', { name: 'Export deals as PDF' }) as HTMLButtonElement).disabled).toBe(true));
            expect(screen.getByTestId('icon-Loader2')).toBeTruthy();
            fireEvent.click(screen.getByRole('button', { name: 'Export deals as CSV' }));
            expect(onExport).toHaveBeenCalledTimes(1);
            finish();
            await waitFor(() => expect((screen.getByRole('button', { name: 'Export deals as PDF' }) as HTMLButtonElement).disabled).toBe(false));
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('then an explained 4xx is shown as the error', async () => {
            const onExport = vi.fn().mockRejectedValue(Object.assign(new Error('You do not have permission to export'), { status: 403 }));
            render(<ExportMenu label="Export sales" onExport={onExport} />);
            fireEvent.click(screen.getByRole('button', { name: 'Export sales as CSV' }));
            expect((await screen.findByRole('alert')).textContent).toBe('You do not have permission to export');
        });

        it('then a 5xx shows the generic fallback, and a retry clears it', async () => {
            const onExport = vi.fn()
                .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
                .mockResolvedValueOnce(undefined);
            render(<ExportMenu label="Export sales" onExport={onExport} />);
            fireEvent.click(screen.getByRole('button', { name: 'Export sales as PDF' }));
            expect((await screen.findByRole('alert')).textContent).toBe('Export failed. Please try again.');
            fireEvent.click(screen.getByRole('button', { name: 'Export sales as PDF' }));
            await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        });
    });
});

describe('Feature: useCanExport', () => {
    const can = (permission = 'leads.export', flag?: string) =>
        renderHook(() => useCanExport(permission, flag)).result.current;

    describe('Given permissions and flags are loaded and granted', () => {
        it('then export is allowed with or without a flag', () => {
            expect(can()).toBe(true);
            expect(can('deals.export', 'action:crm:data_export')).toBe(true);
        });
    });

    describe('Given permissions have not loaded yet', () => {
        it('then export fails closed', () => {
            bridge.value.permissionsLoaded = false;
            expect(can()).toBe(false);
        });
    });

    describe('Given the user lacks the export permission', () => {
        it('then export is hidden and the permission asked for is the one given', () => {
            const hasPermission = vi.fn((p: string) => p === 'leads.read');
            bridge.value.hasPermission = hasPermission;
            expect(can('leads.export')).toBe(false);
            expect(hasPermission).toHaveBeenCalledWith('leads.export');
        });

        it('then a shell without hasPermission fails closed', () => {
            delete bridge.value.hasPermission;
            expect(can()).toBe(false);
        });
    });

    describe('Given a flag is required', () => {
        it('then the flag being off hides export', () => {
            bridge.value.isFeatureEnabled = (k: string) => k !== 'action:crm:data_export';
            expect(can('leads.export', 'action:crm:data_export')).toBe(false);
        });

        it('then effective flags not yet loaded hides export', () => {
            bridge.value.effectiveFlagsLoaded = false;
            expect(can('leads.export', 'action:crm:data_export')).toBe(false);
        });

        it('then the flag is ignored when none is required', () => {
            bridge.value.isFeatureEnabled = () => false;
            expect(can('deals.export')).toBe(true);
        });
    });

    describe('Given no shell bridge at all', () => {
        it('then export fails closed', () => {
            bridge.value = null;
            expect(can()).toBe(false);
        });
    });
});
