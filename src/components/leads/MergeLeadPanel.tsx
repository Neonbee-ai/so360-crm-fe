import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { toast, Button, Drawer, TextField, DataTable, RadioGroup } from '@so360/design-system';
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
        <Drawer
            isOpen
            onClose={onClose}
            title="Merge another lead into this one"
            size="md"
            data-testid="merge-lead-panel"
            footer={
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleMerge} disabled={!other || merging}>
                        {merging && <Loader2 size={14} className="animate-spin" />}
                        Merge
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {!other ? (
                    <div className="space-y-2">
                        <TextField
                            name="merge-lead-search"
                            id="merge-lead-search"
                            label="Find the duplicate lead"
                            type="text"
                            value={query}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                            placeholder="Search by name, email or phone"
                            leadingIcon={Search}
                            autoFocus
                        />
                        {searching && <p className="text-xs text-fg-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Searching…</p>}
                        {!searching && query.trim().length >= 2 && results.length === 0 && (
                            <p className="text-xs text-fg-muted">No other leads match.</p>
                        )}
                        <ul className="divide-y divide-line" role="listbox" aria-label="Matching leads">
                            {results.map(l => (
                                <li key={l.id}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={false}
                                        onClick={() => pick(l)}
                                        className="w-full text-left px-2 py-2 hover:bg-surface-raised rounded-lg"
                                    >
                                        <span className="block text-sm text-fg">{leadDisplayName(l)}</span>
                                        <span className="block text-xs text-fg-muted">{l.contact_email || l.phone || ''}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-fg-subtle">
                            <span>
                                Merging <strong className="text-fg">{leadDisplayName(other)}</strong> into this lead. It will be removed afterwards.
                            </span>
                            <button type="button" onClick={() => setOther(null)} className="text-primary hover:underline shrink-0 ml-2">
                                Change
                            </button>
                        </div>
                        <DataTable
                            name="merge-field-chooser"
                            data-testid="merge-field-chooser"
                            density="compact"
                            columns={[
                                {
                                    key: 'field',
                                    header: 'Field and value to keep',
                                    render: (f: (typeof MERGE_FIELDS)[number]) => {
                                        const same = !differing.includes(f);
                                        return (
                                            <RadioGroup
                                                name={`merge-${f.key}`}
                                                label={f.label}
                                                orientation="horizontal"
                                                disabled={same}
                                                value={choices[f.key] === other.id ? 'other' : 'this'}
                                                onChange={(v: string) => setChoices(prev => ({ ...prev, [f.key]: v === 'other' ? other.id : keepLead.id }))}
                                                options={[
                                                    { value: 'this', label: `This lead: ${displayFieldValue(keepLead, f.key) || '—'}` },
                                                    { value: 'other', label: `Other lead: ${displayFieldValue(other, f.key) || '—'}` },
                                                ]}
                                            />
                                        );
                                    },
                                },
                            ]}
                            rows={[...MERGE_FIELDS]}
                            rowKey={(f) => f.key}
                        />
                    </div>
                )}
            </div>
        </Drawer>
    );
};

export default MergeLeadPanel;
