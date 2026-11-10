import React, { useEffect, useState } from 'react';
import { Button, EmptyState } from '@so360/design-system';
import { FileText } from 'lucide-react';
import { Modal } from './common/Modal';
import { useShellBridge } from '@so360/shell-context';
import { QUOTE_DOC_TYPE } from '../services/coreS2sService';

/**
 * Shell's shared document renderer: returns exactly what shell.printDocument prints
 * (the org's saved Core Sales Quote template + letterhead + product images).
 * Typed locally so the MFE builds against a shell-context without the method yet.
 */
type RenderDocument = (templateKey: string, data: Record<string, unknown>) => Promise<string>;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Document payload (same shape the shell print uses). */
    document: Record<string, unknown>;
}

/** Quote preview rendered by the Shell with the org's Core Sales Quote template (same as print), in a sandboxed iframe. */
// An iframe has no intrinsic height, so the preview frame needs an explicit viewport-relative one.
const PREVIEW_FRAME_CLASS = 'w-full h-[70vh] border border-line rounded-nb-md bg-surface'; // comb-exception: iframe has no intrinsic height

export const QuotePreviewModal = ({ isOpen, onClose, document }: Props) => {
    const [html, setHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const shell = useShellBridge() as { renderDocument?: RenderDocument } | null;

    useEffect(() => {
        if (!isOpen) return;
        let live = true;
        setLoading(true);
        setHtml(null);
        // No separate CRM layout: without the Shell renderer the preview is unavailable, never a different template.
        const render = shell?.renderDocument;
        const pending = render ? render(QUOTE_DOC_TYPE, document) : Promise.resolve(null);
        pending
            .catch(() => null)
            .then(h => { if (live) { setHtml(h || null); setLoading(false); } });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Quote preview"
            size="4xl"
            footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
        >
            {loading ? (
                <p className="text-sm text-fg-muted">Rendering…</p>
            ) : html ? (
                <iframe title="Quote preview" sandbox="" srcDoc={html} className={PREVIEW_FRAME_CLASS} />
            ) : (
                <EmptyState icon={FileText} title="Preview unavailable" />
            )}
        </Modal>
    );
};
