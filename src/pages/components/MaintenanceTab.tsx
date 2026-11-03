import React, { useCallback, useEffect, useState } from 'react';
import { Button, DataTable, EmptyState, Skeleton } from '@so360/design-system';
import {
    PRIORITY_LABEL,
    maintenanceTabService,
    type MaintenancePlanRow,
    type MaintenanceRequestRow,
} from '../../services/maintenanceTabService';
import { describeApiError } from '../../utils/apiErrorMessage';

interface Props {
    customerPartnerId?: string | null;
    dealId?: string | null;
}

const PLAN_COLUMNS = [
    { key: 'name', header: 'Plan', render: (r: MaintenancePlanRow) => r.name ?? '—' },
    { key: 'active', header: 'Status', render: (r: MaintenancePlanRow) => (r.active === false ? 'Paused' : 'Active') },
    { key: 'interval', header: 'Interval', render: (r: MaintenancePlanRow) => (r.interval_value && r.interval_unit ? `Every ${r.interval_value} ${r.interval_unit}` : '—') },
    { key: 'next_due_at', header: 'Next due', render: (r: MaintenancePlanRow) => r.next_due_at ? r.next_due_at.slice(0, 10) : '—' },
];

const REQUEST_COLUMNS = [
    { key: 'number', header: 'Request', render: (r: MaintenanceRequestRow) => r.number ?? r.id },
    { key: 'title', header: 'Title', render: (r: MaintenanceRequestRow) => r.title ?? '—' },
    { key: 'stage', header: 'Stage', render: (r: MaintenanceRequestRow) => r.stage?.name ?? '—' },
    { key: 'priority', header: 'Priority', render: (r: MaintenanceRequestRow) => (r.priority == null ? '—' : PRIORITY_LABEL[r.priority] ?? String(r.priority)) },
    { key: 'scheduled_start', header: 'Scheduled', render: (r: MaintenanceRequestRow) => r.scheduled_start ? r.scheduled_start.slice(0, 10) : '—' },
];

/**
 * Customer / Deal → Maintenance (`submodule:crm:maintenance-tab`). Lists the
 * maintenance plans and open requests linked to the customer or deal, read
 * from the Maintenance backend filtered by customer_partner_id / deal_id.
 */
const MaintenanceTab: React.FC<Props> = ({ customerPartnerId, dealId }) => {
    const hasScope = Boolean(customerPartnerId || dealId);
    const [plans, setPlans] = useState<MaintenancePlanRow[]>([]);
    const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
    const [loading, setLoading] = useState(hasScope);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!hasScope) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const scope = { customerPartnerId, dealId };
            const [p, r] = await Promise.all([
                maintenanceTabService.listPlans(scope),
                maintenanceTabService.listOpenRequests(scope),
            ]);
            setPlans(p);
            setRequests(r);
        } catch (e) {
            setError(describeApiError(e, 'Could not load maintenance data.'));
        } finally {
            setLoading(false);
        }
    }, [hasScope, customerPartnerId, dealId]);

    useEffect(() => { void load(); }, [load]);

    if (!hasScope) {
        return (
            <EmptyState
                title="No linked customer"
                description="Link this record to a customer to see its maintenance plans and requests."
            />
        );
    }
    if (loading) {
        return (
            <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading maintenance…</span></div>
        );
    }
    if (error) {
        return (
            <div className="p-nb-6 space-y-nb-3">
                <p role="alert" className="text-sm text-danger">{error}</p>
                <Button variant="secondary" size="sm" type="button" onClick={() => void load()}>Retry</Button>
            </div>
        );
    }
    if (plans.length === 0 && requests.length === 0) {
        return (
            <EmptyState
                title="No maintenance yet"
                description="No maintenance plans or open requests are linked here."
            />
        );
    }
    return (
        <div className="space-y-nb-6">
            <section aria-label="Maintenance plans" className="space-y-nb-2">
                <h3 className="text-sm font-semibold text-fg">Plans ({plans.length})</h3>
                <DataTable
                    data-testid="maintenance-plans"
                    columns={PLAN_COLUMNS}
                    rows={plans}
                    rowKey={(r: MaintenancePlanRow) => r.id}
                    emptyState={<EmptyState title="No plans" description="No maintenance plans linked." />}
                />
            </section>
            <section aria-label="Open maintenance requests" className="space-y-nb-2">
                <h3 className="text-sm font-semibold text-fg">Open requests ({requests.length})</h3>
                <DataTable
                    data-testid="maintenance-requests"
                    columns={REQUEST_COLUMNS}
                    rows={requests}
                    rowKey={(r: MaintenanceRequestRow) => r.id}
                    emptyState={<EmptyState title="No open requests" description="No open maintenance requests." />}
                />
            </section>
        </div>
    );
};

export default MaintenanceTab;
