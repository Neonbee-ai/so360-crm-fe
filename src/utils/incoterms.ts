/**
 * Incoterms® 2020 — the eleven trade terms published by the International Chamber
 * of Commerce, kept in sync with the `quotes_incoterm_check` constraint in
 * so360-crm-be migration 047 and the INCOTERMS_2020 list in its quote DTO.
 *
 * The rule chosen on a quotation determines where cost and risk pass from seller
 * to buyer, so it is offered as a closed list rather than free text: a typo here
 * changes who legally pays freight and who bears the loss if goods are damaged.
 *
 * The four sea-and-inland-waterway rules are marked because applying them to air
 * or road freight is the single most common Incoterms error in practice.
 */
export interface Incoterm {
    code: string;
    label: string;
    /** True for the rules valid only for sea and inland waterway transport. */
    seaOnly?: boolean;
}

export const INCOTERMS_2020: Incoterm[] = [
    { code: 'EXW', label: 'Ex Works' },
    { code: 'FCA', label: 'Free Carrier' },
    { code: 'CPT', label: 'Carriage Paid To' },
    { code: 'CIP', label: 'Carriage and Insurance Paid To' },
    { code: 'DAP', label: 'Delivered at Place' },
    { code: 'DPU', label: 'Delivered at Place Unloaded' },
    { code: 'DDP', label: 'Delivered Duty Paid' },
    { code: 'FAS', label: 'Free Alongside Ship', seaOnly: true },
    { code: 'FOB', label: 'Free on Board', seaOnly: true },
    { code: 'CFR', label: 'Cost and Freight', seaOnly: true },
    { code: 'CIF', label: 'Cost, Insurance and Freight', seaOnly: true },
];

export const INCOTERM_LABELS: Record<string, string> = Object.fromEntries(
    INCOTERMS_2020.map((t) => [t.code, t.label]),
);

export function isValidIncoterm(code: string | null | undefined): boolean {
    return !!code && code in INCOTERM_LABELS;
}
