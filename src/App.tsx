import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { CombScope, FeatureRoute, PortalProvider, Button } from '@so360/design-system';
import { CrossLinkProvider } from '@so360/cross-link';
import { crmService } from './services/crmService';
import { salesTargetService } from './services/salesTargetService';
import { CrmScope, crmPortalRoot } from './utils/crmScope';

// Synchronizes Shell Context with CRM Service
const CrmShellInitializer = ({ children }: { children: React.ReactNode }) => {
    // Access context directly to avoid throwing if provider is missing
    const shell = useShellBridge();
    const [isSynced, setIsSynced] = React.useState(false);

    useEffect(() => {
        if (shell?.currentTenant?.id && shell?.currentOrg?.id && shell?.accessToken) {
            console.log('CRM MFE: Syncing context from shell:', {
                tenant: shell.currentTenant.id,
                org: shell.currentOrg.id
            });

            crmService.setTenantId(shell.currentTenant.id);
            crmService.setOrgId(shell.currentOrg.id);

            crmService.setAccessToken(shell.accessToken);

            if (shell.user) {
                crmService.setUser({
                    id: shell.user.id,
                    email: shell.user.email,
                    full_name: shell.user.full_name || 'Unknown User',
                    avatar_url: shell.user.avatar_url
                });
            }

            salesTargetService.setTenantId(shell.currentTenant.id);
            salesTargetService.setOrgId(shell.currentOrg.id);
            salesTargetService.setAccessToken(shell.accessToken);

            setIsSynced(true);
        }
    }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken, shell?.user]);

    if (!isSynced) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-fg-subtle gap-4">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-medium animate-pulse">Connecting to shell context...</p>
            </div>
        );
    }

    return <>{children}</>;
};

// Mounts the cross-link resolver/navigation once per MFE. Wires the Core aggregator
// (via crmService), shell module-enablement gating, and SPA navigation (shared shell
// router) so every CrossLinkChip / RelatedRecordsPanel below uses one cache + fetch path.
const CrossLinkBridge = ({ children }: { children: React.ReactNode }) => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    return (
        <CrossLinkProvider
            resolve={crmService.resolveLinks}
            navigate={(path) => navigate(path)}
            isModuleEnabled={(moduleId) => (shell?.isModuleEnabled ? shell.isModuleEnabled(moduleId) : true)}
        >
            {children}
        </CrossLinkProvider>
    );
};

// Route-level upgrade prompt shown when a feature is `locked` (a higher plan unlocks it).
const UpgradeLocked = () => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-6">
            <div>
                <h2 className="text-lg font-semibold text-fg">This feature is part of a higher plan</h2>
                <p className="text-sm text-fg-subtle mt-1">Upgrade your plan to unlock it.</p>
            </div>
            <Button type="button" onClick={() => navigate('/org/billing')}>
                Upgrade plan
            </Button>
        </div>
    );
};

// Route-level panel shown when a feature is `disabled` (admin turned it off — no upgrade path).
const FeatureUnavailable = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 text-center px-6">
        <h2 className="text-lg font-semibold text-fg">Feature unavailable</h2>
        <p className="text-sm text-fg-subtle">This feature has been turned off for your organization.</p>
    </div>
);

// Guards a route on the resolved 5-state model via the shared FeatureRoute:
// enabled→render · read_only→inert · locked→upgrade prompt · disabled→unavailable · hidden→redirect.
const FlagGuard = ({ flagKey, children }: { flagKey: string; children: React.ReactNode }) => {
    const shell = useShellBridge();
    if (!shell) return null;
    const state = shell.getFeatureState ? shell.getFeatureState(flagKey) : 'enabled';
    return (
        <FeatureRoute
            state={state}
            hiddenFallback={<Navigate to="/crm/dashboard" replace />}
            lockedFallback={<UpgradeLocked />}
            disabledFallback={<FeatureUnavailable />}
        >
            {children}
        </FeatureRoute>
    );
};

// Guards a route on the signed-in user's ROLE PERMISSIONS — the page-level
// counterpart to FlagGuard. A plan flag answers "is this feature in the plan";
// this answers "may this user open it". Both must pass, so the two compose
// rather than replace one another.
//
// Fail-closed: while entitlements resolve (or with no bridge at all) the page is
// withheld rather than flashed. Denial renders an explanatory notice instead of
// a blank screen so "not allowed" is distinguishable from "broken". Codes are
// wildcard-aware via the shell bridge, matching the backend resolver exactly.
const PermissionGuard = ({ permission, children }: { permission: string | string[]; children: React.ReactNode }) => {
    const shell = useShellBridge();
    if (!shell || !shell.permissionsLoaded) return null;
    const codes = Array.isArray(permission) ? permission : [permission];
    const allowed = shell.hasAnyPermission
        ? shell.hasAnyPermission(...codes)
        : codes.some((c: string) => shell.hasPermission?.(c) ?? false);
    if (allowed) return <>{children}</>;
    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-fg">You don&apos;t have access to this page</h2>
            <p className="mt-2 max-w-md text-sm text-fg-muted">
                Your role doesn&apos;t include permission for this page. Ask an administrator if you need it.
            </p>
        </div>
    );
};

// Lazy load pages for performance
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const DealDetailPage = lazy(() => import('./pages/DealDetailPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage'));
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const QuoteDetailPage = lazy(() => import('./pages/QuoteDetailPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const IcpListPage = lazy(() => import('./pages/IcpListPage'));
const IcpFormPage = lazy(() => import('./pages/IcpFormPage'));
const SettingsRoute = () => {
    const navigate = useNavigate();
    return <SettingsPage onOpenIcps={() => navigate('/crm/settings/icps')} />;
};
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetailPage'));
// Kept from the original Sales Target Engine: this is the only UI that can
// create or edit the activity types Target Plans and Target Templates read.
const AdminTaskTypesPage = lazy(() => import('./pages/sales-targets/AdminTaskTypesPage'));
const TargetsOverviewPage = lazy(() => import('./pages/targets/TargetsOverviewPage'));
const MyTargetsPage = lazy(() => import('./pages/targets/MyTargetsPage'));
const TeamTargetsPage = lazy(() => import('./pages/targets/TeamTargetsPage'));
const TargetPlansPage = lazy(() => import('./pages/targets/TargetPlansPage'));
const PerformanceHistoryPage = lazy(() => import('./pages/targets/PerformanceHistoryPage'));
const TouchpointChannelsPage = lazy(() => import('./pages/targets/TouchpointChannelsPage'));
const MeasurementPage = lazy(() => import('./pages/targets/MeasurementPage'));
const SalesReviewsPage = lazy(() => import('./pages/targets/SalesReviewsPage'));
const CompensationPage = lazy(() => import('./pages/targets/CompensationPage'));
const TargetTemplatesPage = lazy(() => import('./pages/targets/TargetTemplatesPage'));
// RE Phase C — sales register (§27) + commission report (§28)
const SalesPage = lazy(() => import('./pages/SalesPage'));
const CommissionReportPage = lazy(() => import('./pages/CommissionReportPage'));
// RE Phase F — sales reports (§30)
const SalesAnalyticsPage = lazy(() => import('./pages/SalesAnalyticsPage'));

const Layout = ({ children }: { children: React.ReactNode }) => {
    const navigate = useNavigate();
    return (
        <CrmScope>
            <CombScope module="crm" root={{ label: 'CRM', to: '/crm/dashboard' }} navigate={(to) => navigate(to)}>
            {/* DS overlays (Modal/Drawer/Toast/dialogs) portal into the scoped root so they get CRM's utilities */}
            <PortalProvider container={crmPortalRoot()}>
                <div className="min-h-full bg-bg text-fg">
                    <main className="w-full">
                        <Suspense fallback={<div className="p-8 text-fg-subtle">Loading module...</div>}>
                            {children}
                        </Suspense>
                    </main>
                </div>
            </PortalProvider>
            </CombScope>
        </CrmScope>
    );
};

const App = () => {
    return (
        <Layout>
            <CrmShellInitializer>
                <CrossLinkBridge>
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<PermissionGuard permission='crm.dashboard.view'><DashboardPage /></PermissionGuard>} />
                    <Route path="leads" element={<PermissionGuard permission='leads.read'><FlagGuard flagKey="submodule:crm:leads"><LeadsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="leads/:id" element={<PermissionGuard permission='leads.read'><FlagGuard flagKey="submodule:crm:leads"><LeadDetailPage /></FlagGuard></PermissionGuard>} />
                    <Route path="partners" element={<PermissionGuard permission={['companies.read', 'partners.manage']}><FlagGuard flagKey="submodule:crm:partners"><PartnersPage /></FlagGuard></PermissionGuard>} />
                    <Route path="partners/:id" element={<PermissionGuard permission={['companies.read', 'partners.manage']}><FlagGuard flagKey="submodule:crm:partners"><PartnerDetailPage /></FlagGuard></PermissionGuard>} />
                    <Route path="customers" element={<PermissionGuard permission={['companies.read', 'contacts.read']}><CustomersPage /></PermissionGuard>} />
                    <Route path="customers/:id" element={<PermissionGuard permission={['companies.read', 'contacts.read']}><LeadDetailPage /></PermissionGuard>} />
                    <Route path="pipeline" element={<PermissionGuard permission='deals.read'><FlagGuard flagKey="submodule:crm:pipeline"><PipelinePage /></FlagGuard></PermissionGuard>} />
                    <Route path="deal/:id" element={<PermissionGuard permission='deals.read'><FlagGuard flagKey="submodule:crm:pipeline"><DealDetailPage /></FlagGuard></PermissionGuard>} />
                    <Route path="tasks" element={<PermissionGuard permission='crm_tasks.read'><FlagGuard flagKey="submodule:crm:tasks"><TasksPage /></FlagGuard></PermissionGuard>} />
                    <Route path="tasks/:id" element={<PermissionGuard permission='crm_tasks.read'><FlagGuard flagKey="submodule:crm:tasks"><TaskDetailPage /></FlagGuard></PermissionGuard>} />
                    <Route path="quotes" element={<PermissionGuard permission='quotes.read'><FlagGuard flagKey="submodule:crm:quotes"><QuotesPage /></FlagGuard></PermissionGuard>} />
                    <Route path="quotes/:id" element={<PermissionGuard permission='quotes.read'><FlagGuard flagKey="submodule:crm:quotes"><QuoteDetailPage /></FlagGuard></PermissionGuard>} />
                    <Route path="settings" element={<PermissionGuard permission='crm_settings.read'><SettingsRoute /></PermissionGuard>} />
                    <Route path="settings/icps" element={<PermissionGuard permission='linkedin_sync.read'><FlagGuard flagKey="submodule:crm:icp_manager"><IcpListPage /></FlagGuard></PermissionGuard>} />
                    <Route path="settings/icps/new" element={<PermissionGuard permission='linkedin_sync.create'><FlagGuard flagKey="submodule:crm:icp_manager"><IcpFormPage /></FlagGuard></PermissionGuard>} />
                    <Route path="settings/icps/:id" element={<PermissionGuard permission='linkedin_sync.update'><FlagGuard flagKey="submodule:crm:icp_manager"><IcpFormPage /></FlagGuard></PermissionGuard>} />
                    <Route path="sales" element={<PermissionGuard permission='deals.read'><FlagGuard flagKey="submodule:crm:commissions"><SalesPage /></FlagGuard></PermissionGuard>} />
                    <Route path="reports/commission" element={<PermissionGuard permission='deals.read'><FlagGuard flagKey="submodule:crm:commissions"><CommissionReportPage /></FlagGuard></PermissionGuard>} />
                    <Route path="reports/sales" element={<PermissionGuard permission='deals.read'><FlagGuard flagKey="submodule:crm:re_reports"><SalesAnalyticsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="sales-targets/task-types" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:sales_targets"><AdminTaskTypesPage /></FlagGuard></PermissionGuard>} />
                    {/* Retired pages. This router has no catch-all, so a stale
                        bookmark would render a blank pane rather than 404 —
                        send each to the screen that replaced it instead. */}
                    <Route path="sales-targets/targets" element={<Navigate to="/crm/targets/plans" replace />} />
                    <Route path="sales-targets/scorecard" element={<Navigate to="/crm/targets/mine" replace />} />
                    <Route path="sales-targets/leaderboard" element={<Navigate to="/crm/targets" replace />} />
                    <Route path="targets" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><TargetsOverviewPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/mine" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><MyTargetsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/team" element={<PermissionGuard permission='sales_targets.view_team'><FlagGuard flagKey="submodule:crm:targets_performance"><TeamTargetsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/plans" element={<PermissionGuard permission={['sales_targets.create','sales_targets.update','sales_targets.delete','sales_targets.assign']}><FlagGuard flagKey="action:crm:targets:manage"><TargetPlansPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/history" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><PerformanceHistoryPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/channels" element={<PermissionGuard permission={['sales_targets.create','sales_targets.update','sales_targets.delete']}><FlagGuard flagKey="action:crm:targets:configure_metrics"><TouchpointChannelsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/measurement" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><MeasurementPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/reviews" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:sales_reviews"><SalesReviewsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/templates" element={<PermissionGuard permission={['sales_targets.create','sales_targets.assign']}><FlagGuard flagKey="action:crm:targets:manage"><TargetTemplatesPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/compensation" element={<PermissionGuard permission={['sales_targets.create','sales_targets.view_team']}><FlagGuard flagKey="action:crm:targets:compensation"><CompensationPage /></FlagGuard></PermissionGuard>} />
                </Routes>
                </CrossLinkBridge>
            </CrmShellInitializer>
        </Layout>
    );
};

export default App;
