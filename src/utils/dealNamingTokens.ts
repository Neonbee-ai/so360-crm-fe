// FE mirror of so360-crm-be's src/modules/settings/deal-naming-tokens.ts.
// Keep the token list in sync by hand — both sides must recognize the same
// {token} set for the template inserter chips to match what the backend renders.
export interface DealNameToken {
  token: string;
  label: string;
  sample: string;
}

export const DEAL_NAME_TOKENS: DealNameToken[] = [
  { token: '{lead_name}', label: 'Lead Name', sample: 'John Doe' },
  { token: '{company_name}', label: 'Company Name', sample: 'Acme Corporation' },
  { token: '{customer_name}', label: 'Customer Name', sample: 'Acme Corporation' },
  { token: '{contact_name}', label: 'Contact Name', sample: 'John Doe' },
  { token: '{owner_name}', label: 'Sales Owner', sample: 'Jane Smith' },
  { token: '{org_name}', label: 'Organization Name', sample: 'Naiz Trading LLC' },
  { token: '{YYYY}', label: 'Current Year', sample: '2026' },
  { token: '{YYYYMM}', label: 'Current Year-Month', sample: '202608' },
  { token: '{YYYYMMDD}', label: 'Current Date', sample: '20260804' },
  { token: '{YYYY-MM-DD}', label: 'Current Date (Y-M-D)', sample: '2026-08-04' },
  { token: '{DD-MM-YYYY}', label: 'Current Date (D-M-Y)', sample: '04-08-2026' },
  { token: '{MM-DD-YYYY}', label: 'Current Date (M-D-Y)', sample: '08-04-2026' },
  { token: '{MM}', label: 'Current Month', sample: '08' },
  { token: '{DD}', label: 'Current Day', sample: '04' },
  { token: '{seq}', label: 'Running Sequence Number', sample: '0001' },
  { token: '{deal_prefix}', label: 'Deal Prefix', sample: 'DL' },
  { token: '{deal_suffix}', label: 'Deal Suffix', sample: '2026' },
];
