/**
 * The caller's Supabase access token, wherever it actually lives.
 *
 * `sb-access-token` is a LEGACY key that only some MFEs ever wrote. Supabase-js
 * stores the session as JSON under `sb-<project-ref>-auth-token`, so a
 * component that reads the legacy key alone gets null in the shell, sends
 * `Authorization: Bearer ` with nothing after it, and every request it makes
 * comes back 401 — which looks like a permissions problem rather than a
 * missing token.
 *
 * Mirrors shell-context's getAccessTokenFromStorage. Duplicated rather than
 * imported because this package does not depend on shell-context, and adding
 * that dependency to a package bundled into every MFE is a bigger change than
 * the fifteen lines it would save.
 */
export function getAccessToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';

  const direct = window.localStorage.getItem('sb-access-token');
  if (direct) return direct;

  const readToken = (raw: string | null): string => {
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return (
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token ||
        ''
      );
    } catch {
      return '';
    }
  };

  const blob = readToken(window.localStorage.getItem('sb-auth-token'));
  if (blob) return blob;

  // Supabase-js default: sb-<project-ref>-auth-token
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    const token = readToken(window.localStorage.getItem(key));
    if (token) return token;
  }

  return window.localStorage.getItem('supabase.auth.token') || '';
}
