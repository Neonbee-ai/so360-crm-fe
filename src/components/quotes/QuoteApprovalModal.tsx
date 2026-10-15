import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, User as UserIcon, Loader2, Send, AlertCircle, Check } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { Quote } from '../../types/crm';
import { Button, IconButton, TextField, Textarea } from '@so360/design-system';
import { Modal } from '../common/Modal';

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
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      dismissible={!isSubmitting}
      data-testid="quote-approval-modal"
      title={
        <span className="flex items-center gap-2">
          <Send className="w-5 h-5 text-warning" />
          Submit Quote for Approval
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSend}
            disabled={isSubmitting || selectedApprovers.length === 0}
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
          </Button>
        </>
      }
    >
        <div className="space-y-5">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/40 rounded-lg flex items-center gap-2.5 text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quote summary card */}
          <div className="bg-surface-sunken border border-line rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-subtle">Quote:</span>
              <span className="font-semibold text-fg">
                {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-subtle">Customer:</span>
              <span className="font-medium text-fg truncate max-w-64">
                {quote.customer_name || quote.deal?.company_name || 'Customer'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-subtle">Amount:</span>
              <span className="font-bold text-warning">{currencyFormatter(quoteTotal)}</span>
            </div>
          </div>

          {/* Approver Selection */}
          <div className="space-y-2" ref={dropdownRef}>
            <label className="block text-sm font-medium text-fg-subtle">
              Select people who need to approve <span className="text-danger">*</span>
            </label>
            <p className="text-xs text-fg-subtle">
              Approvers come from the People Connect employee directory. All selected people must approve.
            </p>

            {/* Selected Chips */}
            {selectedApprovers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {selectedApprovers.map((approver) => (
                  <span
                    key={approver.user_id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-warning/20 text-warning border border-warning/30 rounded-full text-xs font-medium"
                  >
                    <UserIcon className="w-3 h-3" />
                    <span>{approver.full_name}</span>
                    <IconButton
                      label={`Remove ${approver.full_name}`}
                      icon={<X className="w-3 h-3" />}
                      size="sm"
                      onClick={() => handleRemove(approver.user_id)}
                    />
                  </span>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <TextField
                name="approver-search"
                aria-label="Search approvers"
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Search by name, email, department or role..."
                leadingIcon={Search}
              />
            </div>

            {/* Candidate Dropdown */}
            {dropdownOpen && (
              <div className="bg-bg border border-line rounded-lg shadow-xl max-h-52 overflow-y-auto z-menu mt-1 divide-y divide-line">
                {isLoading ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-fg-subtle text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-warning" />
                    <span>Loading people directory...</span>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-fg-muted text-sm">
                    {searchTerm ? 'No matching people found' : 'No available approvers'}
                  </div>
                ) : (
                  filteredCandidates.map((cand) => {
                    const isSelf = currentUserId && cand.user_id === currentUserId;
                    return (
                      <button
                        key={cand.user_id}
                        type="button"
                        onClick={() => {
                          handleSelect(cand);
                          if (!isSelf) setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelf
                            ? 'opacity-60 bg-surface-sunken cursor-pointer'
                            : 'hover:bg-surface-high cursor-pointer'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-surface-raised border border-line flex items-center justify-center text-fg-subtle font-semibold text-xs flex-shrink-0">
                          {cand.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-fg truncate">
                              {cand.full_name}
                            </p>
                            {isSelf && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-fg-subtle border border-line">
                                You (Cannot approve)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-fg-subtle truncate">
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
          <Textarea
            name="approval-notes"
            label="Optional Note for Approvers"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Add context or justification for this approval (e.g. Special commercial discount approved by VP Sales)..."
            rows={3}
          />
        </div>
    </Modal>
  );
};
