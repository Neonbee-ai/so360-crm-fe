import { useShellBridge } from '@so360/shell-context';

/**
 * Pulse ab92e893: Schedule Meeting can create a real Google Meet / Teams /
 * Zoom meeting and the list shows a Join action. Off, or while flags are
 * still loading, the scheduler keeps the plain "Location / Link" field.
 */
export const ONLINE_MEETINGS_FLAG = 'submodule:crm:online_meetings';

export function useOnlineMeetingsEnabled(): boolean {
    const bridge = useShellBridge();
    if (bridge?.effectiveFlagsLoaded === false) return false;
    return bridge?.isFeatureEnabled?.(ONLINE_MEETINGS_FLAG) === true;
}

const REASON_SUFFIX: Record<string, string> = {
    not_connected: 'not connected',
    not_configured: 'not set up',
    unavailable: 'unavailable',
};

/** Picker label: "Zoom (not set up)" for providers that cannot be used yet. */
export function providerOptionLabel(p: { label: string; available: boolean; reason?: string }): string {
    if (p.available) return p.label;
    return `${p.label} (${REASON_SUFFIX[p.reason ?? ''] ?? 'unavailable'})`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma/semicolon/space separated emails → trimmed, de-duplicated; invalid ones reported. */
export function parseAttendeeEmails(raw: string): { emails: string[]; invalid: string[] } {
    const emails: string[] = [];
    const invalid: string[] = [];
    for (const part of raw.split(/[\s,;]+/)) {
        const e = part.trim().toLowerCase();
        if (!e) continue;
        if (!EMAIL_RE.test(e)) invalid.push(part.trim());
        else if (!emails.includes(e)) emails.push(e);
    }
    return { emails, invalid };
}
