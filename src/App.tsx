import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ShellContext } from '@so360/shell-context';
import { crmService } from './services/crmService';

// Synchronizes Shell Context with CRM Service
const CrmShellInitializer = ({ children }: { children: React.ReactNode }) => {
    // Access context directly to avoid throwing if provider is missing
    const shell = React.useContext(ShellContext);

    useEffect(() => {
        if (shell?.currentTenant?.id) {
            console.log('CRM MFE: Syncing tenant from shell:', shell.currentTenant.id);
            crmService.setTenantId(shell.currentTenant.id);
        }
    }, [shell?.currentTenant?.id]);

    useEffect(() => {
        if (shell?.user) {
            console.log('CRM MFE: Syncing user from shell:', shell.user);
            crmService.setUser({
                id: shell.user.id,
                email: shell.user.email,
                full_name: shell.user.full_name || 'Unknown User',
                avatar_url: shell.user.avatar_url
            });
        }
    }, [shell?.user]);

    return <>{children}</>;
};

// Lazy load pages for performance
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const DealDetailPage = lazy(() => import('./pages/DealDetailPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
                    <Route path="/" element={<Navigate to="leads" replace />} />
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="leads/:id" element={<LeadDetailPage />} />
                    <Route path="pipeline" element={<PipelinePage />} />
                    <Route path="deal/:id" element={<DealDetailPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="tasks/:id" element={<TaskDetailPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                </Routes>
            </CrmShellInitializer>
        </Layout>
    );
};

export default App;
