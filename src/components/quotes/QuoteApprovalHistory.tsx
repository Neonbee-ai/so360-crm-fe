import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            Withdrawn
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
    }
  };

  const totalCycles = history.length;

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-100">Approval History & Audit Trail</h2>
        </div>
        <span className="text-xs text-slate-400">
          {totalCycles} {totalCycles === 1 ? 'Cycle' : 'Cycles'}
        </span>
      </div>

      <div className="space-y-3">
        {history.map((cycle, index) => {
          const cycleNumber = totalCycles - index;
          const isExpanded = !!expandedCycles[cycle.id];
          const isCurrent = cycle.id === currentRequestId || index === 0;
          const approvers = cycle.approvers || [];
          const approvedCount = approvers.filter((a) => a.status === 'approved').length;
          const totalApprovers = approvers.length;

          return (
            <div
              key={cycle.id}
              className={`border rounded-lg transition-all ${
                isCurrent
                  ? 'border-blue-500/40 bg-slate-800/40'
                  : 'border-slate-800 bg-slate-900/40'
              }`}
            >
              {/* Header / Click to expand */}
              <div
                onClick={() => toggleCycle(cycle.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/60 select-none transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">
                        Cycle {cycleNumber}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Current
                        </span>
                      )}
                      {getStatusBadge(cycle.status)}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">
                      Requested {cycle.requested_at ? formatDate(cycle.requested_at) : formatDate(cycle.created_at || '')}
                      {cycle.total_amount_snapshot != null && (
                        <span> • Value: {formatCurrency(cycle.total_amount_snapshot)}</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {approvedCount}/{totalApprovers} approved
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Collapsible details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-3">
                  {cycle.notes && (
                    <div className="bg-slate-800/50 rounded p-3 text-xs text-slate-300 border border-slate-700/50">
                      <span className="font-semibold text-slate-400 block mb-1">Submission Notes:</span>
                      {cycle.notes}
                    </div>
                  )}

                  {/* Approvers progress */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Required Approvers
                    </span>
                    <div className="divide-y divide-slate-800/60 rounded-lg border border-slate-800/80 bg-slate-900/60 overflow-hidden">
                      {approvers.map((approver, aIdx) => (
                        <div
                          key={approver.id || `${approver.approver_user_id}-${aIdx}`}
                          className="p-3 flex items-start justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-200">
                                {approver.approver_name || 'Approver'}
                              </div>
                              {approver.approver_email && (
                                <div className="text-xs text-slate-400">
                                  {approver.approver_email}
                                </div>
                              )}
                              {approver.notes && (
                                <div className="mt-1 text-xs text-slate-300 bg-slate-800/60 p-1.5 rounded border border-slate-700/40">
                                  <span className="font-medium text-slate-400">Comment: </span>
                                  {approver.notes}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(approver.status)}
                            {approver.decision_at && (
                              <span className="text-[11px] text-slate-500">
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
    </div>
  );
};
