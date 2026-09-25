/**
 * Lead statuses the backend treats as won (LeadsService.WON_STATUSES), plus
 * 'customer', the status a promoted lead ends up with. Reaching any of them
 * turns the lead into a customer.
 */
const WON_LEAD_STATUSES = ['converted', 'closed_won', 'won', 'customer'];

/**
 * Whether a lead stage (a per-org, user-named setting such as "Converted" or
 * "Closed Won") is a won stage. The backend lowercases the stage name into the
 * status, so "Closed Won" and "closed_won" are the same stage.
 */
export function isWonLeadStage(stageName: string | null | undefined): boolean {
    const normalized = String(stageName ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return WON_LEAD_STATUSES.includes(normalized);
}
