export interface MarketingKpiCard {
  label: string;
  value: string | number;
  hint?: string;
}

export interface CampaignVm {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  totalRecipients: number;
  sentAt?: string | null;
}

export interface AbandonedCartVm {
  id: string;
  customerEmail: string;
  cartTotal: number;
  itemCount: number;
  status: string;
  abandonedAt?: string | null;
}

export const formatMoney = (
  value: number | string | null | undefined,
  currencyCode?: string,
  locale: string = 'en-US',
): string => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '0.00';
  if (currencyCode) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fall through to generic number rendering when currency code is invalid
    }
  }
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

export const mapCampaign = (raw: any): CampaignVm => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || ''),
  campaignType: String(raw?.campaign_type || raw?.campaignType || '-'),
  status: String(raw?.status || '-'),
  totalRecipients: Number(raw?.total_recipients || 0),
  sentAt: raw?.sent_at || null,
});

export const mapAbandonedCart = (raw: any): AbandonedCartVm => ({
  id: String(raw?.id || ''),
  customerEmail: String(raw?.customer_email || ''),
  cartTotal: Number(raw?.cart_total || 0),
  itemCount: Number(raw?.item_count || 0),
  status: String(raw?.recovery_status || ''),
  abandonedAt: raw?.abandoned_at || null,
});
