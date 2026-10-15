import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { TextField, Button, IconButton } from '@so360/design-system';

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
                className={`flex items-center gap-2 w-full bg-bg border rounded-lg px-3 py-2 cursor-pointer transition-all
                    ${isOpen ? 'border-primary/50 ring-2 ring-primary/20' : 'border-line hover:border-line'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${inputClassName}`}
            >
                <Search size={14} className="text-fg-muted shrink-0" />
                {isOpen ? (
                    <div className="flex-1 min-w-0">
                    <TextField
                        name="partner-search-query"
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={selected ? getPrimaryName(selected) : placeholder}
                        onClick={(e) => e.stopPropagation()}
                        size="sm"
                        className="border-0 bg-transparent px-0 shadow-none focus:ring-0"
                        data-testid="partner-search-input"
                    />
                    </div>
                ) : (
                    <span className={`flex-1 text-sm truncate ${selected ? 'text-fg' : 'text-fg-muted'}`}>
                        {selected
                            ? `${getPrimaryName(selected)}${getSecondaryName(selected) ? ` (${getSecondaryName(selected)})` : ''}`
                            : placeholder}
                    </span>
                )}
                {value && !isOpen ? (
                    <Button variant="secondary" size="sm" className="shrink-0"
                        type="button"
                        onClick={handleClear}
                        data-testid="partner-clear-btn"
                        aria-label="Clear selection"
                    >
                        <X size={14} />
                    </Button>
                ) : (
                    <ChevronDown
                        size={14}
                        className={`text-fg-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </div>

            {isOpen && (
                <div
                    role="listbox"
                    className="absolute z-menu top-full mt-1 w-full bg-surface border border-line rounded-lg shadow-xl overflow-hidden"
                    data-testid="partner-dropdown-list"
                >
                    <div className="max-h-48 overflow-y-auto">
                        <Button variant="secondary" size="sm" className="w-full justify-start border-0"
                            type="button"
                            role="option"
                            aria-selected={!value}
                            onClick={() => handleSelect('')}
                        >
                            — None —
                        </Button>
                        {filtered.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-fg-muted text-center italic">
                                No partners found
                            </div>
                        ) : (
                            filtered.map(p => (
                                <Button variant="secondary" size="sm" className="w-full justify-between border-0"
                                    key={p.id}
                                    type="button"
                                    role="option"
                                    aria-selected={p.id === value}
                                    onClick={() => handleSelect(p.id)}
                                    data-testid={`partner-option-${p.id}`}
                                >
                                    <span className="font-medium truncate">{getPrimaryName(p)}</span>
                                    {getSecondaryName(p) && (
                                        <span className="text-fg-subtle text-xs ml-2 shrink-0">
                                            {getSecondaryName(p)}
                                        </span>
                                    )}
                                </Button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
