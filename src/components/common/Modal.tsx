import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizeClasses = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-start justify-center p-6 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className={`relative bg-slate-900 border border-slate-800 rounded-2xl w-full ${sizeClasses[size]} shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col my-auto max-h-[90vh]`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
                    <h3 className="text-xl font-bold text-slate-50">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
