import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface Partner {
    id: string;
    contact_name?: string;
    company_name?: string;
}

interface PartnerSearchDropdownProps {
    partners: Partner[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
}

export const PartnerSearchDropdown: React.FC<PartnerSearchDropdownProps> = ({
    partners,
    value,
    onChange,
    placeholder = 'Search partner...',
    disabled = false,
    className = '',
    inputClassName = '',
}) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = partners.find(p => p.id === value);

    const getPrimaryName = (p: Partner) => p.contact_name || p.company_name || '';
    const getSecondaryName = (p: Partner) => p.contact_name && p.company_name ? p.company_name : null;

    const filtered = query
        ? partners.filter(p =>
              getPrimaryName(p).toLowerCase().includes(query.toLowerCase()) ||
              (p.company_name || '').toLowerCase().includes(query.toLowerCase())
          )
        : partners;

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleOpen = () => {
        if (!disabled) setIsOpen(true);
    };

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
        setQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`} data-testid="partner-search-dropdown">
            <div
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                onClick={handleOpen}
                className={`flex items-center gap-2 w-full bg-slate-950 border rounded-lg px-3 py-2 cursor-pointer transition-all
                    ${isOpen ? 'border-blue-500/50 ring-2 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${inputClassName}`}
            >
                <Search size={14} className="text-slate-500 shrink-0" />
                {isOpen ? (
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={selected ? getPrimaryName(selected) : placeholder}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-500 min-w-0"
                        data-testid="partner-search-input"
                    />
                ) : (
                    <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-50' : 'text-slate-500'}`}>
                        {selected
                            ? `${getPrimaryName(selected)}${getSecondaryName(selected) ? ` (${getSecondaryName(selected)})` : ''}`
                            : placeholder}
                    </span>
                )}
                {value && !isOpen ? (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        data-testid="partner-clear-btn"
                        aria-label="Clear selection"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown
                        size={14}
                        className={`text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </div>

            {isOpen && (
                <div
                    role="listbox"
                    className="absolute z-50 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                    data-testid="partner-dropdown-list"
                >
                    <div className="max-h-48 overflow-y-auto">
                        <button
                            type="button"
                            role="option"
                            aria-selected={!value}
                            onClick={() => handleSelect('')}
                            className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-800 transition-colors italic"
                        >
                            — None —
                        </button>
                        {filtered.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-slate-500 text-center italic">
                                No partners found
                            </div>
                        ) : (
                            filtered.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    role="option"
                                    aria-selected={p.id === value}
                                    onClick={() => handleSelect(p.id)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between
                                        ${p.id === value
                                            ? 'bg-blue-600/20 text-blue-400'
                                            : 'text-slate-200 hover:bg-slate-800'}`}
                                    data-testid={`partner-option-${p.id}`}
                                >
                                    <span className="font-medium truncate">{getPrimaryName(p)}</span>
                                    {getSecondaryName(p) && (
                                        <span className="text-slate-400 text-xs ml-2 shrink-0">
                                            {getSecondaryName(p)}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
