/**
 * Turns an API rejection into something worth showing a user.
 *
 * Two failure modes were being conflated. A backend that *explains* itself —
 * a 400 listing the invalid field, a 409 duplicate, a 403 — carries a message
 * more useful than any fallback, and flattening it into "Please try again"
 * left users with nothing to act on. A 404/5xx, by contrast, produces text
 * meant for developers: Nest's unmatched-route reply is literally
 * "Cannot DELETE /leads/<uuid>", which is what QA saw on screen.
 *
 * So: show the backend's own message for explained 4xx, and the caller's
 * fallback for everything else.
 */
export function describeApiError(error: unknown, fallback: string): string {
    const status = (error as { status?: number })?.status;
    const message = (error as Error)?.message;
    if (!message) return fallback;
    // Nest's reply for an unmatched route is not a user-facing explanation,
    // whatever status it arrives with. This is the literal string QA saw.
    if (/^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(message)) return fallback;
    // Bare status echoes from the client's own error path say nothing either.
    if (/^API Error: \d+$/.test(message)) return fallback;
    if (status && status >= 400 && status < 500) return message;
    return fallback;
}
