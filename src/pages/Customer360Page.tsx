import React from 'react';
import { useParams } from 'react-router-dom';
import { DetailPageTemplate } from '@so360/design-system';
import { Customer360Panels } from '../components/customer/Customer360Panels';
import { PanelBoundary } from '../components/common/PanelBoundary';

/**
 * Standalone 360 route — kept as a deep link / bookmarkable view.
 * The same panels render inside the customer record's Overview tab, which is
 * where people actually look; this page is the shareable equivalent.
 */
export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <DetailPageTemplate trail={[{ label: 'Customers', to: '/crm/customers' }]} title="Customer 360">
      <PanelBoundary name="customer-360">
        <Customer360Panels customerId={id} />
      </PanelBoundary>
    </DetailPageTemplate>
  );
}
