export type LeadStatus = 'Open' | 'Qualified' | 'Won' | 'Lost';

export interface User {
    id: string;
    full_name: string;
    avatar_url?: string;
    email: string;
    role?: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean';

export interface CustomFieldDefinition {
    id: string;
    label: string;
    type: CustomFieldType;
    required: boolean;
}

export interface Attachment {
    id: string;
    name: string;
    size: number;
    type: string;
    uploaded_at: string;
    uploaded_by: User;
    url: string;
}

export interface Lead {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    phone?: string;
    source: string;
    owner: User;
    status: LeadStatus;
    created_at: string;
    activities: Activity[];
    notes: Note[];
    documents?: Attachment[];
    custom_fields?: Record<string, any>;
}

export type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';

export interface Deal {
    id: string;
    name: string;
    company_name: string;
    value: number;
    expected_close_date: string;
    stage: DealStage;
    owner: User;
    last_activity_at?: string;
    notes: Note[];
    activities: Activity[];
    documents?: Attachment[];
    lead_id?: string;
    custom_fields?: Record<string, any>;
}

export type ActivityType = 'Call' | 'Meeting' | 'Email' | 'Note';

export interface Activity {
    id: string;
    type: ActivityType;
    notes: string;
    date: string;
    follow_up_date?: string;
    author: User;
}

export interface Note {
    id: string;
    content: string;
    author: User;
    created_at: string;
}

export type TaskType = 'Email' | 'ToDo' | 'Reminder' | 'Call' | 'Meeting';

export interface Task {
    id: string;
    title: string;
    due_date: string;
    status: 'Open' | 'Done';
    type: TaskType;
    deal_id?: string;
    deal_name?: string;
    lead_id?: string;
    assigned_to: User;
}

export interface LeadScoringRule {
    id: string;
    criteria: string;
    points: number;
    type: 'source' | 'activity' | 'field';
}

export interface CRMSettings {
    deal_stages: { id: string; name: string }[];
    default_owner_id: string;
    lead_sources: { id: string; name: string; archived: boolean }[];
    lead_custom_fields: CustomFieldDefinition[];
    deal_custom_fields: CustomFieldDefinition[];
    lead_scoring: LeadScoringRule[];
}
