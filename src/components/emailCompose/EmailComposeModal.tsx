import React, { useEffect, useState } from 'react';
import { Loader2, Send, Eye, AlertCircle } from 'lucide-react';
import { toast, Modal, Button, Select, TextField, Textarea } from '@so360/design-system';
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

    return (
        <Modal
            open
            onClose={onClose}
            title="Compose email"
            size="lg"
            footer={(
                <>
                    <Button variant="secondary" onClick={doPreview} disabled={!canSubmit || busy !== null}>
                        {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
                    </Button>
                    <Button variant="primary" onClick={doSend} disabled={!canSubmit || busy !== null}>
                        {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
                    </Button>
                </>
            )}
        >
            <div className="flex flex-col gap-nb-3">
                <Select
                    name="compose-template"
                    label="Template"
                    aria-label="Template"
                    value={templateId}
                    disabled={loadingTemplates}
                    onChange={(e) => onTemplate(e.target.value)}
                    options={[
                        { value: '', label: loadingTemplates ? 'Loading templates…' : 'No template (write your own)' },
                        ...templates.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                />
                <TextField
                    name="compose-to"
                    label="To"
                    aria-label="To"
                    type="email"
                    hint="Optional — defaults to the record email"
                    value={toEmail}
                    onChange={(e) => { setToEmail(e.target.value); setPreview(null); }}
                />
                <TextField
                    name="compose-subject"
                    label="Subject"
                    aria-label="Subject"
                    maxLength={500}
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setPreview(null); }}
                />
                <Textarea
                    name="compose-body"
                    label="Body"
                    aria-label="Body"
                    rows={8}
                    hint={templateId ? '(leave empty to use the template body)' : undefined}
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setPreview(null); }}
                />

                <p className="text-xs text-fg-muted" data-testid="merge-field-hint">
                    Merge fields: {MERGE_FIELDS.map((f) => `{{${f}}}`).join(' ')}
                </p>

                {preview && (
                    <div className="border border-line rounded-xl p-3 flex flex-col gap-nb-2" data-testid="email-preview">
                        <p className="text-xs text-fg-muted">To: <span className="text-fg">{preview.to_email || '—'}</span></p>
                        <p className="text-sm font-semibold text-fg">{preview.subject}</p>
                        {preview.missing_fields.length > 0 && (
                            <p className="text-xs text-warning flex items-center gap-1" role="alert">
                                <AlertCircle size={12} /> No value for: {preview.missing_fields.join(', ')}
                            </p>
                        )}
                        <iframe title="Email preview" sandbox="" srcDoc={preview.body_html} className="w-full h-64 bg-white rounded-lg" />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default EmailComposeModal;
