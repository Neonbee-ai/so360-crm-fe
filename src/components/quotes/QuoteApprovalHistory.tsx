import React, { useState } from 'react';
import { Card, Badge } from '@so360/design-system';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  User,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export interface ApproverRecord {
  id?: string;
  approver_user_id: string;
  approver_person_id?: string | null;
  approver_name?: string | null;
  approver_email?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decision_at?: string | null;
  notes?: string | null;
}

export interface ApprovalRequestRecord {
  id: string;
  quote_id: string;
  requested_by?: string;
  requested_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decision_at?: string | null;
  total_amount_snapshot?: number | null;
  notes?: string | null;
  created_at?: string;
  approvers?: ApproverRecord[];
}

export interface QuoteApprovalHistoryProps {
  history: ApprovalRequestRecord[];
  currentRequestId?: string | null;
  formatDate?: (date: string) => string;
  formatCurrency?: (val: number) => string;
}

export const QuoteApprovalHistory: React.FC<QuoteApprovalHistoryProps> = ({
  history = [],
  currentRequestId,
  formatDate = (d) => new Date(d).toLocaleString(),
  formatCurrency = (v) => String(v),
}) => {
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (history.length > 0) {
      // First cycle (latest) is expanded by default
      initial[history[0].id] = true;
    }
    return initial;
  });

  if (!history || history.length === 0) {
    return null;
  }

  const toggleCycle = (id: string) => {
    setExpandedCycles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge size="sm" tone="success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge size="sm" tone="danger">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </Badge>
        );
      case 'withdrawn':
        return (
          <Badge size="sm" tone="neutral">
            <RotateCcw className="w-3.5 h-3.5" />
            Withdrawn
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge size="sm" tone="warning">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </Badge>
        );
    }
  };

  const totalCycles = history.length;

  return (
    <Card
      title="Approval History & Audit Trail"
      actions={
        <span className="text-xs text-fg-subtle">
          {totalCycles} {totalCycles === 1 ? 'Cycle' : 'Cycles'}
        </span>
      }
      padding="none"
    >
      <div className="divide-y divide-line">
        {history.map((cycle, index) => {
          const cycleNumber = totalCycles - index;
          const isExpanded = !!expandedCycles[cycle.id];
          const isCurrent = cycle.id === currentRequestId || index === 0;
          const approvers = cycle.approvers || [];
          const approvedCount = approvers.filter((a) => a.status === 'approved').length;
          const totalApprovers = approvers.length;

          return (
            <div key={cycle.id}>
              {/* Header / Click to expand */}
              <div
                onClick={() => toggleCycle(cycle.id)}
                className="flex items-center justify-between p-nb-3 cursor-pointer hover:bg-surface-raised select-none transition-colors"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-nb-2">
                    <span className="font-medium text-fg">Cycle {cycleNumber}</span>
                    {isCurrent && <Badge size="sm" tone="info">Current</Badge>}
                    {getStatusBadge(cycle.status)}
                  </div>
                  <span className="text-xs text-fg-subtle mt-0.5">
                    Requested {cycle.requested_at ? formatDate(cycle.requested_at) : formatDate(cycle.created_at || '')}
                    {cycle.total_amount_snapshot != null && (
                      <span> • Value: {formatCurrency(cycle.total_amount_snapshot)}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-nb-3">
                  <span className="text-xs text-fg-subtle">
                    {approvedCount}/{totalApprovers} approved
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-fg-subtle" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-fg-subtle" />
                  )}
                </div>
              </div>

              {/* Collapsible details */}
              {isExpanded && (
                <div className="px-nb-3 pb-nb-3 flex flex-col gap-nb-3">
                  {cycle.notes && (
                    <div className="text-xs text-fg-subtle">
                      <span className="font-medium text-fg-subtle block mb-1">Submission Notes:</span>
                      {cycle.notes}
                    </div>
                  )}

                  {/* Approvers progress */}
                  <div>
                    <span className="text-xs font-medium text-fg-muted block mb-1">
                      Required Approvers
                    </span>
                    <div className="divide-y divide-line">
                      {approvers.map((approver, aIdx) => (
                        <div
                          key={approver.id || `${approver.approver_user_id}-${aIdx}`}
                          className="py-nb-2 flex items-start justify-between gap-nb-3 text-sm"
                        >
                          <div className="flex items-center gap-nb-2">
                            <div className="w-7 h-7 rounded-full bg-surface-raised border border-line flex items-center justify-center text-fg-subtle text-xs">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-medium text-fg">
                                {approver.approver_name || 'Approver'}
                              </div>
                              {approver.approver_email && (
                                <div className="text-xs text-fg-subtle">
                                  {approver.approver_email}
                                </div>
                              )}
                              {approver.notes && (
                                <div className="mt-1 text-xs text-fg-subtle">
                                  <span className="font-medium text-fg-subtle">Comment: </span>
                                  {approver.notes}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(approver.status)}
                            {approver.decision_at && (
                              <span className="text-xs text-fg-muted">
                                {formatDate(approver.decision_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
