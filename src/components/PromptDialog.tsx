import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Textarea, TextField } from '@so360/design-system';

export interface PromptField {
  name: string;
  label: string;
  initialValue?: string;
  multiline?: boolean;
  required?: boolean;
}

export interface PromptDialogProps {
  open: boolean;
  title: string;
  fields: PromptField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
}

/** Replacement for window.prompt: a DS Modal with one or more text fields. */
export const PromptDialog = ({ open, title, fields, submitLabel = 'Save', onSubmit, onClose }: PromptDialogProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map((f) => [f.name, f.initialValue ?? ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const missing = fields.some((f) => f.required && !(values[f.name] ?? '').trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || missing) return;
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" name={title} formId="prompt-dialog-form" submitLabel={submitLabel} submitLoading={busy} submitDisabled={missing}>
      <form id="prompt-dialog-form" onSubmit={handleSubmit} className="flex flex-col gap-nb-3">
        {fields.map((f) =>
          f.multiline ? (
            <Textarea key={f.name} name={f.name} label={f.label} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
          ) : (
            <TextField key={f.name} name={f.name} label={f.label} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
          ),
        )}
      </form>
    </Modal>
  );
};
