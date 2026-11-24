import React, { useMemo, useState } from 'react';
import { Button, RadioGroup, Select, TextField, Alert, Stack, Grid, GridItem } from '@so360/design-system';
import { Modal } from '../common/Modal';
import type { Quote, QuoteStatus } from '../../types/crm';
import {
  EMPTY_EXPORT_CRITERIA, filterQuotesForExport, hasAnyCriteria, validateExportCriteria,
  type QuoteExportCriteria,
} from './quoteExportFilter';

type Mode = 'all' | 'filtered';

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'converted', label: 'Converted' },
  { value: 'expired', label: 'Expired' },
];

interface Props {
  quotes: Quote[];
  customerName: (q: Quote) => string;
  onClose: () => void;
  /** Receives the rows to export; the page owns CSV building and download. */
  onExport: (rows: Quote[]) => void;
}

/**
 * Export options: everything, or a filtered subset. Filtering is applied to the
 * quotes already loaded for this user, so it can only narrow what they may see.
 */
export const QuoteExportDialog: React.FC<Props> = ({ quotes, customerName, onClose, onExport }) => {
  const [mode, setMode] = useState<Mode>('all');
  const [criteria, setCriteria] = useState<QuoteExportCriteria>(EMPTY_EXPORT_CRITERIA);
  const set = (patch: Partial<QuoteExportCriteria>) => setCriteria((c) => ({ ...c, ...patch }));

  const creators = useMemo(() => {
    const m = new Map<string, string>();
    for (const q of quotes) if (q.created_by?.id) m.set(q.created_by.id, q.created_by.full_name || q.created_by.email || q.created_by.id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [quotes]);

  const rangeError = mode === 'filtered' ? validateExportCriteria(criteria) : null;
  const rows = useMemo(
    () => (mode === 'all' ? quotes : filterQuotesForExport(quotes, criteria, customerName)),
    [mode, quotes, criteria, customerName],
  );
  const noCriteria = mode === 'filtered' && !hasAnyCriteria(criteria);
  const canExport = !rangeError && !noCriteria && rows.length > 0;

  return (
    <Modal
      isOpen
      size="md"
      title="Export quotes"
      data-testid="quote-export-dialog"
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" disabled={!canExport} onClick={() => onExport(rows)} data-testid="quote-export-confirm">
            Export {rows.length} {rows.length === 1 ? 'quote' : 'quotes'}
          </Button>
        </>
      )}
    >
      <Stack>
        <RadioGroup
          name="quote-export-mode"
          label="What to export"
          value={mode}
          onChange={(v: string) => setMode(v as Mode)}
          options={[
            { value: 'all', label: `Export all quotes (${quotes.length})` },
            { value: 'filtered', label: 'Export filtered quotes' },
          ]}
        />
        {mode === 'filtered' && (
          <Stack data-testid="quote-export-filters">
            <Grid gap="md">
              <GridItem span={6}>
                <TextField name="export-date-from" label="Created from" type="date" value={criteria.dateFrom}
                  onChange={(e: any) => set({ dateFrom: e.target.value })} />
              </GridItem>
              <GridItem span={6}>
                <TextField name="export-date-to" label="Created to" type="date" value={criteria.dateTo}
                  onChange={(e: any) => set({ dateTo: e.target.value })} />
              </GridItem>
            </Grid>
            <Select name="export-status" label="Status" value={criteria.status}
              onChange={(e: any) => set({ status: e.target.value })}
              options={[{ value: '', label: 'Any status' }, ...STATUS_OPTIONS]} />
            <TextField name="export-customer" label="Customer" value={criteria.customer}
              onChange={(e: any) => set({ customer: e.target.value })} placeholder="Part of the customer name" />
            <TextField name="export-number" label="Quote number" value={criteria.quoteNumber}
              onChange={(e: any) => set({ quoteNumber: e.target.value })} placeholder="e.g. Q-2026" />
            <Select name="export-created-by" label="Created by" value={criteria.createdBy}
              onChange={(e: any) => set({ createdBy: e.target.value })}
              options={[{ value: '', label: 'Anyone' }, ...creators.map(([id, label]) => ({ value: id, label }))]} />
          </Stack>
        )}
        {rangeError && <Alert variant="warning">{rangeError}</Alert>}
        {noCriteria && <Alert variant="info">Choose at least one filter, or switch to Export all.</Alert>}
        {mode === 'filtered' && !noCriteria && !rangeError && rows.length === 0 && (
          <Alert variant="info" data-testid="quote-export-empty">No quotes match these filters, so there is nothing to export.</Alert>
        )}
      </Stack>
    </Modal>
  );
};

export default QuoteExportDialog;
