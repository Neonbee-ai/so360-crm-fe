import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ShellContext } from '@so360/shell-context';
import { crmService } from './services/crmService';

// Synchronizes Shell Context with CRM Service
const CrmShellInitializer = ({ children }: { children: React.ReactNode }) => {
    // Access context directly to avoid throwing if provider is missing
    const shell = React.useContext(ShellContext);
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

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
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
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="leads/:id" element={<LeadDetailPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="customers/:id" element={<LeadDetailPage />} />
                    <Route path="pipeline" element={<PipelinePage />} />
                    <Route path="deal/:id" element={<DealDetailPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="tasks/:id" element={<TaskDetailPage />} />
                    <Route path="quotes" element={<QuotesPage />} />
                    <Route path="quotes/:id" element={<QuoteDetailPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="marketing/overview" element={<MarketingOverviewPage />} />
                    <Route path="marketing/abandoned-carts" element={<MarketingAbandonedCartsPage />} />
                    <Route path="marketing/abandoned-carts/:cartId" element={<MarketingAbandonedCartDetailPage />} />
                    <Route path="marketing/campaigns" element={<MarketingCampaignsPage />} />
                    <Route path="marketing/campaigns/:campaignId" element={<MarketingCampaignDetailPage />} />
                    <Route path="marketing/segments" element={<MarketingSegmentsPage />} />
                </Routes>
            </CrmShellInitializer>
        </Layout>
    );
};

export default App;
