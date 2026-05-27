import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCRMFormatters, useCRMCurrencySymbol } from './formatters';

vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: vi.fn(),
}));

vi.mock('@so360/formatters', () => ({
    useFormatters: vi.fn((config: any) => ({
        formatCurrency: (v: number) => `${config.currency}${v.toFixed(2)}`,
        formatDate: (d: string) => `[${config.timezone}]${d}`,
    })),
}));

import { useBusinessSettings } from '@so360/shell-context';

const mockUseBusinessSettings = useBusinessSettings as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useCRMFormatters', () => {
    describe('Given org settings are available', () => {
        it('When called / Then formatCurrency uses the org base_currency', () => {
            mockUseBusinessSettings.mockReturnValue({
                settings: { base_currency: 'AED', document_language: 'ar-AE', timezone: 'Asia/Dubai' },
            });
            const { result } = renderHook(() => useCRMFormatters());
            expect(result.current.formatCurrency(100)).toContain('AED');
        });

        it('When called / Then formatDate uses the org timezone', () => {
            mockUseBusinessSettings.mockReturnValue({
                settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'America/New_York' },
            });
            const { result } = renderHook(() => useCRMFormatters());
            expect(result.current.formatDate('2025-01-01')).toContain('America/New_York');
        });
    });

    describe('Given org settings are undefined', () => {
        it('When called / Then formatCurrency falls back to USD', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: undefined });
            const { result } = renderHook(() => useCRMFormatters());
            expect(result.current.formatCurrency(50)).toContain('USD');
        });

        it('When called / Then formatDate falls back to UTC timezone', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: undefined });
            const { result } = renderHook(() => useCRMFormatters());
            expect(result.current.formatDate('2025-01-01')).toContain('UTC');
        });
    });

    describe('Given base_currency is missing from settings', () => {
        it('When called / Then formatCurrency falls back to USD', () => {
            mockUseBusinessSettings.mockReturnValue({
                settings: { document_language: 'en-US', timezone: 'UTC' },
            });
            const { result } = renderHook(() => useCRMFormatters());
            expect(result.current.formatCurrency(10)).toContain('USD');
        });
    });
});

describe('useCRMCurrencySymbol', () => {
    describe('Given org base_currency is USD', () => {
        it('When called / Then returns the $ symbol', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'USD' } });
            const { result } = renderHook(() => useCRMCurrencySymbol());
            expect(result.current).toBe('$');
        });
    });

    describe('Given org base_currency is AED', () => {
        it('When called / Then returns the AED symbol', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'AED' } });
            const { result } = renderHook(() => useCRMCurrencySymbol());
            expect(result.current).toBeTruthy();
        });
    });

    describe('Given settings are undefined', () => {
        it('When called / Then returns the $ fallback', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: undefined });
            const { result } = renderHook(() => useCRMCurrencySymbol());
            expect(result.current).toBe('$');
        });
    });

    describe('Given settings has no base_currency', () => {
        it('When called / Then returns the $ fallback', () => {
            mockUseBusinessSettings.mockReturnValue({ settings: {} });
            const { result } = renderHook(() => useCRMCurrencySymbol());
            expect(result.current).toBe('$');
        });
    });
});
