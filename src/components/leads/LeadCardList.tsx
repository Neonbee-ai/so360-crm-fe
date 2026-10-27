/**
 * LeadCardList.tsx — mobile/narrow-viewport rendering for the leads grid.
 *
 * Below the `md` breakpoint the dense, horizontally-scrolling table is replaced
 * by a stack of tap-friendly cards. Selection and tap-to-open reuse the same
 * handlers as the desktop grid, so bulk actions and the detail panel keep
 * working identically on a phone.
 */
import { Check, Mail, Phone } from 'lucide-react';
import type { Lead } from '../../types/crm';
import { IconButton } from '@so360/design-system';

interface LeadCardListProps {
  leads: Lead[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRowClick: (lead: Lead) => void;
}

function contactName(lead: Lead): string {
  if (lead.first_name) return [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  return lead.contact_name ?? '';
}

function scoreTone(score: number): string {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-danger';
}

export default function LeadCardList({
  leads,
  selectedIds,
  onToggleSelect,
  onRowClick,
}: LeadCardListProps) {
  if (leads.length === 0) {
    return (
      <div
        data-testid="lead-card-list"
        className="rounded-xl border border-line bg-bg py-16 text-center text-sm text-fg-muted"
      >
        No leads found
      </div>
    );
  }

  return (
    <div data-testid="lead-card-list" className="space-y-2">
      {leads.map((lead) => {
        const isSelected = selectedIds.has(lead.id);
        const name = contactName(lead);
        const score = lead.auto_score ?? 0;
        return (
          <div
            key={lead.id}
            data-testid={`lead-card-${lead.id}`}
            onClick={() => onRowClick(lead)}
            className={`rounded-xl border p-3.5 transition-colors ${
              isSelected ? 'border-primary/50 bg-primary/10' : 'border-line bg-surface-sunken active:bg-surface-high'
            }`}
          >
            <div className="flex items-start gap-3">
              <IconButton label="Select lead" icon={<Check size={12} className={isSelected ? 'text-primary' : 'opacity-0'} />} onClick={(e) => { e.stopPropagation(); onToggleSelect(lead.id); }} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-fg truncate">{lead.company_name}</span>
                  {score > 0 && <span className={`text-xs font-bold shrink-0 ${scoreTone(score)}`}>{score}</span>}
                </div>
                {name && <p className="text-sm text-fg-subtle truncate">{name}</p>}

                <div className="flex items-center gap-3 mt-2">
                  {lead.contact_email && (
                    <a
                      href={`mailto:${lead.contact_email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-fg-subtle hover:text-primary truncate"
                    >
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{lead.contact_email}</span>
                    </a>
                  )}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-fg-subtle hover:text-success shrink-0"
                    >
                      <Phone size={12} />
                      Call
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-raised text-fg-subtle border border-line">
                    {lead.status}
                  </span>
                  {lead.source && <span className="text-xs text-fg-muted">{lead.source}</span>}
                  {lead.owner?.full_name && (
                    <span className="ml-auto text-xs text-fg-muted truncate">{lead.owner.full_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
