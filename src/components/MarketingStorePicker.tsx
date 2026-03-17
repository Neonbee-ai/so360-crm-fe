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
    <div className={className || 'mb-4'}>
      <label className="block text-sm text-slate-400 mb-1">Store</label>
      <select
        value={value}
        onChange={(e) => applyValue(e.target.value)}
        className="w-full md:max-w-[460px] bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
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
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
};
