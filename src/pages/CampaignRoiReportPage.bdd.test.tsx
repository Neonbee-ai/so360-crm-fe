import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import React from 'react';
import type { CampaignRoiRow } from '../services/crmCampaignService';

/**
 * Feature: Campaign ROI report (RE Phase D §25, `submodule:crm:campaign_roi`).
 * Totals across campaigns, then one row per campaign with leads, won deals,
 * revenue, spend, CPL and ROI. 403 shows a plain no-access message.
 */

const svc = vi.hoisted(() => ({ roiReport: vi.fn(), campaignRoi: vi.fn() }));

vi.mock('../services/crmCampaignService', async (importActual) => {
    const actual = await importActual<typeof import('../services/crmCampaignService')>();
    return { ...actual, crmCampaignService: svc };
});
vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `AED ${v}` }),
}));

import CampaignRoiReportPage, { formatRatio } from './CampaignRoiReportPage';

const row = (over: Partial<CampaignRoiRow['campaign']> = {}, roi: Partial<CampaignRoiRow['roi']> = {}): CampaignRoiRow => ({
    campaign: {
        id: 'c1', name: 'Marina Q4', channel: 'meta', status: 'active', budget: 10000, spend: 2000,
        currency: 'AED', start_date: null, end_date: null, utm_campaign: 'marina_q4', ...over,
    },
    roi: {
        leads: 40, qualified: 10, deals_won: 2, revenue: 6000, spend: 2000,
        cpl: 50, roi: 2, conversion_rate: 0.05, ...roi,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    svc.roiReport.mockReset();
});

describe('Feature: Campaign ROI report', () => {
    describe('Given the report is loading', () => {
        it('When the page opens / Then a loading status shows and every status is requested', () => {
            svc.roiReport.mockReturnValue(new Promise(() => {}));
            render(<CampaignRoiReportPage />);
            expect(screen.getByRole('status')).toHaveTextContent('Loading campaign ROI…');
            expect(svc.roiReport).toHaveBeenCalledWith('');
        });
    });

    describe('Given two campaigns with results', () => {
        it('When the report loads / Then blended totals and per-campaign rows are shown', async () => {
            svc.roiReport.mockResolvedValue([
                row(),
                row({ id: 'c2', name: 'Bayut listing', utm_campaign: null, channel: null }, {
                    leads: 10, qualified: 0, deals_won: 0, revenue: 0, spend: 1000, cpl: 100, roi: -1, conversion_rate: 0,
                }),
            ]);
            render(<CampaignRoiReportPage />);
            expect(await screen.findByTestId('roi-total-leads')).toHaveTextContent('50');
            expect(screen.getByTestId('roi-total-revenue')).toHaveTextContent('AED 6000');
            expect(screen.getByTestId('roi-total-spend')).toHaveTextContent('AED 3000');
            expect(screen.getByTestId('roi-total-cpl')).toHaveTextContent('AED 60');
            expect(screen.getByTestId('roi-total-roi')).toHaveTextContent('100.0%');
            const rows = screen.getAllByTestId('campaign-roi-row');
            expect(rows).toHaveLength(2);
            expect(within(rows[0]).getByText('Marina Q4')).toBeInTheDocument();
            expect(within(rows[0]).getByText('utm: marina_q4')).toBeInTheDocument();
            expect(within(rows[0]).getByText('200.0%')).toBeInTheDocument();
            expect(within(rows[1]).getByText('-100.0%')).toHaveClass('text-rose-400');
        });
    });

    describe('Given the status filter', () => {
        it('When the user picks Active / Then the report is re-requested for that status', async () => {
            svc.roiReport.mockResolvedValue([row()]);
            render(<CampaignRoiReportPage />);
            await screen.findByTestId('roi-total-leads');
            fireEvent.change(screen.getByLabelText('Campaign status'), { target: { value: 'active' } });
            await screen.findByTestId('roi-total-leads');
            expect(svc.roiReport).toHaveBeenLastCalledWith('active');
        });
    });

    describe('Given no campaigns exist', () => {
        it('When the list is empty / Then the empty state is shown instead of totals', async () => {
            svc.roiReport.mockResolvedValue([]);
            render(<CampaignRoiReportPage />);
            expect(await screen.findByTestId('campaign-roi-empty')).toBeInTheDocument();
            expect(screen.queryByTestId('roi-total-leads')).not.toBeInTheDocument();
        });
    });

    describe('Given the caller lacks access', () => {
        it('When the API answers 403 / Then a no-access message shows with no Retry', async () => {
            svc.roiReport.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            render(<CampaignRoiReportPage />);
            expect(await screen.findByTestId('campaign-roi-forbidden')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
        });
    });

    describe('Given the request fails', () => {
        it('When a 500 arrives / Then the fallback shows and Retry reloads', async () => {
            svc.roiReport.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            svc.roiReport.mockResolvedValueOnce([row()]);
            render(<CampaignRoiReportPage />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the campaign ROI report.');
            fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('roi-total-leads')).toBeInTheDocument();
            expect(svc.roiReport).toHaveBeenCalledTimes(2);
        });
    });

    describe('Given formatRatio', () => {
        it('then null renders as a dash and ratios as percentages', () => {
            expect(formatRatio(null)).toBe('—');
            expect(formatRatio(0.125)).toBe('12.5%');
        });
    });
    describe('Given the page is left before the report settles', () => {
        it('When the request resolves after unmount / Then no state update is attempted', async () => {
            let resolve!: (v: CampaignRoiRow[]) => void;
            svc.roiReport.mockReturnValue(new Promise((r) => { resolve = r; }));
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { unmount } = render(<CampaignRoiReportPage />);
            unmount();
            await act(async () => { resolve([row()]); });
            expect(errSpy).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
        it('When the request rejects after unmount / Then the error is swallowed silently', async () => {
            let reject!: (e: unknown) => void;
            svc.roiReport.mockReturnValue(new Promise((_r, j) => { reject = j; }));
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { unmount } = render(<CampaignRoiReportPage />);
            unmount();
            await act(async () => { reject(Object.assign(new Error('late'), { status: 500 })); });
            expect(errSpy).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe('Given the request rejects with no error object', () => {
        it('When the rejection value is undefined / Then the generic fallback message shows', async () => {
            svc.roiReport.mockRejectedValue(undefined);
            render(<CampaignRoiReportPage />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the campaign ROI report.');
            expect(screen.queryByTestId('campaign-roi-forbidden')).not.toBeInTheDocument();
        });
    });

    describe('Given a campaign with no spend and no leads', () => {
        it('When the report loads / Then CPL and ROI render as dashes and ROI is not highlighted', async () => {
            svc.roiReport.mockResolvedValue([
                row({ utm_campaign: null }, {
                    leads: 0, qualified: 0, deals_won: 0, revenue: 0, spend: 0, cpl: null, roi: null, conversion_rate: null,
                }),
            ]);
            render(<CampaignRoiReportPage />);
            expect(await screen.findByTestId('roi-total-cpl')).toHaveTextContent('—');
            expect(screen.getByTestId('roi-total-roi')).toHaveTextContent('—');
            const cells = within(screen.getByTestId('campaign-roi-row')).getAllByRole('cell');
            const roiCell = cells[cells.length - 1];
            expect(roiCell).toHaveTextContent('—');
            expect(roiCell).not.toHaveClass('text-rose-400');
            expect(within(cells[0]).queryByText(/utm:/)).not.toBeInTheDocument();
        });
    });

    describe('Given the service resolves with no list at all', () => {
        it('When loading finishes / Then neither the empty state nor the table is rendered', async () => {
            svc.roiReport.mockResolvedValue(undefined);
            render(<CampaignRoiReportPage />);
            await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
            expect(svc.roiReport).toHaveBeenCalledTimes(1);
            expect(screen.queryByTestId('campaign-roi-empty')).not.toBeInTheDocument();
            expect(screen.queryByTestId('campaign-roi-row')).not.toBeInTheDocument();
        });
    });
});
