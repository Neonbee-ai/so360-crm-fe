// Stub for @so360/formatters — vi.mock() in each test overrides these
export const formatCurrency = (v: number) => `$${v}`;
export const formatDate = (d: string) => d;
export const formatDateTime = (d: string) => d;
export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const useFormatters = () => ({
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
});
