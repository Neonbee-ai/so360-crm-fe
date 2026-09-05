import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, User as UserIcon, Loader2, Send, AlertCircle, Check } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { Quote } from '../../types/crm';

export interface ApproverCandidate {
  person_id?: string;
  user_id: string;
  full_name: string;
  email?: string | null;
  job_title?: string | null;
  department_name?: string | null;
  avatar_url?: string | null;
}

export interface QuoteApprovalModalProps {
  quote: Quote;
  currentUserId?: string;
  currencyFormatter?: (amount: number) => string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (approverUserIds: string[], notes?: string) => Promise<void>;
}

export const QuoteApprovalModal: React.FC<QuoteApprovalModalProps> = ({
  quote,
  currentUserId,
  currencyFormatter = (val) => String(val),
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [candidates, setCandidates] = useState<ApproverCandidate[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<ApproverCandidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedApprovers([]);
      setSearchTerm('');
      setNotes('');
      setError(null);
      setDropdownOpen(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    crmService
      .getApprovers()
      .then((data) => {
        if (isMounted) {
          setCandidates(data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load approvers', err);
          setError('Failed to load approvers directory');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return candidates.filter((cand) => {
      // Exclude already selected
      if (selectedApprovers.some((s) => s.user_id === cand.user_id)) {
        return false;
      }
      if (!term) return true;
      return (
        cand.full_name?.toLowerCase().includes(term) ||
        cand.email?.toLowerCase().includes(term) ||
        cand.job_title?.toLowerCase().includes(term) ||
        cand.department_name?.toLowerCase().includes(term)
      );
    });
  }, [candidates, selectedApprovers, searchTerm]);

  const handleSelect = (candidate: ApproverCandidate) => {
    // Prevent self-approval (Section 21)
    if (currentUserId && candidate.user_id === currentUserId) {
      setError('Self-approval is not permitted: you cannot select yourself to approve your quote.');
      return;
    }
    setError(null);
    setSelectedApprovers((prev) => [...prev, candidate]);
    setSearchTerm('');
  };

  const handleRemove = (userId: string) => {
    setSelectedApprovers((prev) => prev.filter((s) => s.user_id !== userId));
  };

  const handleSend = async () => {
    if (selectedApprovers.length === 0) {
      setError('Please select at least one person who needs to approve.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const ids = selectedApprovers.map((a) => a.user_id);
      await onSubmit(ids, notes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit quote for approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const quoteTotal = Number(quote.total_amount || quote.grand_total || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">Submit Quote for Approval</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg flex items-center gap-2.5 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quote summary card */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Quote:</span>
              <span className="font-semibold text-slate-200">
                {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Customer:</span>
              <span className="font-medium text-slate-200 truncate max-w-[260px]">
                {quote.customer_name || quote.deal?.company_name || 'Customer'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Amount:</span>
              <span className="font-bold text-amber-400">{currencyFormatter(quoteTotal)}</span>
            </div>
          </div>

          {/* Approver Selection */}
          <div className="space-y-2" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-300">
              Select people who need to approve <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-slate-400">
              Approvers come from the People Connect employee directory. All selected people must approve.
            </p>

            {/* Selected Chips */}
            {selectedApprovers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {selectedApprovers.map((approver) => (
                  <span
                    key={approver.user_id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-medium"
                  >
                    <UserIcon className="w-3 h-3" />
                    <span>{approver.full_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(approver.user_id)}
                      className="hover:text-red-300 hover:bg-amber-500/30 rounded-full p-0.5 transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Search by name, email, role or department..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            {/* Candidate Dropdown */}
            {dropdownOpen && (
              <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto z-20 mt-1 divide-y divide-slate-800">
                {isLoading ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading people directory...</span>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    {searchTerm ? 'No matching people found' : 'No available approvers'}
                  </div>
                ) : (
                  filteredCandidates.map((cand) => {
                    const isSelf = currentUserId && cand.user_id === currentUserId;
                    return (
                      <button
                        key={cand.user_id}
                        type="button"
                        disabled={Boolean(isSelf)}
                        onClick={() => {
                          handleSelect(cand);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelf
                            ? 'opacity-40 cursor-not-allowed bg-slate-900/50'
                            : 'hover:bg-slate-800/80 cursor-pointer'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs flex-shrink-0">
                          {cand.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {cand.full_name}
                            </p>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                You (Cannot approve)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {cand.job_title || cand.department_name || cand.email || ''}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Submission Note */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">
              Optional Note for Approvers
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Special commercial discount approved by VP Sales..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-900/80 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitting || selectedApprovers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send for Approval</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
