import React, { useState, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { User } from '../../types/crm';
import NoteMentionPicker from './NoteMentionPicker';

interface Props {
    people: User[];
    onSubmit: (content: string) => Promise<void>;
    placeholder?: string;
}

/**
 * Plain-text reply composer (Task 3) — a reply is inherently a short
 * comment, so retrofitting the Tiptap-based NoteEditor (shared with
 * top-level notes) with a mention Node/Suggestion extension would be a much
 * larger, riskier change. Mention insertion mirrors so360-chat's
 * MessageComposer convention exactly (string replace on the trailing
 * @query, tokens stored as @[Name](person_id)).
 */
const NoteReplyComposer: React.FC<Props> = ({ people, onSubmit, placeholder }) => {
    const [text, setText] = useState('');
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = (value: string) => {
        setText(value);
        const match = /@([a-zA-Z0-9_-]*)$/.exec(value);
        setMentionQuery(match ? match[1] : null);
    };

    const handlePickMention = (personId: string, displayName: string) => {
        setText((cur) => cur.replace(/@([a-zA-Z0-9_-]*)$/, `@[${displayName}](${personId}) `));
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    const handleSubmit = async () => {
        if (!text.trim() || submitting) return;
        setSubmitting(true);
        try {
            // Wrap in a <p> so it renders consistently with rich-text top-level
            // notes via the shared NoteContent component (which expects HTML).
            // Only &/</> need escaping — mention tokens use [](){} which HTML
            // doesn't treat specially, so they pass through untouched.
            const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            await onSubmit(`<p>${escaped}</p>`);
            setText('');
            setMentionQuery(null);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative">
            {mentionQuery !== null && (
                <NoteMentionPicker query={mentionQuery} people={people} onPick={handlePickMention} onClose={() => setMentionQuery(null)} />
            )}
            <div className="flex items-center gap-2">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => handleChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder={placeholder || 'Reply… use @ to mention someone'}
                    rows={1}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none"
                />
                <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || submitting}
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
                >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
        </div>
    );
};

export default NoteReplyComposer;
