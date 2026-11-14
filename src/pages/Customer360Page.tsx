import React from 'react';
import { useParams } from 'react-router-dom';
import { Customer360Panels } from '../components/customer/Customer360Panels';

/**
 * Standalone 360 route — kept as a deep link / bookmarkable view.
 * The same panels render inside the customer record's Overview tab, which is
 * where people actually look; this page is the shareable equivalent.
 */
export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Customer360Panels customerId={id} />
    </div>
  );
}
