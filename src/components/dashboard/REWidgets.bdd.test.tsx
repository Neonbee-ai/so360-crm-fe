import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), loaded: true }));
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        effectiveFlagsLoaded: flags.loaded,
        isFeatureEnabled: (key: string) => flags.on.has(key),
    }),
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
