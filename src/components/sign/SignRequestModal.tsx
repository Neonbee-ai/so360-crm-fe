import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, FileSignature } from 'lucide-react';

interface Props {
    onClose: () => void;
    prefillName?: string;
    prefillEmail?: string;
    sourceModel: string;  // e.g. 'crm.lead' or 'crm.deal'
    sourceId: string;
}

const SignRequestModal: React.FC<Props> = ({ onClose, prefillName, prefillEmail, sourceModel, sourceId }) => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [templateId, setTemplateId] = useState('');
    const [signerName, setSignerName] = useState(prefillName ?? '');
    const [signerEmail, setSignerEmail] = useState(prefillEmail ?? '');
    const [routing, setRouting] = useState<'parallel' | 'sequential'>('parallel');
    const [expiresInDays, setExpiresInDays] = useState('7');
    const [phase, setPhase] = useState<'loading' | 'idle' | 'sending' | 'done' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    // Resolve Sign BE origin: window override → build-time env → localhost dev fallback (3038).
    // Mirrors the *_API_ORIGIN resolution used across crmService.ts so it works inside the shell.
    function getSignApiBase(): string {
        const env = (import.meta as any)?.env || {};
        const win = typeof window !== 'undefined' ? (window as any) : {};
        return String(
            win.VITE_SO360_SIGN_API ||
            env.VITE_SO360_SIGN_API ||
            'http://localhost:3038'
        ).replace(/\/$/, '');
    }

    function getAuthHeaders(): HeadersInit {
        // Read shell context for auth token and tenant/org IDs
        const ctx = (window as any).__SO360_SHELL_CONTEXT__;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx?.accessToken ?? ''}`,
            'X-Tenant-Id': ctx?.tenantId ?? '',
            'X-Org-Id': ctx?.orgId ?? '',
            'X-User-Id': ctx?.userId ?? '',
        };
    }

    useEffect(() => {
        const base = getSignApiBase();
        fetch(`${base}/v1/sign/templates`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.data ?? []);
                setTemplates(list);
                if (list.length) setTemplateId(list[0].id);
                setPhase('idle');
            })
            .catch(e => { setPhase('error'); setError(e.message); });
    }, []);

    const valid = templateId && signerName.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail.trim());

    async function handleSend() {
        if (!valid) return;
        setPhase('sending');
        setError(null);
        const base = getSignApiBase();
        try {
            const expires_at = expiresInDays
                ? new Date(Date.now() + parseInt(expiresInDays) * 86400000).toISOString()
                : undefined;
            const r = await fetch(`${base}/v1/sign/requests`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    template_id: templateId,
                    routing,
                    signers: [{ role_name: 'Signer', name: signerName.trim(), email: signerEmail.trim() }],
                    expires_at,
                    source_res_model: sourceModel,
                    source_res_id: sourceId,
                }),
            });
            if (!r.ok) { const t = await r.text(); throw new Error(t.slice(0, 200)); }
            setPhase('done');
            setTimeout(onClose, 800);
        } catch (e: any) {
            setPhase('error');
            setError(e.message ?? 'Send failed');
        }
    }

    const busy = phase === 'loading' || phase === 'sending';

    return (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="bg-white rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                <header className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-blue-600" />
                        <h2 className="text-base font-semibold text-gray-900">Request Signature</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-700">
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="px-5 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                        <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                            disabled={busy || templates.length === 0}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                            {phase === 'loading' && <option>Loading…</option>}
                            {phase !== 'loading' && templates.length === 0 && <option>No templates available</option>}
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Signer name</label>
                        <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
                            disabled={busy} placeholder="Full name"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Signer email</label>
                        <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
                            disabled={busy} placeholder="email@example.com"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expires in</label>
                        <select value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)}
                            disabled={busy} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                            <option value="3">3 days</option>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                            <option value="">No expiry</option>
                        </select>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                        </div>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t">
                    <button type="button" onClick={onClose} disabled={busy}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                    <button type="button" onClick={handleSend} disabled={busy || !valid}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md px-4 py-2 text-sm font-medium">
                        {phase === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {phase === 'done' ? 'Sent ✓' : phase === 'sending' ? 'Sending…' : 'Send for signature'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SignRequestModal;
