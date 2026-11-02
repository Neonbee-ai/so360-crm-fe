import React from 'react';
import { ChevronUp, ChevronDown, Eye, RefreshCw } from 'lucide-react';
import { Button, IconButton } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';

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
        <Modal
            isOpen
            onClose={onClose}
            size="sm"
            title={title}
            bodyPadding={false}
            data-testid="lead-layout-settings"
            footer={
                <Button type="button" variant="secondary" onClick={onReset}>
                    <RefreshCw size={12} /> Reset to Default
                </Button>
            }
        >
                <div className="p-3 space-y-1 max-h-96 overflow-y-auto">
                    {sections.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2 px-2 py-2 rounded-nb hover:bg-surface">
                            <div className="flex flex-col">
                                <IconButton label={`Move ${labels[s.key] || s.key} up`} icon={<ChevronUp size={12} />} onClick={() => onMove(s.key, 'up')} disabled={i === 0} />
                                <IconButton label={`Move ${labels[s.key] || s.key} down`} icon={<ChevronDown size={12} />} onClick={() => onMove(s.key, 'down')} disabled={i === sections.length - 1} />
                            </div>
                            <span className={`flex-1 text-xs ${s.visible ? 'text-fg' : 'text-fg-muted'}`}>
                                {labels[s.key] || s.key}
                            </span>
                            <IconButton label={`${s.visible ? 'Hide' : 'Show'} ${labels[s.key] || s.key}`} icon={<Eye size={14} />} onClick={() => onToggleVisible(s.key)} aria-pressed={s.visible} />
                        </div>
                    ))}
                </div>
        </Modal>
    );
};

export default LeadLayoutSettingsPanel;
