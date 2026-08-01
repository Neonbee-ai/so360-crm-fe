/**
 * NoteContent.tsx — renders a note's stored HTML with its original
 * formatting intact. The backend already sanitizes on write; this
 * sanitizes again on render (defense in depth) since notes may predate
 * that guarantee or arrive via any other write path.
 *
 * @[Name](person_id) mention tokens (Task 3, ported from so360-chat's
 * convention) are rendered as chips — converted to a styled <span> BEFORE
 * DOMPurify sanitization since NoteContent renders via
 * dangerouslySetInnerHTML, not React children.
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-person-id'];

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMentionChips(html: string): string {
  if (!html.includes('@[')) return html;
  return html.replace(MENTION_RE, (_match, name: string, personId: string) =>
    `<span class="mention-chip" data-person-id="${escapeHtml(personId)}">@${escapeHtml(name)}</span>`,
  );
}

export default function NoteContent({ html }: { html: string }) {
  const withMentionChips = renderMentionChips(html);
  const clean = DOMPurify.sanitize(withMentionChips, { ALLOWED_TAGS, ALLOWED_ATTR });
  return (
    <div
      className="text-slate-300 leading-relaxed text-sm [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-400 [&_a]:underline [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-slate-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_.mention-chip]:inline-block [&_.mention-chip]:px-1 [&_.mention-chip]:rounded [&_.mention-chip]:bg-blue-500/15 [&_.mention-chip]:text-blue-300 [&_.mention-chip]:font-semibold"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
