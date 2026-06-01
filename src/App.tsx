import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { FeatureRoute } from '@so360/design-system';
import { CrossLinkProvider } from '@so360/cross-link';
import { crmService } from './services/crmService';

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
                    <Route path="leads" element={<FlagGuard flagKey="submodule:crm:leads"><LeadsPage /></FlagGuard>} />
                    <Route path="leads/:id" element={<FlagGuard flagKey="submodule:crm:leads"><LeadDetailPage /></FlagGuard>} />
                    <Route path="partners" element={<FlagGuard flagKey="submodule:crm:partners"><PartnersPage /></FlagGuard>} />
                    <Route path="partners/:id" element={<FlagGuard flagKey="submodule:crm:partners"><PartnerDetailPage /></FlagGuard>} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="customers/:id" element={<LeadDetailPage />} />
                    <Route path="pipeline" element={<FlagGuard flagKey="submodule:crm:pipeline"><PipelinePage /></FlagGuard>} />
                    <Route path="deal/:id" element={<FlagGuard flagKey="submodule:crm:pipeline"><DealDetailPage /></FlagGuard>} />
                    <Route path="tasks" element={<FlagGuard flagKey="submodule:crm:tasks"><TasksPage /></FlagGuard>} />
                    <Route path="tasks/:id" element={<FlagGuard flagKey="submodule:crm:tasks"><TaskDetailPage /></FlagGuard>} />
                    <Route path="quotes" element={<FlagGuard flagKey="submodule:crm:quotes"><QuotesPage /></FlagGuard>} />
                    <Route path="quotes/:id" element={<FlagGuard flagKey="submodule:crm:quotes"><QuoteDetailPage /></FlagGuard>} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="marketing/overview" element={<ModuleGuard moduleId="dailystore"><MarketingOverviewPage /></ModuleGuard>} />
                    <Route path="marketing/abandoned-carts" element={<ModuleGuard moduleId="dailystore"><MarketingAbandonedCartsPage /></ModuleGuard>} />
                    <Route path="marketing/abandoned-carts/:cartId" element={<ModuleGuard moduleId="dailystore"><MarketingAbandonedCartDetailPage /></ModuleGuard>} />
                    <Route path="marketing/campaigns" element={<ModuleGuard moduleId="dailystore"><MarketingCampaignsPage /></ModuleGuard>} />
                    <Route path="marketing/campaigns/:campaignId" element={<ModuleGuard moduleId="dailystore"><MarketingCampaignDetailPage /></ModuleGuard>} />
                    <Route path="marketing/segments" element={<ModuleGuard moduleId="dailystore"><MarketingSegmentsPage /></ModuleGuard>} />
                    <Route path="marketing/newsletter" element={<ModuleGuard moduleId="dailystore"><MarketingNewsletterPage /></ModuleGuard>} />
                    <Route path="marketing/coupons" element={<ModuleGuard moduleId="dailystore"><MarketingCouponsPage /></ModuleGuard>} />
                    <Route path="marketing/reviews" element={<ModuleGuard moduleId="dailystore"><MarketingReviewsPage /></ModuleGuard>} />
                    <Route path="marketing/wishlist" element={<ModuleGuard moduleId="dailystore"><MarketingWishlistPage /></ModuleGuard>} />
                </Routes>
                </CrossLinkBridge>
            </CrmShellInitializer>
        </Layout>
    );
};

export default App;
