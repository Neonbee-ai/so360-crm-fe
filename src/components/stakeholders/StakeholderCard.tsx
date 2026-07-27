import React from 'react';
import { Star, Mail, Phone, Linkedin, Ban, ShieldOff, Edit2, Trash2 } from 'lucide-react';
import { Stakeholder } from '../../types/crm';
import { ROLE_LABELS } from './StakeholderRolesEditor';

const STRENGTH_STYLE: Record<string, string> = {
    very_strong: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    strong: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    moderate: 'bg-slate-800 text-slate-400 border-slate-700',
    weak: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    no_relationship: 'bg-slate-900 text-slate-600 border-slate-800',
};

const COMMITTEE_STYLE: Record<string, string> = {
    primary_decision_maker: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    strong_supporter: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
    opposed: 'bg-red-500/10 text-red-400 border-red-500/20',
    unknown: 'bg-slate-900 text-slate-600 border-slate-800',
};

interface Props {
    stakeholder: Stakeholder;
    onEdit: (stakeholder: Stakeholder) => void;
    onDelete: (stakeholder: Stakeholder) => void;
    onOpenQuickActions: (stakeholder: Stakeholder) => void;
}

const StakeholderCard: React.FC<Props> = ({ stakeholder, onEdit, onDelete, onOpenQuickActions }) => {
    return (
        <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 hover:border-slate-700 transition-all group">
            <div className="flex items-start justify-between gap-2">
                <button className="flex items-center gap-2 text-left" onClick={() => onOpenQuickActions(stakeholder)}>
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-300 shrink-0">
                        {(stakeholder.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-50 text-xs">{stakeholder.full_name || 'Unnamed'}</span>
                            {stakeholder.is_primary_contact && <Star size={12} className="text-amber-400 fill-amber-400" />}
                            {!stakeholder.is_active && <span className="text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">Inactive</span>}
                        </div>
                        <p className="text-[10px] text-slate-500">
                            {[stakeholder.job_title, stakeholder.department].filter(Boolean).join(' · ') || '—'}
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => onEdit(stakeholder)} className="p-1 text-slate-500 hover:text-blue-400 transition-colors"><Edit2 size={12} /></button>
                    <button onClick={() => onDelete(stakeholder)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {stakeholder.roles.map((role) => (
                    <span key={role} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                        {ROLE_LABELS[role] || role}
                    </span>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest ${COMMITTEE_STYLE[stakeholder.buying_committee_role]}`}>
                    {stakeholder.buying_committee_role.replace(/_/g, ' ')}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest ${STRENGTH_STYLE[stakeholder.relationship_strength]}`}>
                    {stakeholder.relationship_strength.replace(/_/g, ' ')}
                </span>
                {stakeholder.do_not_contact && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 font-black uppercase tracking-widest flex items-center gap-1">
                        <Ban size={9} /> Do Not Contact
                    </span>
                )}
                {stakeholder.marketing_opt_out && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 font-black uppercase tracking-widest flex items-center gap-1">
                        <ShieldOff size={9} /> Opted Out
                    </span>
                )}
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
                {stakeholder.email && <span className="flex items-center gap-1"><Mail size={11} /> {stakeholder.email}</span>}
                {stakeholder.phone && <span className="flex items-center gap-1"><Phone size={11} /> {stakeholder.phone}</span>}
                {stakeholder.linkedin_url && (
                    <a href={stakeholder.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-400">
                        <Linkedin size={11} /> LinkedIn
                    </a>
                )}
            </div>
        </div>
    );
};

export default StakeholderCard;
