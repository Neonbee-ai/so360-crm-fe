import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

import { ShellContext, ShellContextType } from '@so360/shell-context';

// Mock Provider for Standalone Development
const MockShellProvider = ({ children }: { children: React.ReactNode }) => {
    const mockContext: ShellContextType = {
        user: {
            id: 'mock-user-id',
            email: 'admin@so360.com',
            full_name: 'System Admin',
            avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
        },
        tenants: [
            { id: '3cf1c619-cb9b-48ac-9387-447418d1beee', name: 'Acme Corp' }
        ],
        currentTenant: { id: '3cf1c619-cb9b-48ac-9387-447418d1beee', name: 'Acme Corp' },
        orgs: [
            { id: 'org-1', name: 'Primary Org', tenant_id: '3cf1c619-cb9b-48ac-9387-447418d1beee' }
        ],
        currentOrg: { id: 'org-1', name: 'Primary Org', tenant_id: '3cf1c619-cb9b-48ac-9387-447418d1beee' },
        isLoading: false,
        error: null,
        refreshContext: async () => { console.log('Mock refresh'); },
        setUser: () => { },
        setCurrentTenant: () => { },
        setCurrentOrg: () => { },
        accessToken: 'mock-access-token',
        enabledModules: ['crm', 'inventory', 'accounting'],
        isModuleEnabled: () => true,
        toggleModule: async () => { console.log('Mock toggleModule'); },
        refreshModules: async () => { console.log('Mock refreshModules'); },
        modulesLoading: false,
        notifications: [],
        unreadCount: 0,
        markAsRead: async () => { },
        markAllAsRead: async () => { },
        emitNotification: async () => ({ success: true, notificationIds: [], errors: [] }),
        recordActivity: async () => { },
        // Business Settings (mock for standalone development)
        businessSettings: {
            id: 'mock-settings-id',
            org_id: 'mock-org-id',
            base_currency: 'USD',
            timezone: 'America/New_York',
            fiscal_year_start_month: 1,
            date_format: 'MM/DD/YYYY',
            number_format: '1,234.56',
            document_language: 'en-US',
            is_multi_currency_enabled: false,
            exchange_rate_source: 'manual',
            tax_regime: 'standard',
            default_tax_region: 'US',
            is_tax_inclusive_pricing: false,
            is_reverse_charge_applicable: false,
            accounting_method: 'accrual' as const,
            is_inventory_enabled: true,
            valuation_method: 'FIFO' as const,
            allow_negative_stock: false,
            rounding_precision: 2,
            document_settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        businessSettingsLoading: false,
        refreshBusinessSettings: async () => { console.log('Mock refreshBusinessSettings'); },
    };

    return (
        <ShellContext.Provider value={mockContext}>
            {children}
        </ShellContext.Provider>
    );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <BrowserRouter>
            <MockShellProvider>
                <App />
            </MockShellProvider>
        </BrowserRouter>
    </React.StrictMode>
);
