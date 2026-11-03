import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({
    qa: { get: vi.fn(), put: vi.fn(), check: vi.fn() },
    tr: { get: vi.fn(), put: vi.fn() },
}));
vi.mock('../../../services/salesConfigService', async (importActual) => {
    const actual = await importActual<typeof import('../../../services/salesConfigService')>();
    return { ...actual, quoteApprovalService: svc.qa, taskReminderService: svc.tr };
});

import { toast } from '@so360/design-system';
import { describeReason } from '../../../services/salesConfigService';
import QuoteApprovalSettingsTab from './QuoteApprovalSettingsTab';
import TaskReminderSettingsTab from './TaskReminderSettingsTab';

const base = { enabled: true, discount_percent_above: 10, total_above: null, margin_percent_below: null, approver_role: 'manager', approver_user_ids: [], apply_on: 'both' as const };

beforeEach(() => {
    vi.restoreAllMocks();
    [svc.qa, svc.tr].forEach((s) => Object.values(s).forEach((f) => f.mockReset()));
    svc.qa.get.mockResolvedValue(base);
    svc.tr.get.mockResolvedValue({ enabled: true, default_offset_minutes: 30 });
});

describe('Given the quote approvals tab', () => {
    it('When it loads Then thresholds show and Save puts the edited settings', async () => {
        vi.spyOn(toast, 'success').mockImplementation(() => '' as any);
        svc.qa.put.mockResolvedValue({ ...base, discount_percent_above: 15 });
        render(<QuoteApprovalSettingsTab canWrite />);
        const input = (await screen.findByLabelText('Discount above (%)')) as HTMLInputElement;
        expect(input.value).toBe('10');
        fireEvent.change(input, { target: { value: '15' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(svc.qa.put).toHaveBeenCalledWith(expect.objectContaining({ discount_percent_above: 15 })));
    });
    it('When a threshold is cleared Then it is sent as null', async () => {
        svc.qa.put.mockResolvedValue(base);
        render(<QuoteApprovalSettingsTab canWrite />);
        fireEvent.change(await screen.findByLabelText('Discount above (%)'), { target: { value: '' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(svc.qa.put).toHaveBeenCalledWith(expect.objectContaining({ discount_percent_above: null })));
    });
    it('When the role and total are edited Then they are sent; a blank role becomes null', async () => {
        svc.qa.put.mockResolvedValue(base);
        render(<QuoteApprovalSettingsTab canWrite />);
        fireEvent.change(await screen.findByLabelText('Quote total above'), { target: { value: '5000' } });
        fireEvent.change(screen.getByLabelText('Margin below (%)'), { target: { value: '12' } });
        fireEvent.change(screen.getByLabelText('Approver role'), { target: { value: '  ' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(svc.qa.put).toHaveBeenCalledWith(expect.objectContaining({ total_above: 5000, margin_percent_below: 12, approver_role: null })));
    });
    it('When the server rejects Then an error toast shows', async () => {
        const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
        svc.qa.put.mockRejectedValue(new Error('no approver'));
        render(<QuoteApprovalSettingsTab canWrite />);
        await screen.findByLabelText('Approver role');
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(err).toHaveBeenCalled());
    });
    it('When the load fails Then an error toast shows', async () => {
        const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
        svc.qa.get.mockRejectedValue(new Error('x'));
        render(<QuoteApprovalSettingsTab canWrite />);
        await waitFor(() => expect(err).toHaveBeenCalled());
    });
    it('When the user cannot write Then there is no Save button', async () => {
        render(<QuoteApprovalSettingsTab canWrite={false} />);
        await screen.findByTestId('quote-approval-tab');
        expect(screen.queryByText('Save')).toBeNull();
    });
});

describe('Given describeReason', () => {
    it.each([
        [{ rule: 'discount', actual: 20, threshold: 10 }, 'Discount 20% exceeds 10%'],
        [{ rule: 'total', actual: 900, threshold: 500 }, 'Total 900 exceeds 500'],
        [{ rule: 'margin', actual: 5, threshold: 15 }, 'Margin 5% is below 15%'],
    ] as const)('When %j Then %s', (r, text) => expect(describeReason(r as any)).toBe(text));
});

describe('Given the task reminders tab', () => {
    it('When saved with a valid offset Then it puts the settings', async () => {
        svc.tr.put.mockResolvedValue({ enabled: true, default_offset_minutes: 45 });
        render(<TaskReminderSettingsTab canWrite />);
        fireEvent.change(await screen.findByLabelText('Default reminder (minutes before due)'), { target: { value: '45' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(svc.tr.put).toHaveBeenCalledWith({ enabled: true, default_offset_minutes: 45 }));
    });
    it('When the offset is out of range Then it is rejected client-side', async () => {
        const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
        render(<TaskReminderSettingsTab canWrite />);
        fireEvent.change(await screen.findByLabelText('Default reminder (minutes before due)'), { target: { value: '99999' } });
        fireEvent.click(screen.getByText('Save'));
        expect(err).toHaveBeenCalled();
        expect(svc.tr.put).not.toHaveBeenCalled();
    });
    it('When the server fails Then an error toast shows', async () => {
        const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
        svc.tr.put.mockRejectedValue(new Error('x'));
        render(<TaskReminderSettingsTab canWrite />);
        await screen.findByLabelText('Default reminder (minutes before due)');
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(err).toHaveBeenCalled());
    });
    it('When the load fails Then an error toast shows', async () => {
        const err = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
        svc.tr.get.mockRejectedValue(new Error('x'));
        render(<TaskReminderSettingsTab canWrite />);
        await waitFor(() => expect(err).toHaveBeenCalled());
    });
    it('When read-only Then no Save button', async () => {
        render(<TaskReminderSettingsTab canWrite={false} />);
        await screen.findByTestId('task-reminders-tab');
        expect(screen.queryByText('Save')).toBeNull();
    });
});
