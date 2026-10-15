import React, { useEffect, useState } from 'react';
import { Select } from '@so360/design-system';
import { crmService } from '../services/crmService';

interface MarketingStorePickerProps {
  storeId: string;
  onChange: (value: string) => void;
  className?: string;
  onStoresLoaded?: (count: number) => void;
}

export const MarketingStorePicker: React.FC<MarketingStorePickerProps> = ({ storeId, onChange, className, onStoresLoaded }) => {
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
        onStoresLoaded?.((data || []).length);
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
      <Select
        name="marketing-store"
        aria-label="Store"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => applyValue(e.target.value)}
        disabled={loading || stores.length === 0}
        options={
          loading
            ? [{ value: '', label: 'Loading stores...' }]
            : stores.length === 0
              ? [{ value: '', label: 'No stores found' }]
              : stores.map((store) => ({
                  value: store.id,
                  label: `${store.name}${store.store_code ? ` (${store.store_code})` : ''}${store.status ? ` - ${store.status}` : ''}`,
                }))
        }
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
};
