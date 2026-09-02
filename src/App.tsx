import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { FeatureRoute } from '@so360/design-system';
import { CrossLinkProvider } from '@so360/cross-link';
import { crmService } from './services/crmService';
import { salesTargetService } from './services/salesTargetService';

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
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-4">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
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
                <h2 className="text-lg font-semibold text-slate-100">This feature is part of a higher plan</h2>
                <p className="text-sm text-slate-400 mt-1">Upgrade your plan to unlock it.</p>
            </div>
            <button
                type="button"
                onClick={() => navigate('/org/billing')}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
                Upgrade plan
            </button>
        </div>
    );
};

// Route-level panel shown when a feature is `disabled` (admin turned it off — no upgrade path).
const FeatureUnavailable = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 text-center px-6">
        <h2 className="text-lg font-semibold text-slate-100">Feature unavailable</h2>
        <p className="text-sm text-slate-400">This feature has been turned off for your organization.</p>
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
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">You don&apos;t have access to this page</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                Your role doesn&apos;t include permission for this page. Ask an administrator if you need it.
            </p>
        </div>
    );
};

// Guards a route behind a module enablement check — redirects to dashboard when disabled
const ModuleGuard = ({ moduleId, children }: { moduleId: string; children: React.ReactNode }) => {
    const shell = useShellBridge();
    const navigate = useNavigate();
    const enabled = shell?.isModuleEnabled ? shell.isModuleEnabled(moduleId) : true;
    useEffect(() => {
        if (shell && !enabled) navigate('/crm/dashboard', { replace: true });
    }, [enabled, shell, navigate]);
    if (!shell || !enabled) return null;
    return <>{children}</>;
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
const MarketingOverviewPage = lazy(() => import('./pages/MarketingOverviewPage'));
const MarketingAbandonedCartsPage = lazy(() => import('./pages/MarketingAbandonedCartsPage'));
const MarketingCampaignsPage = lazy(() => import('./pages/MarketingCampaignsPage'));
const MarketingSegmentsPage = lazy(() => import('./pages/MarketingSegmentsPage'));
const MarketingCampaignDetailPage = lazy(() => import('./pages/MarketingCampaignDetailPage'));
const MarketingAbandonedCartDetailPage = lazy(() => import('./pages/MarketingAbandonedCartDetailPage'));
const MarketingNewsletterPage = lazy(() => import('./pages/MarketingNewsletterPage'));
const MarketingCouponsPage = lazy(() => import('./pages/MarketingCouponsPage'));
const MarketingReviewsPage = lazy(() => import('./pages/MarketingReviewsPage'));
const MarketingWishlistPage = lazy(() => import('./pages/MarketingWishlistPage'));
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

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-full bg-slate-950 text-slate-100">
            <main className="w-full">
                <Suspense fallback={<div className="p-8 text-slate-400">Loading module...</div>}>
                    {children}
                </Suspense>
            </main>
        </div>
    );
};

const App = () => {
    return (
        <Layout>
            <CrmShellInitializer>
                <CrossLinkBridge>
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
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
                    <Route path="settings" element={<PermissionGuard permission='crm_settings.read'><SettingsPage /></PermissionGuard>} />
                    <Route path="sales-targets/task-types" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:sales_targets"><AdminTaskTypesPage /></FlagGuard></PermissionGuard>} />
                    {/* Retired pages. This router has no catch-all, so a stale
                        bookmark would render a blank pane rather than 404 —
                        send each to the screen that replaced it instead. */}
                    <Route path="sales-targets/targets" element={<Navigate to="/crm/targets/plans" replace />} />
                    <Route path="sales-targets/scorecard" element={<Navigate to="/crm/targets/mine" replace />} />
                    <Route path="sales-targets/leaderboard" element={<Navigate to="/crm/targets" replace />} />
                    <Route path="targets" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><TargetsOverviewPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/mine" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><MyTargetsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/team" element={<PermissionGuard permission='sales_targets.manage'><FlagGuard flagKey="submodule:crm:targets_performance"><TeamTargetsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/plans" element={<PermissionGuard permission='sales_targets.manage'><FlagGuard flagKey="action:crm:targets:manage"><TargetPlansPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/history" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><PerformanceHistoryPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/channels" element={<PermissionGuard permission='sales_targets.manage'><FlagGuard flagKey="action:crm:targets:configure_metrics"><TouchpointChannelsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/measurement" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:targets_performance"><MeasurementPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/reviews" element={<PermissionGuard permission='sales_targets.read'><FlagGuard flagKey="submodule:crm:sales_reviews"><SalesReviewsPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/templates" element={<PermissionGuard permission='sales_targets.manage'><FlagGuard flagKey="action:crm:targets:manage"><TargetTemplatesPage /></FlagGuard></PermissionGuard>} />
                    <Route path="targets/compensation" element={<PermissionGuard permission='sales_targets.manage'><FlagGuard flagKey="action:crm:targets:compensation"><CompensationPage /></FlagGuard></PermissionGuard>} />
                    <Route path="marketing/overview" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingOverviewPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/abandoned-carts" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingAbandonedCartsPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/abandoned-carts/:cartId" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingAbandonedCartDetailPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/campaigns" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingCampaignsPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/campaigns/:campaignId" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingCampaignDetailPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/segments" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingSegmentsPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/newsletter" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingNewsletterPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/coupons" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingCouponsPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/reviews" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingReviewsPage /></ModuleGuard></PermissionGuard>} />
                    <Route path="marketing/wishlist" element={<PermissionGuard permission='marketing.read'><ModuleGuard moduleId="dailystore"><MarketingWishlistPage /></ModuleGuard></PermissionGuard>} />
                </Routes>
                </CrossLinkBridge>
            </CrmShellInitializer>
        </Layout>
    );
};

export default App;
