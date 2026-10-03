import React, { useEffect, useState } from 'react';
import { X, Loader2, Send, Eye, AlertCircle } from 'lucide-react';
import { toast } from '@so360/design-system';
import {
    emailComposeService, MERGE_FIELDS,
    type ComposeEntityType, type ComposePreview, type ComposeTemplate,
} from '../../services/emailComposeService';

export interface EmailComposeModalProps {
    entityType: ComposeEntityType;
    entityId: string;
    onClose: () => void;
    onSent?: () => void;
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * RE G9 — compose a tracked email from a CRM record. Templates come from
 * Inbox (via crm-be); merge fields are rendered server-side so the preview
 * matches what is sent. The preview renders in a sandboxed iframe (no
 * scripts, no same-origin) so authored HTML can never run in the shell.
 */
export const EmailComposeModal: React.FC<EmailComposeModalProps> = ({ entityType, entityId, onClose, onSent }) => {
    const [templates, setTemplates] = useState<ComposeTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [templateId, setTemplateId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [toEmail, setToEmail] = useState('');
    const [preview, setPreview] = useState<ComposePreview | null>(null);
    const [busy, setBusy] = useState<'preview' | 'send' | null>(null);

    useEffect(() => {
        let alive = true;
        emailComposeService.listTemplates()
            .then((t) => { if (alive) setTemplates(t); })
            .catch(() => { if (alive) setTemplates([]); })
            .finally(() => { if (alive) setLoadingTemplates(false); });
        return () => { alive = false; };
    }, []);

    const input = () => ({ template_id: templateId, subject, body_html: body, to_email: toEmail });
    const canSubmit = !!templateId || (!!subject.trim() && !!body.trim());

    const onTemplate = (id: string) => {
        setTemplateId(id);
        setPreview(null);
        const t = templates.find((x) => x.id === id);
        if (t && !subject.trim()) setSubject(t.subject);
    };

    const doPreview = async () => {
        setBusy('preview');
        try {
            setPreview(await emailComposeService.preview(entityType, entityId, input()));
        } catch (e) {
            toast.error(errMsg(e, 'Could not render the preview'));
        } finally {
            setBusy(null);
        }
    };

    const doSend = async () => {
        setBusy('send');
        try {
            const r = await emailComposeService.send(entityType, entityId, input());
            if (!r.success) {
                toast.error('Email was not sent');
                return;
            }
            toast.success('Email sent');
            onSent?.();
            onClose();
        } catch (e) {
            toast.error(errMsg(e, 'Email could not be sent'));
        } finally {
            setBusy(null);
        }
    };

    const field = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Compose email">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Compose email</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white p-1">
                        <X size={18} />
                    </button>
                </div>

                <label className="block text-xs text-slate-400 space-y-1">
                    <span>Template</span>
                    <select aria-label="Template" className={field} value={templateId} disabled={loadingTemplates} onChange={(e) => onTemplate(e.target.value)}>
                        <option value="">{loadingTemplates ? 'Loading templates…' : 'No template (write your own)'}</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </label>

                <label className="block text-xs text-slate-400 space-y-1">
                    <span>To (optional — defaults to the record email)</span>
                    <input aria-label="To" type="email" className={field} value={toEmail} onChange={(e) => { setToEmail(e.target.value); setPreview(null); }} />
                </label>

                <label className="block text-xs text-slate-400 space-y-1">
                    <span>Subject</span>
                    <input aria-label="Subject" className={field} value={subject} maxLength={500} onChange={(e) => { setSubject(e.target.value); setPreview(null); }} />
                </label>

                <label className="block text-xs text-slate-400 space-y-1">
                    <span>Body{templateId ? ' (leave empty to use the template body)' : ''}</span>
                    <textarea aria-label="Body" rows={8} className={field} value={body} onChange={(e) => { setBody(e.target.value); setPreview(null); }} />
                </label>

                <p className="text-[11px] text-slate-500" data-testid="merge-field-hint">
                    Merge fields: {MERGE_FIELDS.map((f) => `{{${f}}}`).join(' ')}
                </p>

                {preview && (
                    <div className="border border-slate-700 rounded-xl p-3 space-y-2" data-testid="email-preview">
                        <p className="text-xs text-slate-400">To: <span className="text-slate-200">{preview.to_email || '—'}</span></p>
                        <p className="text-sm font-semibold text-white">{preview.subject}</p>
                        {preview.missing_fields.length > 0 && (
                            <p className="text-xs text-amber-400 flex items-center gap-1" role="alert">
                                <AlertCircle size={12} /> No value for: {preview.missing_fields.join(', ')}
                            </p>
                        )}
                        <iframe title="Email preview" sandbox="" srcDoc={preview.body_html} className="w-full h-64 bg-white rounded-lg" />
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={doPreview} disabled={!canSubmit || busy !== null}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50">
                        {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
                    </button>
                    <button type="button" onClick={doSend} disabled={!canSubmit || busy !== null}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
                        {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailComposeModal;
