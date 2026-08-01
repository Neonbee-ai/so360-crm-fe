import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export type StageStatusType = 'OPEN' | 'WON' | 'LOST';

interface StatusOption {
    value: StageStatusType;
    label: string;
    dotClassName: string;
    collapsedTextClassName: string;
}

const STATUS_OPTIONS: StatusOption[] = [
    { value: 'OPEN', label: 'OPEN', dotClassName: 'bg-slate-400', collapsedTextClassName: 'text-slate-300 border-slate-700' },
    { value: 'WON', label: 'WON', dotClassName: 'bg-emerald-400', collapsedTextClassName: 'text-emerald-400 border-emerald-500/30' },
    { value: 'LOST', label: 'LOST', dotClassName: 'bg-rose-400', collapsedTextClassName: 'text-rose-400 border-rose-500/30' },
];

interface StageStatusSelectProps {
    value: StageStatusType;
    onChange: (value: StageStatusType) => void;
}

/**
 * Custom status dropdown for pipeline stages.
 * Collapsed state keeps the business status color (design-system convention);
 * the expanded menu uses one consistent selection highlight plus a colored
 * dot per option, so status color and selection state never conflict.
 */
export const StageStatusSelect: React.FC<StageStatusSelectProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selected = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleSelect = (v: StageStatusType) => {
        onChange(v);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative" data-testid="stage-status-select">
            <button
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                onClick={() => setIsOpen(o => !o)}
                className={`flex items-center gap-1 bg-slate-900 border text-[10px] font-black uppercase rounded-lg px-2 py-1 outline-none focus:border-blue-500 transition-colors ${selected.collapsedTextClassName}`}
                data-testid="stage-status-trigger"
            >
                {selected.label}
                <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className="absolute z-50 top-full right-0 mt-1 min-w-[100px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                    data-testid="stage-status-list"
                >
                    {STATUS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => handleSelect(opt.value)}
                            className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-[10px] font-black uppercase transition-colors ${
                                opt.value === value
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-800'
                            }`}
                            data-testid={`stage-status-option-${opt.value}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dotClassName}`} />
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
