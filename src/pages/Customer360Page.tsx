import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailPageTemplate } from '@so360/design-system';
import { Customer360Panels } from '../components/customer/Customer360Panels';
import { crmService } from '../services/crmService';
import { PanelBoundary } from '../components/common/PanelBoundary';

/**
 * Standalone 360 route — kept as a deep link / bookmarkable view.
 * The same panels render inside the customer record's Overview tab, which is
 * where people actually look; this page is the shareable equivalent.
 */
export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState('');
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    crmService.getLeadById(id)
      .then((c) => { if (alive && c) setName(c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact_name || ''); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [id]);
  if (!id) return null;
  return (
    <DetailPageTemplate trail={[{ label: 'Customers', to: '/crm/customers' }]} title={name || 'Customer'} description="Customer 360">
      <PanelBoundary name="customer-360">
        <Customer360Panels customerId={id} />
      </PanelBoundary>
    </DetailPageTemplate>
  );
}
