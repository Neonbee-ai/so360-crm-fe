import React, { useState, useEffect } from 'react';
import { crmService } from '../../services/crmService';
import { User, DealFilters as Filters } from '../../types/crm';
import { X, Calendar, Search, Filter } from 'lucide-react';

interface DealFiltersProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
}

export const DealFilters: React.FC<DealFiltersProps> = ({ filters, onChange }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [showCustomDate, setShowCustomDate] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await crmService.getUsers();
                setUsers(data);
            } catch (error) {
                console.error('Failed to fetch users', error);
            }
        };
        fetchUsers();
    }, []);

    const handleChange = (key: keyof Filters, value: any) => {
        const newFilters = { ...filters };

        if (value === '' || value === undefined || value === null) {
            delete newFilters[key];
        } else {
            newFilters[key] = value;
        }

        if (key === 'date_range') {
            setShowCustomDate(value === 'custom');
            if (value !== 'custom') {
                delete newFilters.start_date;
                delete newFilters.end_date;
            }
        }

        onChange(newFilters);
    };

    const clearFilters = () => {
        onChange({});
        setShowCustomDate(false);
    };

    const hasActiveFilters = Object.keys(filters).length > 0;

    return (
        <div className="flex flex-wrap items-center gap-nb-2">
            <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={14} />
                <select
                    aria-label="Date range"
                    value={filters.date_range || ''}
                    onChange={(e) => handleChange('date_range', e.target.value)}
                    className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary pl-9 min-w-[10rem]"
                >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="this_year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>

            {showCustomDate && (
                <>
                    <input
                        type="date"
                        aria-label="Start date"
                        value={filters.start_date || ''}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                        className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary"
                    />
                    <input
                        type="date"
                        aria-label="End date"
                        value={filters.end_date || ''}
                        onChange={(e) => handleChange('end_date', e.target.value)}
                        className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary"
                    />
                </>
            )}

            <select
                aria-label="Owner"
                value={filters.owner_id || ''}
                onChange={(e) => handleChange('owner_id', e.target.value)}
                className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary min-w-[9rem]"
            >
                <option value="">All Owners</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
            </select>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={14} />
                <input
                    type="text"
                    placeholder="Search company..."
                    value={filters.company_name || ''}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="h-nb-control-md rounded-nb border border-line bg-surface text-sm text-fg px-3 outline-none focus:border-primary pl-9 w-full wc-medium:w-56"
                />
            </div>

            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 h-nb-control-md px-3 rounded-nb text-xs text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
                >
                    <X size={14} />
                    Clear
                </button>
            )}
        </div>
    );
};
