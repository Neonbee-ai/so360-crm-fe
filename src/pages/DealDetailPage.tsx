import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ChevronLeft, Calendar, DollarSign, Clock, MessageSquare,
    AtSign, Phone, FileText, Plus, CheckCircle2, User as UserIcon, Users
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { Deal, Activity, Task, Note, CustomFieldDefinition } from '../types/crm';
import { Loader2, Tag } from 'lucide-react';

const DealDetailPage = () => {
    const { id = '' } = useParams<{ id: string }>();
    const [deal, setDeal] = useState<Deal | null>(null);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDealData = async () => {
            try {
                const [dealData, settingsData] = await Promise.all([
                    crmService.getDealById(id),
                    crmService.getSettings()
                ]);
                setDeal(dealData || null);
                setCustomFieldDefs(settingsData.deal_custom_fields);
            } catch (error) {
                console.error('Failed to fetch deal data', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDealData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading deal details...</span>
            </div>
        );
    }

    if (!deal) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>Deal not found.</p>
                <Link to=".." className="text-blue-500 hover:underline mt-4 inline-block">Back to Pipeline</Link>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8 overflow-hidden">
                <Link to=".." className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors mb-4 group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Pipeline
                </Link>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight leading-tight">{deal.name}</h1>
                        <p className="text-slate-400 flex items-center gap-2 mt-1">
                            <span className="font-semibold text-white">{deal.company_name}</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                            Stage: <span className="text-blue-400 font-medium">{deal.stage}</span>
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary & Notes */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Summary Card */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <FileText size={18} className="text-blue-400" />
                            Deal Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Value</span>
                                <p className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                                    <DollarSign size={16} />{deal.value.toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Close</span>
                                <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                                    <Calendar size={16} />{deal.expected_close_date}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-slate-700">
                                        {deal.owner.avatar_url ? <img src={deal.owner.avatar_url} alt={deal.owner.full_name} /> : deal.owner.full_name.charAt(0)}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-200">{deal.owner.full_name}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Activity</span>
                                <p className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Clock size={16} />{deal.last_activity_at ? new Date(deal.last_activity_at).toLocaleDateString() : 'None'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Custom Fields Section */}
                    {customFieldDefs.length > 0 && (
                        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Tag size={18} className="text-purple-400" />
                                Additional Details
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                                {customFieldDefs.map(field => (
                                    <div key={field.id} className="space-y-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</span>
                                        <p className="text-sm font-semibold text-white">
                                            {field.type === 'boolean'
                                                ? (deal.custom_fields?.[field.id] ? 'Yes' : 'No')
                                                : field.type === 'date' && deal.custom_fields?.[field.id]
                                                    ? new Date(deal.custom_fields[field.id]).toLocaleDateString()
                                                    : deal.custom_fields?.[field.id] || '—'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Activities Timeline */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                <MessageSquare size={18} className="text-purple-400" />
                                Activities Timeline
                            </h3>
                            <button className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-bold transition-all border border-slate-700">
                                <Plus size={14} /> Add Activity
                            </button>
                        </div>

                        <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                            {deal.activities.length === 0 ? (
                                <p className="text-center text-slate-500 py-4 ml-6 italic">No activities logged yet.</p>
                            ) : (
                                deal.activities.map((activity) => (
                                    <div key={activity.id} className="relative pl-10">
                                        <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center z-10 shadow-lg">
                                            {activity.type === 'Call' && <Phone size={14} className="text-blue-400" />}
                                            {activity.type === 'Meeting' && <Users size={14} className="text-purple-400" />}
                                            {activity.type === 'Email' && <AtSign size={14} className="text-emerald-400" />}
                                            {activity.type === 'Note' && <FileText size={14} className="text-amber-400" />}
                                        </div>
                                        <div className="bg-slate-900/50 border border-slate-800/40 p-4 rounded-xl group hover:border-slate-700 transition-all">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-white text-sm">{activity.type}</span>
                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black tracking-tighter uppercase">
                                                    {new Date(activity.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-slate-300 text-sm leading-relaxed">{activity.notes}</p>
                                            <div className="mt-4 flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-black overflow-hidden border border-slate-700">
                                                    {activity.author.avatar_url ? <img src={activity.author.avatar_url} alt={activity.author.full_name} /> : activity.author.full_name.charAt(0)}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{activity.author.full_name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Tasks & Notes */}
                <div className="space-y-8">
                    {/* Tasks Section */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                <CheckCircle2 size={18} className="text-emerald-400" />
                                Tasks
                            </h3>
                            <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                                Add
                            </button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-slate-500 text-xs italic">No open tasks for this deal.</p>
                        </div>
                    </section>

                    {/* Notes Section (Simple append-only) */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-6">
                            <FileText size={18} className="text-amber-400" />
                            Internal Notes
                        </h3>
                        <div className="space-y-4 mb-6">
                            {deal.notes.map(note => (
                                <div key={note.id} className="text-sm border-l-2 border-amber-500/30 pl-4 py-1">
                                    <p className="text-slate-300 leading-relaxed mb-2">{note.content}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{note.author.full_name}</span>
                                        <span className="text-[10px] text-slate-600 font-bold">{new Date(note.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <textarea
                                placeholder="Add a quick note..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none h-24"
                            />
                            <button className="absolute bottom-3 right-3 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-amber-900/20">
                                Save
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default DealDetailPage;
