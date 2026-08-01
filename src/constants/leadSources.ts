export const LEAD_SOURCES = [
    'Website',
    'Referral',
    'Cold Call',
    'LinkedIn',
] as const;

export type LeadSource = typeof LEAD_SOURCES[number];
