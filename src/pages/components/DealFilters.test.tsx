import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/crmService', () => ({
  crmService: { getUsers: vi.fn().mockResolvedValue([{ id: 'u1', full_name: 'Alice' }]) },
}));

import { useDealFilterConfig } from './DealFilters';

describe('Given useDealFilterConfig', () => {
  it('When owners load / Then owner options are populated and 3 quick fields exist', async () => {
    const { result } = renderHook(() => useDealFilterConfig({}, vi.fn()));
    await waitFor(() => expect(result.current.fields.find((f) => f.key === 'owner_id')?.options).toHaveLength(1));
    expect(result.current.fields.filter((f) => f.quick)).toHaveLength(3);
  });

  it('When a custom range is set / Then onChange maps it to start/end dates', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDealFilterConfig({}, onChange));
    result.current.onChange({ range: { start: '2026-01-01', end: '2026-01-31' } });
    expect(onChange).toHaveBeenCalledWith({ date_range: 'custom', start_date: '2026-01-01', end_date: '2026-01-31' });
  });

  it('When cleared / Then onChange receives an empty filter object', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDealFilterConfig({ owner_id: 'u1' }, onChange));
    result.current.onClear();
    expect(onChange).toHaveBeenCalledWith({});
  });
});
