import React, { useEffect, useState } from 'react';
import { Button, EmptyState } from '@so360/design-system';
import { FileText } from 'lucide-react';
import { Modal } from './common/Modal';
import { documentLayouts, QUOTE_DOC_TYPE } from '../services/coreS2sService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Document payload (same shape the shell print uses). */
    document: Record<string, unknown>;
}

/** Quote preview rendered by Core with the org default layout, in a sandboxed iframe. */
export const QuotePreviewModal = ({ isOpen, onClose, document }: Props) => {
    const [html, setHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let live = true;
        setLoading(true);
        setHtml(null);
        documentLayouts.render(QUOTE_DOC_TYPE, document).then(h => { if (live) { setHtml(h); setLoading(false); } });
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
                <iframe title="Quote preview" sandbox="" srcDoc={html} className="w-full h-[70vh] border border-line rounded-nb-md bg-surface" />
            ) : (
                <EmptyState icon={FileText} title="Preview unavailable" />
            )}
        </Modal>
    );
};
