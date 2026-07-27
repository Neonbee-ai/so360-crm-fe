import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../../types/crm';

interface Props {
    query: string;
    people: User[];
    onPick: (id: string, displayName: string) => void;
    onClose: () => void;
}

/**
 * @mention autocomplete for note replies — adapted from so360-chat's
 * MentionPicker.tsx, simplified to query CRM's own already-loaded people
 * cache (LeadDetailPage's `allUsers`) instead of a debounced tenant-wide
 * search endpoint, since that list is already fetched for the page.
 */
const NoteMentionPicker: React.FC<Props> = ({ query, people, onPick, onClose }) => {
    const [highlight, setHighlight] = useState(0);

    const candidates = useMemo(
        () => people.filter((p) => (p.full_name || p.email || '').toLowerCase().includes(query.toLowerCase())).slice(0, 8),
        [people, query],
    );

    useEffect(() => { setHighlight(0); }, [query]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, candidates.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && candidates[highlight]) {
                e.preventDefault();
                onPick(candidates[highlight].id, candidates[highlight].full_name || candidates[highlight].email);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [candidates, highlight, onPick, onClose]);

    if (candidates.length === 0) return null;

    return (
        <div role="listbox" className="absolute bottom-full mb-2 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
            {candidates.map((p, i) => (
                <button
                    key={p.id}
                    role="option"
                    aria-selected={i === highlight}
                    onClick={() => onPick(p.id, p.full_name || p.email)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                        i === highlight ? 'bg-blue-500/15 text-blue-200' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{p.full_name || p.email}</span>
                </button>
            ))}
        </div>
    );
};

export default NoteMentionPicker;
