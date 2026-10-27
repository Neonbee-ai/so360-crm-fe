import React, { useEffect, useState } from 'react';
import { Select } from '@so360/design-system';
import { priceLists, PriceListOption } from '../services/coreS2sService';

interface Props {
    value: string;
    onChange: (priceListId: string) => void;
    customerId?: string;
    disabled?: boolean;
}

/** Optional price-list picker; empty value means "automatic" (customer / segment / base price). */
export const PriceListSelect = ({ value, onChange, customerId, disabled }: Props) => {
    const [lists, setLists] = useState<PriceListOption[]>([]);
    useEffect(() => {
        let live = true;
        priceLists.list(customerId).then(l => { if (live) setLists(l); });
        return () => { live = false; };
    }, [customerId]);

    return (
        <Select
            name="price-list"
            aria-label="Price list"
            size="sm"
            value={value}
            disabled={disabled}
            options={[{ value: '', label: 'Automatic price list' }, ...lists.map(l => ({ value: l.id, label: l.name }))]}
            onChange={e => onChange(e.target.value)}
        />
    );
};
