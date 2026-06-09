export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Converted' | 'Lost';

export interface User {
    id: string;
    full_name: string;
    avatar_url?: string;
    email: string;
    role?: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'SELECT';

export interface CustomFieldDefinition {
    id: string;
    label: string;
    type: CustomFieldType;
    field_type?: string;
    required?: boolean;
    is_required?: boolean;
    options?: string[];
}

export interface Attachment {
    id: string;
    name: string;
    size: number;
    type: string;
    uploaded_at: string;
    uploaded_by: User;
    url: string;
    created_at: string;
}

export interface Lead {
    id: string;
    company_name: string;
    first_name?: string;
    last_name?: string;
    contact_name?: string;
    contact_email: string;
    phone?: string;
    source: string;
    owner: User;
    status: LeadStatus;
    type?: 'lead' | 'customer' | 'partner';
    referred_by?: string;
    created_at: string;
    updated_at?: string;
    activities: Activity[];
    notes: Note[];
    documents?: Attachment[];
    custom_fields?: Record<string, any>;
    creator?: User;
    customer_category?: 'b2b' | 'b2c';
    tax_id?: string;
    tax_id_verified?: boolean;
    tax_id_verified_at?: string;
    credit_limit?: number;
    credit_balance?: number;
    acquisition_source?: string;
    first_order_id?: string;
    first_order_at?: string;
    channel?: string;
    auto_score?: number;
    score_breakdown?: ScoreBreakdownItem[];
}

export type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';

export interface FlowState {
    id: string;           // flow state code, e.g. 'qualified'
    name: string;         // display name, e.g. 'Qualified'
    color: string;
    is_terminal: boolean;
    deals?: Deal[];
}

export interface Deal {
    id: string;
    name: string;
    company_name: string;
    value: number;
    expected_close_date: string;
    stage: DealStage;
    stage_id?: string;
    current_flow_state?: string;
    owner: User;
    owner_id?: string;  // Used for updating owner
    last_activity_at?: string;
    notes: Note[];
    activities: Activity[];
    documents?: Attachment[];
    lead_id?: string;
    partner_id?: string;
    company?: string;
    contact_email?: string;
    project_id?: string;
    invoice_id?: string;
    invoice_number?: string;
    custom_fields?: Record<string, any>;
    created_at: string;
    fulfillment_status?: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | null;
}

export type ActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'STATUS_CHANGE' | 'STAGE_CHANGE' | 'OWNER_CHANGE' | 'PROFILE_UPDATE' | 'TASK';

export interface Activity {
    id: string;
    type: ActivityType;
    notes: string;
    date: string;
    follow_up_date?: string;
    author: User;
    created_at: string;
}

export interface Note {
    id: string;
    content: string;
    author: User;
    created_at: string;
}

export type TaskType = 'EMAIL' | 'TODO' | 'REMINDER' | 'CALL' | 'MEETING';

export interface Task {
    id: string;
    title: string;
    due_date: string;
    start_date?: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD' | 'CANCELLED';
    type: TaskType;
    deal_id?: string;
    deal_name?: string;
    lead_id?: string;
    lead?: { id: string; company_name: string; contact_name: string } | null;
    deal?: { id: string; name: string; company_name: string } | null;
    description?: string;
    assigned_to: User;
    created_at: string;
    reminder_minutes_before?: number;
}

export interface LeadScoringRule {
    id: string;
    name: string;
    rule_type: 'source' | 'activity' | 'field';
    target_field: string;
    condition: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
    value?: string;
    score_points: number;
    is_active: boolean;
    priority: number;
    // Legacy field kept for backwards compat during transition
    criteria?: string;
    points?: number;
    type?: 'source' | 'activity' | 'field';
}

export interface ScoreCategory {
    id: string;
    label: string;
    min_score: number;
    max_score: number | null;
    color: string;
    sort_order: number;
}

export interface ScoreBreakdownItem {
    rule_id: string;
    rule_name: string;
    points: number;
}

export interface SourceTypeOption {
    id: string;
    label: string;
    value: string;
    is_system: boolean;
    is_active: boolean;
    sort_order: number;
}

export interface CRMSettings {
    deal_stages: { id: string; name: string; type: 'OPEN' | 'WON' | 'LOST' }[];
    lead_stages: { id: string; name: string }[];
    default_owner_id: string;
    lead_sources: { id: string; name: string; archived: boolean }[];
    source_type_options: SourceTypeOption[];
    lead_custom_fields: CustomFieldDefinition[];
    deal_custom_fields: CustomFieldDefinition[];
    partner_custom_fields: CustomFieldDefinition[];
    lead_scoring: LeadScoringRule[];
    score_categories: ScoreCategory[];
}

export interface DealFilters {
    date_range?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';
    start_date?: string;
    end_date?: string;
    owner_id?: string;
    lead_id?: string;
    company_name?: string;
}

// Quote Types
export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'converted' | 'expired';

export interface QuoteLine {
    id?: string;
    item_id?: string;
    variant_id?: string;
    item_name?: string;
    sku?: string;
    sub_sku?: string;
    item_image_url?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate?: number;
    line_total?: number;
}

// Inventory item types — used by ProductPickerModal
export interface InventoryVariant {
    id: string;
    name: string;
    sku: string;
    price: number;
    variant_attributes: Record<string, string>;
    image_url: string | null;
}

export interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    price: number;
    cost: number;
    image_url: string | null;
    metadata: Record<string, any>;
    has_variants: boolean;
    variants: InventoryVariant[];
}

export interface ProductPickerSelection {
    item_id: string;
    variant_id: string;
    name: string;
    sku: string;
    sub_sku: string;
    unit_price: number;
    image_url: string | null;
}

export interface Quote {
    id: string;
    quote_number: string;
    deal_id: string;
    deal?: Deal;
    customer_id?: string;
    customer_name?: string;
    title?: string;
    status: QuoteStatus;
    lines: QuoteLine[];
    subtotal: number;
    tax_total: number;
    discount_total: number;
    grand_total: number;
    notes?: string;
    terms_and_conditions?: string;
    valid_until?: string;
    created_by: User;
    approved_by?: User;
    approved_at?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at?: string;
}

export interface CreateQuoteDto {
    deal_id: string;
    customer_id?: string;
    title?: string;
    notes?: string;
    terms_and_conditions?: string;
    valid_until?: string;
    lines: Omit<QuoteLine, 'id' | 'line_total'>[];
}

export interface UpdateQuoteDto {
    title?: string;
    notes?: string;
    terms_and_conditions?: string;
    valid_until?: string;
    lines?: Omit<QuoteLine, 'id' | 'line_total'>[];
}

export interface QuoteFilters {
    status?: QuoteStatus;
    deal_id?: string;
    customer_id?: string;
}

// ─── Lead / Deal Products ─────────────────────────────────────────────────────

export type ProductInterestStatus = 'interested' | 'quoted' | 'approved' | 'ordered' | 'cancelled';

export interface LeadProduct {
    id: string;
    lead_id: string;
    item_id: string;
    item_name: string;
    item_sku?: string;
    category_name?: string;
    quantity: number;
    unit_price: number;
    status: ProductInterestStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface DealProduct {
    id: string;
    deal_id: string;
    lead_product_id?: string;
    item_id: string;
    item_name: string;
    item_sku?: string;
    category_name?: string;
    quantity: number;
    unit_price: number;
    status: ProductInterestStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

