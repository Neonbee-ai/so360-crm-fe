import React from 'react';
import { X, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { LayoutSectionPref } from '../../hooks/useLeadDetailLayoutPreferences';

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
    sections: LayoutSectionPref[];
    onToggleVisible: (key: string) => void;
    onMove: (key: string, direction: 'up' | 'down') => void;
    onReset: () => void;
    onClose: () => void;
}

const LeadLayoutSettingsPanel: React.FC<Props> = ({ sections, onToggleVisible, onMove, onReset, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                    <p className="text-xs font-black text-slate-50 uppercase tracking-widest">Layout Settings</p>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-3 space-y-1 max-h-96 overflow-y-auto">
                    {sections.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900">
                            <div className="flex flex-col">
                                <button onClick={() => onMove(s.key, 'up')} disabled={i === 0} className="text-slate-500 hover:text-slate-200 disabled:opacity-20">
                                    <ChevronUp size={12} />
                                </button>
                                <button onClick={() => onMove(s.key, 'down')} disabled={i === sections.length - 1} className="text-slate-500 hover:text-slate-200 disabled:opacity-20">
                                    <ChevronDown size={12} />
                                </button>
                            </div>
                            <span className={`flex-1 text-xs ${s.visible ? 'text-slate-200' : 'text-slate-600'}`}>
                                {SECTION_LABELS[s.key] || s.key}
                            </span>
                            <button onClick={() => onToggleVisible(s.key)} className="text-slate-500 hover:text-blue-400">
                                {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-4 border-t border-slate-800">
                    <button
                        onClick={onReset}
                        className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 py-2"
                    >
                        <RotateCcw size={12} /> Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadLayoutSettingsPanel;
