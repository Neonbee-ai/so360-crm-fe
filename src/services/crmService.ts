import { Lead, Deal, Task, CRMSettings, User, Attachment, Note } from '../types/crm';

// API Configuration
// Using relative /api path which will be proxied to http://localhost:3006 by Vite
const API_BASE_URL = 'http://localhost:3004/crm-api';
let TENANT_ID = 'default-tenant';
let USER_ID = 'mock-user-id';
let CURRENT_USER: User | null = null;

// Status Mapping
const STATUS_MAP_FE_TO_BE: Record<string, string> = {
    'Open': 'NEW',
    'Qualified': 'QUALIFIED',
    'Won': 'CLOSED_WON',
    'Lost': 'CLOSED_LOST'
};

const STATUS_MAP_BE_TO_FE: Record<string, string> = {
    'NEW': 'Open',
    'CONTACTED': 'Open',
    'QUALIFIED': 'Qualified',
    'PROPOSAL_SENT': 'Qualified',
    'NEGOTIATION': 'Qualified',
    'CLOSED_WON': 'Won',
    'CLOSED_LOST': 'Lost'
};

const mapUser = (userObj: any, userId: string) => {
    if (userObj) return userObj;
    // If we have the current user and IDs match, use it
    if (CURRENT_USER && CURRENT_USER.id === userId) return CURRENT_USER;
    // Otherwise return a placeholder
    return {
        id: userId,
        full_name: 'Unknown User',
        email: '',
        avatar_url: ''
    };
};

const mapNoteFromApi = (apiNote: any): Note => ({
    ...apiNote,
    author: mapUser(apiNote.author, apiNote.author_id)
});

const mapDocumentFromApi = (apiDoc: any): Attachment => ({
    ...apiDoc,
    uploaded_by: mapUser(apiDoc.uploaded_by, apiDoc.uploaded_by_id)
});

const mapTaskFromApi = (apiTask: any): Task => ({
    ...apiTask,
    assigned_to: mapUser(apiTask.assigned_to, apiTask.assignee_id)
});

const mapLeadFromApi = (apiLead: any): Lead => {
    return {
        ...apiLead,
        value: parseFloat(apiLead.value) || 0,
        owner: mapUser(apiLead.owner, apiLead.owner_id),
        notes: (apiLead.notes || []).map(mapNoteFromApi),
        documents: (apiLead.documents || []).map(mapDocumentFromApi),
        // Ensure arrays are initialized if null
        deals: apiLead.deals || [],
        tasks: (apiLead.tasks || []).map(mapTaskFromApi),

        // Map remaining fields
        activities: [], // Activities are fetched separately
        custom_fields: apiLead.meta_data || {},
        contact_email: apiLead.email,
        status: STATUS_MAP_BE_TO_FE[apiLead.status] || 'Open'
    };
};

// API Client Helper
class ApiClient {
    private baseURL: string;
    private tenantId: string;

    constructor(baseURL: string, tenantId: string) {
        this.baseURL = baseURL;
        this.tenantId = tenantId;
    }

    setTenantId(id: string) {
        this.tenantId = id;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'X-Tenant-Id': this.tenantId,
            ...options.headers,
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const text = await response.text();

            if (!response.ok) {
                let errorMessage = `API Error: ${response.status}`;
                try {
                    const errorJson = JSON.parse(text);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    errorMessage = text || errorMessage;
                }
                throw new Error(errorMessage);
            }

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error(`Failed to parse JSON response from ${endpoint}:`, text);
                throw new Error(`Invalid JSON response from API: ${text.substring(0, 100)}...`);
            }
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
        const queryString = params
            ? '?' + new URLSearchParams(
                Object.entries(params).reduce((acc, [key, value]) => {
                    if (value !== undefined && value !== null) {
                        acc[key] = String(value);
                    }
                    return acc;
                }, {} as Record<string, string>)
            ).toString()
            : '';
        return this.request<T>(`${endpoint}${queryString}`, {
            method: 'GET',
        });
    }

    async post<T>(endpoint: string, data: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async patch<T>(endpoint: string, data: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'DELETE',
        });
    }
}

const apiClient = new ApiClient(API_BASE_URL, TENANT_ID);

// Type Definitions for API Responses
interface LeadStatsResponse {
    stats: Array<{
        status: string;
        count: number;
    }>;
}

interface PipelineResponse {
    stages: Array<{
        id: string;
        name: string;
        order: number;
        color?: string;
        deals: Deal[];
    }>;
}

interface PipelineStage {
    id: string;
    name: string;
    order: number;
    color?: string;
}

interface CustomFieldDefinition {
    id: string;
    entity_type: 'LEAD' | 'DEAL';
    label: string;
    field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
    options?: string[];
    is_required: boolean;
}

// ============================================================================
// LEADS API
// ============================================================================
export const leadsApi = {
    /**
     * GET /leads - Get all leads with filtering and pagination
     */
    getAll: async (params?: {
        skip?: number;
        take?: number;
        status?: string;
        q?: string;
    }): Promise<Lead[]> => {
        const apiParams = { ...params };
        if (params?.status && STATUS_MAP_FE_TO_BE[params.status]) {
            apiParams.status = STATUS_MAP_FE_TO_BE[params.status];
        }
        const leads = await apiClient.get<any[]>('/leads', apiParams);
        return leads.map(mapLeadFromApi);
    },

    /**
     * POST /leads - Create a new lead
     */
    create: async (data: any): Promise<Lead> => {
        const lead = await apiClient.post<any>('/leads', data);
        return mapLeadFromApi(lead);
    },

    /**
     * GET /leads/stats - Get lead statistics aggregated by status
     */
    getStats: async (): Promise<LeadStatsResponse> => {
        return apiClient.get<LeadStatsResponse>('/leads/stats');
    },

    /**
     * GET /leads/:id - Get a single lead by ID
     */
    getById: async (id: string): Promise<Lead> => {
        const lead = await apiClient.get<any>(`/leads/${id}`);
        return mapLeadFromApi(lead);
    },

    /**
     * PATCH /leads/:id - Update an existing lead
     */
    update: async (id: string, data: any): Promise<Lead> => {
        if (data.status && STATUS_MAP_FE_TO_BE[data.status]) {
            data.status = STATUS_MAP_FE_TO_BE[data.status];
        }
        const lead = await apiClient.patch<any>(`/leads/${id}`, data);
        return mapLeadFromApi(lead);
    },
};

// ============================================================================
// DEALS API
// ============================================================================
export const dealsApi = {
    /**
     * GET /deals - Get all deals with filtering
     */
    getAll: async (params?: { stage_id?: string }): Promise<Deal[]> => {
        return apiClient.get<Deal[]>('/deals', params);
    },

    /**
     * POST /deals - Create a new deal
     */
    create: async (data: {
        name: string;
        company: string;
        value: number;
        stage_id: string;
        owner_id: string;
        expected_close?: string;
        lead_id?: string;
    }): Promise<Deal> => {
        const deal = await apiClient.post<any>('/deals', data);
        return {
            ...deal,
            owner: mapUser(deal.owner, deal.owner_id),
        };
    },

    /**
     * GET /deals/pipeline - Get deals grouped by stage for Kanban pipeline
     */
    getPipeline: async (): Promise<PipelineResponse> => {
        return apiClient.get<PipelineResponse>('/deals/pipeline');
    },

    /**
     * GET /deals/:id - Get a single deal by ID
     */
    getById: async (id: string): Promise<Deal> => {
        const deal = await apiClient.get<any>(`/deals/${id}`);
        return {
            ...deal,
            owner: mapUser(deal.owner, deal.owner_id),
            notes: (deal.notes || []).map(mapNoteFromApi),
            documents: (deal.documents || []).map(mapDocumentFromApi),
        };
    },

    /**
     * PATCH /deals/:id - Update an existing deal
     */
    update: async (
        id: string,
        data: any
    ): Promise<Deal> => {
        const deal = await apiClient.patch<any>(`/deals/${id}`, data);
        return {
            ...deal,
            owner: mapUser(deal.owner, deal.owner_id),
        };
    },
};

// ============================================================================
// TASKS API
// ============================================================================
export const tasksApi = {
    /**
     * GET /tasks - Get all tasks with filtering for overdue or status
     */
    getAll: async (params?: {
        status?: string;
        overdue?: boolean;
    }): Promise<Task[]> => {
        const tasks = await apiClient.get<any[]>('/tasks', params);
        return tasks.map(mapTaskFromApi);
    },

    /**
     * POST /tasks - Create a new task
     */
    create: async (data: any): Promise<Task> => {
        const task = await apiClient.post<any>('/tasks', data);
        return mapTaskFromApi(task);
    },

    /**
     * GET /tasks/:id - Get a single task by ID
     */
    getById: async (id: string): Promise<Task> => {
        const task = await apiClient.get<any>(`/tasks/${id}`);
        return mapTaskFromApi(task);
    },

    /**
     * PATCH /tasks/:id - Update an existing task
     */
    update: async (id: string, data: any): Promise<Task> => {
        const task = await apiClient.patch<any>(`/tasks/${id}`, data);
        return mapTaskFromApi(task);
    },

    /**
     * PATCH /tasks/bulk - Bulk update multiple tasks
     */
    bulkUpdate: async (data: {
        ids: string[];
        data: {
            title?: string;
            due_date?: string;
            status?: string;
            assignee_id?: string;
            lead_id?: string;
            deal_id?: string;
        };
    }): Promise<{ updated: number }> => {
        return apiClient.patch<{ updated: number }>('/tasks/bulk', data);
    },
};

// ============================================================================
// SETTINGS API
// ============================================================================
export const settingsApi = {
    // Pipeline Stages
    pipelineStages: {
        /**
         * GET /settings/pipeline-stages - Get all pipeline stages
         */
        getAll: async (): Promise<PipelineStage[]> => {
            return apiClient.get<PipelineStage[]>('/settings/pipeline-stages');
        },

        /**
         * POST /settings/pipeline-stages - Create a new pipeline stage
         */
        create: async (data: {
            name: string;
            order: number;
            color?: string;
        }): Promise<PipelineStage> => {
            return apiClient.post<PipelineStage>('/settings/pipeline-stages', data);
        },

        /**
         * PATCH /settings/pipeline-stages/:id - Update an existing pipeline stage
         */
        update: async (
            id: string,
            data: {
                name?: string;
                order?: number;
                color?: string;
            }
        ): Promise<PipelineStage> => {
            return apiClient.patch<PipelineStage>(
                `/settings/pipeline-stages/${id}`,
                data
            );
        },

        /**
         * DELETE /settings/pipeline-stages/:id - Delete a pipeline stage
         */
        delete: async (id: string): Promise<{ message: string }> => {
            return apiClient.delete<{ message: string }>(
                `/settings/pipeline-stages/${id}`
            );
        },
    },

    // Custom Fields
    customFields: {
        /**
         * GET /settings/custom-fields - Get all custom field definitions
         */
        getAll: async (params?: {
            entity_type?: 'LEAD' | 'DEAL';
        }): Promise<CustomFieldDefinition[]> => {
            return apiClient.get<CustomFieldDefinition[]>(
                '/settings/custom-fields',
                params
            );
        },

        /**
         * POST /settings/custom-fields - Create a new custom field definition
         */
        create: async (data: {
            entity_type: 'LEAD' | 'DEAL';
            label: string;
            field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
            options?: string[];
            is_required?: boolean;
        }): Promise<CustomFieldDefinition> => {
            return apiClient.post<CustomFieldDefinition>(
                '/settings/custom-fields',
                data
            );
        },

        /**
         * PATCH /settings/custom-fields/:id - Update a custom field definition
         */
        update: async (
            id: string,
            data: {
                label?: string;
                options?: string[];
                is_required?: boolean;
            }
        ): Promise<CustomFieldDefinition> => {
            return apiClient.patch<CustomFieldDefinition>(
                `/settings/custom-fields/${id}`,
                data
            );
        },

        /**
         * DELETE /settings/custom-fields/:id - Delete a custom field definition
         */
        delete: async (id: string): Promise<{ message: string }> => {
            return apiClient.delete<{ message: string }>(
                `/settings/custom-fields/${id}`
            );
        },
    },
};



// ============================================================================
// NOTES API
// ============================================================================
export const notesApi = {
    create: async (data: any): Promise<Note> => {
        const note = await apiClient.post<any>('/notes', data);
        return mapNoteFromApi(note);
    },
    update: async (id: string, data: any): Promise<Note> => {
        const note = await apiClient.patch<any>(`/notes/${id}`, data);
        return mapNoteFromApi(note);
    },
    delete: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/notes/${id}`);
    },
};

// ============================================================================
// DOCUMENTS API
// ============================================================================
export const documentsApi = {
    create: async (data: any): Promise<Attachment> => {
        const doc = await apiClient.post<any>('/documents', data);
        return mapDocumentFromApi(doc);
    },
    delete: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/documents/${id}`);
    },
};

// ============================================================================
// USERS API
// ============================================================================



// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================
// Maintain backward compatibility with existing code
export const crmService = {
    // Leads
    getLeads: async (): Promise<Lead[]> => {
        return leadsApi.getAll();
    },

    createLead: async (lead: Omit<Lead, 'id' | 'created_at' | 'owner'>): Promise<Lead> => {
        const status = lead.status && STATUS_MAP_FE_TO_BE[lead.status] ? STATUS_MAP_FE_TO_BE[lead.status] : 'NEW';
        return leadsApi.create({
            company_name: lead.company_name,
            contact_name: lead.contact_name,
            email: lead.contact_email,
            phone: lead.phone,
            status: status,
            source: lead.source,
            owner_id: USER_ID,
            meta_data: lead.custom_fields,
        });
    },

    getLeadById: async (id: string): Promise<Lead | undefined> => {
        try {
            return await leadsApi.getById(id);
        } catch (error) {
            return undefined;
        }
    },

    updateLead: async (id: string, updates: Partial<Lead>): Promise<Lead> => {
        // Whitelist updateable fields to avoid sending relation objects to backend
        const data: any = {};
        if (updates.contact_name !== undefined) data.contact_name = updates.contact_name;
        if (updates.company_name !== undefined) data.company_name = updates.company_name;
        if (updates.contact_email !== undefined) data.email = updates.contact_email;
        if (updates.phone !== undefined) data.phone = updates.phone;
        if (updates.source !== undefined) data.source = updates.source;
        if (updates.status !== undefined) {
            // Check if it's FE name or BE name
            data.status = STATUS_MAP_FE_TO_BE[updates.status] || updates.status;
        }
        if (updates.custom_fields !== undefined) data.meta_data = updates.custom_fields;

        return leadsApi.update(id, data);
    },

    // Deals
    getDeals: async (): Promise<Deal[]> => {
        return dealsApi.getAll();
    },

    getDealById: async (id: string): Promise<Deal | undefined> => {
        try {
            return await dealsApi.getById(id);
        } catch (error) {
            return undefined;
        }
    },

    updateDealStage: async (id: string, stage: string, reason?: string): Promise<void> => {
        // Find stage_id based on stage name (would need to fetch stages first)
        // For now, just update with the stage as-is
        await dealsApi.update(id, { stage_id: stage });
    },

    getDealsByLeadId: async (leadId: string): Promise<Deal[]> => {
        const allDeals = await dealsApi.getAll();
        return allDeals.filter((d) => d.lead_id === leadId);
    },

    // Tasks
    getTasks: async (): Promise<Task[]> => {
        return tasksApi.getAll();
    },

    getTaskById: async (id: string): Promise<Task | undefined> => {
        try {
            return await tasksApi.getById(id);
        } catch (error) {
            return undefined;
        }
    },

    createTask: async (data: any): Promise<Task> => {
        return tasksApi.create(data);
    },

    updateTask: async (id: string, updates: Partial<Task> | any): Promise<Task> => {
        // Whitelist safe fields
        const data: any = {};
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.due_date !== undefined) data.due_date = updates.due_date;
        if (updates.status !== undefined) data.status = updates.status.toUpperCase();
        if (updates.type !== undefined) data.type = updates.type.toUpperCase();
        if (updates.assignee_id !== undefined) data.assignee_id = updates.assignee_id;
        if (updates.assigned_to !== undefined && updates.assigned_to?.id) {
            data.assignee_id = updates.assigned_to.id;
        }

        return tasksApi.update(id, data);
    },

    getTasksByLeadId: async (leadId: string): Promise<Task[]> => {
        const allTasks = await tasksApi.getAll();
        return allTasks.filter((t) => t.lead_id === leadId);
    },

    // Settings
    getSettings: async (): Promise<CRMSettings> => {
        try {
            const [stages, leadFields, dealFields] = await Promise.all([
                apiClient.get<any[]>('/settings/pipeline-stages'),
                apiClient.get<any[]>('/settings/custom-fields?entity_type=LEAD'),
                apiClient.get<any[]>('/settings/custom-fields?entity_type=DEAL')
            ]);

            return {
                deal_stages: stages.map(s => ({ id: s.id, name: s.name })),
                default_owner_id: USER_ID,
                lead_sources: [],
                lead_custom_fields: leadFields,
                deal_custom_fields: dealFields,
                lead_scoring: []
            };
        } catch (error) {
            console.error('Failed to fetch settings', error);
            return {
                deal_stages: [],
                default_owner_id: USER_ID,
                lead_sources: [],
                lead_custom_fields: [],
                deal_custom_fields: [],
                lead_scoring: []
            };
        }
    },

    updateSettings: async (settings: CRMSettings): Promise<CRMSettings> => {
        console.log('crmService.updateSettings called', settings);
        try {
            console.log('Syncing pipeline stages...');
            const currentStages = await apiClient.get<any[]>('/settings/pipeline-stages');
            console.log('Current stages from server:', currentStages);
            const newStages = settings.deal_stages;

            // Identify changes
            const stagesToCreate = newStages.filter(s => s.id.startsWith('st-'));
            const stagesToUpdate = newStages.filter(s => !s.id.startsWith('st-'));
            const stagesToDelete = currentStages.filter(cs => !newStages.find(ns => ns.id === cs.id));

            await Promise.all([
                ...stagesToCreate.map(s => apiClient.post('/settings/pipeline-stages', { name: s.name, order: newStages.indexOf(s) + 1, color: '#3b82f6' })),
                ...stagesToUpdate.map(s => apiClient.patch(`/settings/pipeline-stages/${s.id}`, { name: s.name, order: newStages.indexOf(s) + 1 })),
                ...stagesToDelete.map(s => apiClient.delete(`/settings/pipeline-stages/${s.id}`))
            ]);

            // 2. Sync Custom Fields (Lead)
            const currentLeadFields = await apiClient.get<any[]>('/settings/custom-fields?entity_type=LEAD');
            const newLeadFields = settings.lead_custom_fields;

            const lfToCreate = newLeadFields.filter(f => f.id.startsWith('lcf-'));
            const lfToUpdate = newLeadFields.filter(f => !f.id.startsWith('lcf-'));
            const lfToDelete = currentLeadFields.filter(cf => !newLeadFields.find(nf => nf.id === cf.id));

            await Promise.all([
                ...lfToCreate.map(f => apiClient.post('/settings/custom-fields', {
                    entity_type: 'LEAD',
                    label: f.label,
                    field_type: f.type,
                    is_required: f.required
                })),
                ...lfToUpdate.map(f => apiClient.patch(`/settings/custom-fields/${f.id}`, {
                    label: f.label,
                    field_type: f.type,
                    is_required: f.required
                })),
                ...lfToDelete.map(f => apiClient.delete(`/settings/custom-fields/${f.id}`))
            ]);

            // 3. Sync Custom Fields (Deal)
            const currentDealFields = await apiClient.get<any[]>('/settings/custom-fields?entity_type=DEAL');
            const newDealFields = settings.deal_custom_fields;

            const dfToCreate = newDealFields.filter(f => f.id.startsWith('dcf-'));
            const dfToUpdate = newDealFields.filter(f => !f.id.startsWith('dcf-'));
            const dfToDelete = currentDealFields.filter(cf => !newDealFields.find(nf => nf.id === cf.id));

            await Promise.all([
                ...dfToCreate.map(f => apiClient.post('/settings/custom-fields', {
                    entity_type: 'DEAL',
                    label: f.label,
                    field_type: f.type,
                    is_required: f.required
                })),
                ...dfToUpdate.map(f => apiClient.patch(`/settings/custom-fields/${f.id}`, {
                    label: f.label,
                    field_type: f.type,
                    is_required: f.required
                })),
                ...dfToDelete.map(f => apiClient.delete(`/settings/custom-fields/${f.id}`))
            ]);

            return settings;
        } catch (error) {
            console.error('Failed to update settings', error);
            throw error;
        }
    },

    // Notes
    createNote: async (leadId: string, content: string): Promise<Note> => {
        return notesApi.create({
            content,
            lead_id: leadId,
            author_id: USER_ID
        });
    },

    updateNote: async (leadId: string, noteId: string, content: string): Promise<void> => {
        await notesApi.update(noteId, { content });
    },

    deleteNote: async (leadId: string, noteId: string): Promise<void> => {
        await notesApi.delete(noteId);
    },

    // Users
    getUsers: async (): Promise<User[]> => {
        // Return the current synced user from Shell
        // If we had an API to search users in generic Core service, we would call it here
        return CURRENT_USER ? [CURRENT_USER] : [];
    },

    // Documents
    uploadDocument: async (entityId: string, file: File): Promise<Attachment> => {
        // Mock upload -> In real app, upload to storage first, get URL
        const mockUrl = URL.createObjectURL(file);
        return documentsApi.create({
            name: file.name,
            size: file.size,
            type: file.type,
            url: mockUrl,
            lead_id: entityId,
            uploaded_by_id: USER_ID,
        });
    },

    deleteDocument: async (entityId: string, documentId: string): Promise<void> => {
        return documentsApi.delete(documentId);
    },

    // Configuration
    setTenantId: (id: string) => {
        apiClient.setTenantId(id);
    },
    setUser: (user: User) => {
        CURRENT_USER = user;
        USER_ID = user.id;
    },
    setUserId: (id: string) => {
        USER_ID = id;
    },
};
