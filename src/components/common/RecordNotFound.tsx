import { SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@so360/design-system';

/** True when a failed fetch means "no such record for this org" (404/403), not an outage. */
export const isNotFoundError = (err: unknown): boolean => {
  const s = (err as { status?: number; statusCode?: number } | null | undefined);
  const code = s?.status ?? s?.statusCode;
  return code === 404 || code === 403;
};

/** Explicit not-found state for detail pages opened with a missing or foreign-org id. */
export const RecordNotFound = ({ listPath, listLabel }: { listPath: string; listLabel: string }) => {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={SearchX}
      title="Record not found"
      description="This record doesn't exist or you don't have access to it."
      action={{ label: `Back to ${listLabel}`, onClick: () => navigate(listPath) }}
    />
  );
};
