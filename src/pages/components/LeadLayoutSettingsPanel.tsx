import React from 'react';
import { X, ChevronUp, ChevronDown, Eye, RefreshCw } from 'lucide-react';

const SECTION_LABELS: Record<string, string> = {
    activity: 'Activity / Timeline',
    notes: 'Notes',
    tasks: 'Tasks',
    documents: 'Documents',
    products: 'Products',
    feedback: 'Feedback',
    calls: 'Calls',
    audit: 'Audit History',
    stakeholders: 'Stakeholders',
    emails: 'Emails',
    meetings: 'Meetings',
};

interface Props {
    sections: Array<{ key: string; visible: boolean }>;
    onToggleVisible: (key: string) => void;
    onMove: (key: string, direction: 'up' | 'down') => void;
    onReset: () => void;
    onClose: () => void;
    /** Row labels by key; defaults to the lead-detail section names. */
    labels?: Record<string, string>;
    /** Panel title; defaults to "Layout Settings". */
    title?: string;
}

const LeadLayoutSettingsPanel: React.FC<Props> = ({ sections, onToggleVisible, onMove, onReset, onClose, labels = SECTION_LABELS, title = 'Layout Settings' }) => {
    return (
        <div className="fixed inset-0 z-dialog flex items-center justify-center p-4 bg-overlay backdrop-blur-sm" onClick={onClose}>
            <div role="dialog" aria-label={title} className="bg-bg border border-line rounded-nb-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                    <p className="text-xs font-medium text-fg">{title}</p>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 text-fg-muted hover:text-fg rounded-nb hover:bg-surface-raised"><X size={16} /></button>
                </div>
                <div className="p-3 space-y-1 max-h-96 overflow-y-auto">
                    {sections.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2 px-2 py-2 rounded-nb hover:bg-surface">
                            <div className="flex flex-col">
                                <button onClick={() => onMove(s.key, 'up')} aria-label={`Move ${labels[s.key] || s.key} up`} disabled={i === 0} className="text-fg-muted hover:text-fg disabled:opacity-20">
                                    <ChevronUp size={12} />
                                </button>
                                <button onClick={() => onMove(s.key, 'down')} aria-label={`Move ${labels[s.key] || s.key} down`} disabled={i === sections.length - 1} className="text-fg-muted hover:text-fg disabled:opacity-20">
                                    <ChevronDown size={12} />
                                </button>
                            </div>
                            <span className={`flex-1 text-xs ${s.visible ? 'text-fg' : 'text-fg-muted'}`}>
                                {labels[s.key] || s.key}
                            </span>
                            <button onClick={() => onToggleVisible(s.key)} aria-label={`${s.visible ? 'Hide' : 'Show'} ${labels[s.key] || s.key}`} aria-pressed={s.visible} className={s.visible ? 'text-primary' : 'text-fg-muted'}>
                                <Eye size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-4 border-t border-line">
                    <button
                        onClick={onReset}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-fg-subtle hover:text-fg py-2"
                    >
                        <RefreshCw size={12} /> Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadLayoutSettingsPanel;
