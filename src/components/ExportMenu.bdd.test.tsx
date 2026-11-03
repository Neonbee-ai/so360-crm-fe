import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';

const bridge = vi.hoisted(() => ({ value: {} as any }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => bridge.value }));

vi.mock('@so360/design-system', async () => {
    const R = await import('react');
    return {
        Button: ({ children, ...rest }: any) => R.createElement('button', { type: 'button', ...rest }, children),
        Menu: ({ trigger, items }: any) => {
            const [open, setOpen] = R.useState(false);
            return R.createElement(R.Fragment, null,
                R.cloneElement(trigger, { onClick: () => setOpen((v: boolean) => !v) }),
                open ? R.createElement('div', { role: 'menu' }, items.map((i: any) =>
                    R.createElement('div', { key: i.label, role: 'menuitem', 'aria-disabled': i.disabled ? 'true' : undefined,
                        onClick: () => { if (!i.disabled) { i.onSelect(); setOpen(false); } } }, i.label))) : null);
        },
    };
});

import ExportMenu, { useCanExport } from './ExportMenu';

const pick = (label: string, fmt: string) => {
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('menuitem', { name: fmt }));
};

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
        it('then a single labelled Export button offers CSV, Excel and PDF', () => {
            render(<ExportMenu label="Export leads" onExport={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Export leads' }));
            for (const f of ['CSV', 'Excel', 'PDF']) {
                expect(screen.getByRole('menuitem', { name: f })).toBeTruthy();
            }
        });
    });

    describe('Given a formats subset is passed', () => {
        it('then only those formats are offered', () => {
            render(<ExportMenu label="Export quotes" formats={['csv']} onExport={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Export quotes' }));
            expect(screen.getByRole('menuitem', { name: 'CSV' })).toBeTruthy();
            expect(screen.queryByRole('menuitem', { name: 'PDF' })).toBeNull();
            expect(screen.queryByRole('menuitem', { name: 'Excel' })).toBeNull();
        });
    });

    describe('When a format is chosen', () => {
        it('then the export runs with that format and the trigger is disabled while busy', async () => {
            let finish: () => void = () => {};
            const onExport = vi.fn(() => new Promise<void>((r) => { finish = r; }));
            render(<ExportMenu label="Export deals" onExport={onExport} />);
            pick('Export deals', 'Excel');
            expect(onExport).toHaveBeenCalledWith('xlsx');
            await waitFor(() => expect((screen.getByRole('button', { name: 'Export deals' }) as HTMLButtonElement).disabled).toBe(true));
            expect(screen.getByTestId('icon-Loader2')).toBeTruthy();
            expect(onExport).toHaveBeenCalledTimes(1);
            finish();
            await waitFor(() => expect((screen.getByRole('button', { name: 'Export deals' }) as HTMLButtonElement).disabled).toBe(false));
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('then the className is applied to the wrapper', () => {
            const { container } = render(<ExportMenu label="Export deals" onExport={vi.fn()} className="ml-2" />);
            expect((container.firstChild as HTMLElement).className).toContain('ml-2');
        });

        it('then an explained 4xx is shown as the error', async () => {
            const onExport = vi.fn().mockRejectedValue(Object.assign(new Error('You do not have permission to export'), { status: 403 }));
            render(<ExportMenu label="Export sales" onExport={onExport} />);
            pick('Export sales', 'CSV');
            expect((await screen.findByRole('alert')).textContent).toBe('You do not have permission to export');
        });

        it('then a 5xx shows the generic fallback, and a retry clears it', async () => {
            const onExport = vi.fn()
                .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
                .mockResolvedValueOnce(undefined);
            render(<ExportMenu label="Export sales" onExport={onExport} />);
            pick('Export sales', 'PDF');
            expect((await screen.findByRole('alert')).textContent).toBe('Export failed. Please try again.');
            pick('Export sales', 'PDF');
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

        it('then a shell without isFeatureEnabled fails closed', () => {
            delete bridge.value.isFeatureEnabled;
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
