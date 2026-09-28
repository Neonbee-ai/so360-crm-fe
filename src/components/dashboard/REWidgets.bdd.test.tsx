import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), loaded: true, throws: false }));
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => {
        if (flags.throws) throw new Error('no shell bridge');
        return {
            effectiveFlagsLoaded: flags.loaded,
            isFeatureEnabled: (key: string) => flags.on.has(key),
        };
    },
}));
vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `AED ${v}` }),
}));
vi.mock('../../services/reWidgetsService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/reWidgetsService')>();
    return { ...actual, reWidgetsService: { get: (...a: any[]) => mockGet(...a) } };
});

import REWidgets from './REWidgets';
import { normalizeREWidgets } from '../../services/reWidgetsService';

const FLAG = 'submodule:crm:re_widgets';
const full = () => normalizeREWidgets({
    inventory_by_project: [{ project: 'Marina', available: 84, held: 12, sold: 24 }],
    pipeline_by_project: [{ project: 'Marina', value: 38000000, count: 9 }],
    holds_expiring: [{ item_id: 'i1', unit_number: 'MH-A-1201', project: 'Marina', hours_left: 6 }],
    source_performance: [{ source: 'Meta', leads: 50, won: 19, rate: 38 }, { source: 'Bayut', leads: 50, won: 11, rate: 22 }],
});

beforeEach(() => {
    vi.clearAllMocks();
    flags.on.clear();
    flags.loaded = true;
    flags.throws = false;
    mockGet.mockResolvedValue(full());
});

describe('Given the RE dashboard widgets', () => {
    describe('When the re_widgets flag is off (non-RE tenant)', () => {
        it('Then nothing renders and no request is made', async () => {
            const { container } = render(<REWidgets />);
            await Promise.resolve();
            expect(container).toBeEmptyDOMElement();
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('When the shell flags are not loaded yet', () => {
        it('Then the flag reads as off and nothing is fetched', async () => {
            flags.on.add(FLAG);
            flags.loaded = false;
            const { container } = render(<REWidgets />);
            await Promise.resolve();
            expect(container).toBeEmptyDOMElement();
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('When the flag is on and data loads', () => {
        it('Then the four cards show inventory, pipeline, expiring holds and source conversion', async () => {
            flags.on.add(FLAG);
            render(<REWidgets />);
            await screen.findByTestId('re-widgets');

            const inv = screen.getByTestId('re-widget-inventory');
            expect(within(inv).getByText('Marina')).toBeInTheDocument();
            expect(within(inv).getByText('84A')).toBeInTheDocument();
            expect(within(inv).getByText('12H')).toBeInTheDocument();
            expect(within(inv).getByText('24S')).toBeInTheDocument();

            expect(within(screen.getByTestId('re-widget-pipeline')).getByText('AED 38000000')).toBeInTheDocument();

            const holds = screen.getByTestId('re-widget-holds');
            expect(within(holds).getByText('MH-A-1201')).toBeInTheDocument();
            expect(within(holds).getByText('6h')).toBeInTheDocument();

            const src = screen.getByTestId('re-widget-sources');
            expect(within(src).getByText('Meta')).toBeInTheDocument();
            expect(within(src).getByText('38%')).toBeInTheDocument();
            expect(within(src).getByText('22%')).toBeInTheDocument();
        });

        it('Then an empty section explains itself instead of leaving a blank card', async () => {
            flags.on.add(FLAG);
            mockGet.mockResolvedValue({ ...full(), holds_expiring: [] });
            render(<REWidgets />);
            const holds = await screen.findByTestId('re-widget-holds');
            expect(within(holds).getByText('No holds expiring')).toBeInTheDocument();
        });
    });

    describe('When the flag is on but every section is empty', () => {
        it('Then nothing renders', async () => {
            flags.on.add(FLAG);
            mockGet.mockResolvedValue(normalizeREWidgets({}));
            const { container } = render(<REWidgets />);
            await waitFor(() => expect(mockGet).toHaveBeenCalled());
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the request fails', () => {
        it('Then the widgets stay hidden and nothing throws', async () => {
            flags.on.add(FLAG);
            mockGet.mockRejectedValue(new Error('404'));
            const { container } = render(<REWidgets />);
            await waitFor(() => expect(mockGet).toHaveBeenCalled());
            expect(container).toBeEmptyDOMElement();
        });
    });
});

describe('Given the RE widgets with sparse or long data', () => {
    beforeEach(() => { flags.on.add(FLAG); });

    describe('When inventory, pipeline and sources are all empty but a hold exists', () => {
        it('Then each empty card explains itself', async () => {
            mockGet.mockResolvedValue(normalizeREWidgets({ holds_expiring: [{ unit_number: 'X-1', hours_left: 3 }] }));
            render(<REWidgets />);
            await screen.findByTestId('re-widgets');
            expect(within(screen.getByTestId('re-widget-inventory')).getByText('No units yet')).toBeInTheDocument();
            expect(within(screen.getByTestId('re-widget-pipeline')).getByText('No open deals')).toBeInTheDocument();
            expect(within(screen.getByTestId('re-widget-sources')).getByText('No leads yet')).toBeInTheDocument();
        });
    });

    describe('When holds have under an hour, six hours or more than six hours left', () => {
        it('Then they read <1h in red, 6h in red and 7h in amber, keyed even without an item id', async () => {
            mockGet.mockResolvedValue(normalizeREWidgets({
                holds_expiring: [
                    { unit_number: 'U-0', hours_left: 0, project: 'Palm' },
                    { unit_number: 'U-6', hours_left: 6 },
                    { item_id: 'i7', unit_number: 'U-7', hours_left: 7 },
                ],
            }));
            render(<REWidgets />);
            const holds = await screen.findByTestId('re-widget-holds');
            expect(within(holds).getByText('<1h').className).toMatch(/text-red-400/);
            expect(within(holds).getByText('6h').className).toMatch(/text-red-400/);
            expect(within(holds).getByText('7h').className).toMatch(/text-amber-400/);
            expect(within(holds).getByText('U-0')).toHaveAttribute('title', 'Palm');
            expect(within(holds).getByText('U-6')).not.toHaveAttribute('title');
        });
    });

    describe('When a section has more than five rows', () => {
        it('Then only the first five show', async () => {
            const projects = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
            mockGet.mockResolvedValue(normalizeREWidgets({
                inventory_by_project: projects.map((project) => ({ project, available: 1, held: 0, sold: 0 })),
                pipeline_by_project: projects.map((project) => ({ project, value: 1, count: 1 })),
                holds_expiring: projects.map((p, i) => ({ unit_number: `H-${p}`, hours_left: i + 1 })),
                source_performance: projects.map((source, i) => ({ source, rate: 60 - i })),
            }));
            render(<REWidgets />);
            await screen.findByTestId('re-widgets');
            for (const id of ['re-widget-inventory', 're-widget-pipeline', 're-widget-holds', 're-widget-sources']) {
                expect(within(screen.getByTestId(id)).getAllByRole('listitem')).toHaveLength(5);
            }
            expect(within(screen.getByTestId('re-widget-inventory')).queryByText('P6')).not.toBeInTheDocument();
        });
    });

    describe('When the dashboard unmounts before the request settles', () => {
        it('Then a late success or failure is ignored', async () => {
            let resolveGet: (v: unknown) => void = () => {};
            mockGet.mockReturnValueOnce(new Promise((r) => { resolveGet = r; }));
            render(<REWidgets />).unmount();
            resolveGet(full());

            let rejectGet: (e: unknown) => void = () => {};
            mockGet.mockReturnValueOnce(new Promise((_, rej) => { rejectGet = rej; }));
            render(<REWidgets />).unmount();
            rejectGet(new Error('late'));

            await Promise.resolve();
            expect(screen.queryByTestId('re-widgets')).not.toBeInTheDocument();
        });
    });

    describe('When the flag turns off after the widgets showed', () => {
        it('Then they disappear', async () => {
            const view = render(<REWidgets />);
            await screen.findByTestId('re-widgets');
            flags.on.delete(FLAG);
            view.rerender(<REWidgets />);
            await waitFor(() => expect(screen.queryByTestId('re-widgets')).not.toBeInTheDocument());
        });
    });
});

describe('Given a shell that throws while rendering the widgets', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => { errorSpy.mockRestore(); });

    it('When the bridge throws / Then the boundary swallows it and renders nothing', () => {
        flags.throws = true;
        const { container } = render(<REWidgets />);
        expect(container).toBeEmptyDOMElement();
        expect(mockGet).not.toHaveBeenCalled();
    });
});
