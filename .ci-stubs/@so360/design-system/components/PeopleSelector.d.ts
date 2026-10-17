import React from 'react';
/**
 * Resolves the People Connect base URL. Order: shell-injected window global
 * (works for pre-built remoteEntry.js bundles without a rebuild), then this
 * MFE's own build-time env, then a hostname-based fallback for the cloud
 * environments, then localhost.
 *
 * This file previously hardcoded `http://localhost:3015`, so every deployed
 * environment asked the viewer's own machine for the people list and the
 * selector was permanently empty outside a developer's laptop.
 *
 * `import.meta.env.VITE_SO360_PEOPLE_API` is accessed as a LITERAL on purpose:
 * this file is bundled from source into each consuming MFE, and Vite only
 * substitutes the exact text. An optional chain or a cast in the middle of
 * that expression silently ships the fallback instead.
 */
export declare function resolvePeopleApiUrl(): string;
export interface Person {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    job_title?: string;
    department_id?: string;
    department_name?: string;
    status: string;
    type: string;
}
export interface PeopleSelectorProps {
    /** Stable field name for Comb automation (data-comb-id). */
    name?: string;
    value?: string | string[];
    onChange: (personId: string | string[] | null, person?: Person | Person[]) => void;
    /** Required for the People Connect API source; unused with `loadOptions` / `options`. */
    orgId?: string;
    tenantId?: string;
    filters?: {
        department_id?: string;
        status?: 'active' | 'inactive' | 'on_leave' | 'terminated';
        type?: 'employee' | 'contractor';
        employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern';
    };
    multiSelect?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    error?: string;
    required?: boolean;
    /**
     * Custom data source (replaces the People Connect `/people` call). Loaded once on mount and
     * filtered client-side. Use for broker routes, e.g. `() => crmService.getSalesReps()`.
     */
    loadOptions?: () => Promise<Person[]>;
    /** Static data source; same client-side filtering as `loadOptions`. */
    options?: Person[];
    /** Single-select only: shows a ✕ to clear the selection (onChange(null)). */
    clearable?: boolean;
}
/** Multi-field match used for custom sources: name, email, title, department. */
export declare function matchPerson(p: Person, query: string): boolean;
export declare const PeopleSelector: React.FC<PeopleSelectorProps>;
