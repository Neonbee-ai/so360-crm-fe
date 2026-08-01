import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters as useFormattersBase } from '@so360/formatters';

export function useCRMFormatters() {
    const { settings } = useBusinessSettings();
    return useFormattersBase({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
}

export function useCRMCurrencySymbol(): string {
    const { settings } = useBusinessSettings();
    if (!settings?.base_currency) return '$';
    try {
        return new Intl.NumberFormat('en', { style: 'currency', currency: settings.base_currency })
            .formatToParts(0)
            .find(p => p.type === 'currency')?.value || settings.base_currency;
    } catch {
        return settings.base_currency;
    }
}
