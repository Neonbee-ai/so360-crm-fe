import React, { useEffect, useMemo, useState } from 'react';
import { GitMerge, Search, X, Loader2 } from 'lucide-react';
import { toast } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import {
    leadDedupService,
    MERGE_FIELDS,
    defaultFieldChoices,
    displayFieldValue,
    leadDisplayName,
    type FieldChoices,
} from '../../services/leadDedupService';
import { describeApiError } from '../../utils/apiErrorMessage';
import type { Lead } from '../../types/crm';

interface Props {
    /** The lead being viewed — it is the one kept after the merge. */
    keepLead: Lead;
    onClose: () => void;
    /** Called with the absorbed lead's id once the server confirms the merge. */
    onMerged: (mergedId: string) => void;
}

/**
 * A6 — merge another lead into the one being viewed.
 * Side panel (not a stacked modal): pick the other lead, choose per field
 * which value survives (defaults to the kept lead), Merge. ≤3 taps.
 */
export const MergeLeadPanel: React.FC<Props> = ({ keepLead, onClose, onMerged }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Lead[]>([]);
    const [searching, setSearching] = useState(false);
    const [other, setOther] = useState<Lead | null>(null);
    const [choices, setChoices] = useState<FieldChoices>(() => defaultFieldChoices(keepLead.id));
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2 || other) {
            setResults([]);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const found = await crmService.getLeads({ q, take: 10 });
                if (!cancelled) setResults((found || []).filter(l => l && l.id !== keepLead.id));
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query, other, keepLead.id]);

    const pick = (lead: Lead) => {
        setOther(lead);
        setChoices(defaultFieldChoices(keepLead.id));
    };

    const differing = useMemo(
        () => (other ? MERGE_FIELDS.filter(f => displayFieldValue(keepLead, f.key) !== displayFieldValue(other, f.key)) : []),
        [keepLead, other],
    );

    const handleMerge = async () => {
        if (!other) return;
        setMerging(true);
        try {
            await leadDedupService.mergeLeads(keepLead.id, other.id, choices);
            toast.success(`Merged "${leadDisplayName(other)}" into this lead.`);
            onMerged(other.id);
        } catch (err) {
            toast.error(describeApiError(err, "We couldn't merge these leads. Please try again."));
        } finally {
            setMerging(false);
        }
    };

    return (
        <aside
            className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col"
            aria-label="Merge leads"
            data-testid="merge-lead-panel"
        >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <GitMerge size={16} /> Merge another lead into this one
                </h2>
                <button type="button" onClick={onClose} aria-label="Close merge panel" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {!other ? (
                    <div className="space-y-2">
                        <label htmlFor="merge-lead-search" className="text-xs font-medium text-slate-400">
                            Find the duplicate lead
                        </label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                id="merge-lead-search"
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by name, email or phone"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                        {searching && <p className="text-xs text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Searching…</p>}
                        {!searching && query.trim().length >= 2 && results.length === 0 && (
                            <p className="text-xs text-slate-500">No other leads match.</p>
                        )}
                        <ul className="divide-y divide-slate-800" role="listbox" aria-label="Matching leads">
                            {results.map(l => (
                                <li key={l.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={false}
                                        onClick={() => pick(l)}
                                        className="w-full text-left px-2 py-2 hover:bg-slate-800 rounded-lg"
                                    >
                                        <span className="block text-sm text-slate-200">{leadDisplayName(l)}</span>
                                        <span className="block text-xs text-slate-500">{l.contact_email || l.phone || ''}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>
                                Merging <strong className="text-slate-200">{leadDisplayName(other)}</strong> into this lead. It will be removed afterwards.
                            </span>
                            <button type="button" onClick={() => setOther(null)} className="text-blue-400 hover:underline shrink-0 ml-2">
                                Change
                            </button>
                        </div>
                        <table className="w-full text-sm" data-testid="merge-field-chooser">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                                    <th className="text-left py-1 font-bold">Field</th>
                                    <th className="text-left py-1 font-bold">This lead</th>
                                    <th className="text-left py-1 font-bold">Other lead</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MERGE_FIELDS.map(f => {
                                    const same = !differing.includes(f);
                                    return (
                                        <tr key={f.key} className="border-t border-slate-800">
                                            <td className="py-2 pr-2 text-slate-400">{f.label}</td>
                                            {[keepLead, other].map((src, i) => (
                                                <td key={src.id} className="py-2 pr-2">
                                                    <label className={`flex items-center gap-2 ${same ? 'text-slate-500' : 'text-slate-200'}`}>
                                                        <input
                                                            type="radio"
                                                            name={`merge-${f.key}`}
                                                            aria-label={`${f.label} from ${i === 0 ? 'this lead' : 'other lead'}`}
                                                            checked={choices[f.key] === src.id}
                                                            disabled={same}
                                                            onChange={() => setChoices(prev => ({ ...prev, [f.key]: src.id }))}
                                                        />
                                                        <span className="truncate">{displayFieldValue(src, f.key)}</span>
                                                    </label>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleMerge}
                    disabled={!other || merging}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                >
                    {merging && <Loader2 size={14} className="animate-spin" />}
                    Merge
                </button>
            </div>
        </aside>
    );
};

export default MergeLeadPanel;
