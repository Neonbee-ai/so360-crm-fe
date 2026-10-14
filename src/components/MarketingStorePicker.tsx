import React, { useEffect, useState } from 'react';
import { crmService } from '../services/crmService';

interface MarketingStorePickerProps {
  storeId: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MarketingStorePicker: React.FC<MarketingStorePickerProps> = ({ storeId, onChange, className }) => {
  const [value, setValue] = useState<string>(storeId);
  const [stores, setStores] = useState<Array<{ id: string; name: string; store_code?: string; status?: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(storeId);
  }, [storeId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await crmService.getDailystoreStores();
        if (!mounted) return;
        setStores(data || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load stores');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storeId && stores.length > 0) {
      onChange(stores[0].id);
    }
  }, [storeId, stores, onChange]);

  const applyValue = (nextValue: string) => {
    setValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className={className || 'w-64 max-w-full'}>
      <label className="sr-only">Store</label>
      <select
        value={value}
        onChange={(e) => applyValue(e.target.value)}
        className="w-full h-nb-control-md bg-surface border border-line rounded-nb px-3 text-sm text-fg"
        disabled={loading || stores.length === 0}
      >
        {loading && <option value="">Loading stores...</option>}
        {!loading && stores.length === 0 && <option value="">No stores found</option>}
        {!loading &&
          stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
              {store.store_code ? ` (${store.store_code})` : ''}
              {store.status ? ` - ${store.status}` : ''}
            </option>
          ))}
      </select>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
};
