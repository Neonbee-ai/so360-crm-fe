import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Users, DollarSign, Target } from 'lucide-react';
import { dealsApi } from '../services/crmService';
import { usePeople } from '@so360/shell-context';

interface SalesMetrics {
    person_id: string;
    total_value: number;
    won_value: number;
    lost_value: number;
    total_deals: number;
    won_deals: number;
    lost_deals: number;
    open_deals: number;
    open_value: number;
    win_rate: string;
    avg_deal_value: string;
    avg_won_value: string;
}

const SalesPerformancePage: React.FC = () => {
    const { people } = usePeople();
    const [performance, setPerformance] = useState<SalesMetrics[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        loadPerformance();
    }, []);

    const loadPerformance = async () => {
        setIsLoading(true);
        try {
            const data = await dealsApi.getSalesPerformanceByPerson({
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            });
            setPerformance(data || []);
        } catch (error) {
            console.error('Failed to load sales performance:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilter = () => {
        loadPerformance();
    };

    const getPersonName = (personId: string) => {
        const person = people.find(p => p.id === personId);
        return person?.full_name || 'Unknown';
    };

    const totalWonValue = performance.reduce((sum, p) => sum + p.won_value, 0);
    const totalDeals = performance.reduce((sum, p) => sum + p.total_deals, 0);
    const avgWinRate = performance.length > 0
        ? (performance.reduce((sum, p) => sum + parseFloat(p.win_rate as any), 0) / performance.length).toFixed(1)
        : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <TrendingUp className="text-blue-500" size={32} />
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase">Sales Performance</h1>
                        <p className="text-slate-400 text-sm">Track sales rep metrics and resource utilization</p>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Total Deals</span>
                        <Target className="text-blue-500" size={20} />
                    </div>
                    <p className="text-3xl font-black text-white">{totalDeals}</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Total Won Value</span>
                        <DollarSign className="text-green-500" size={20} />
                    </div>
                    <p className="text-3xl font-black text-white">${(totalWonValue / 1000).toFixed(1)}K</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Active Reps</span>
                        <Users className="text-purple-500" size={20} />
                    </div>
                    <p className="text-3xl font-black text-white">{performance.length}</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Avg Win Rate</span>
                        <TrendingUp className="text-yellow-500" size={20} />
                    </div>
                    <p className="text-3xl font-black text-white">{avgWinRate}%</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                <h2 className="text-xl font-black text-white uppercase">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-widest">Start Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-widest">End Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleApplyFilter}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-lg px-4 py-2 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            {isLoading ? 'Loading...' : 'Apply'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-black text-white uppercase">Sales Rep Performance</h2>
                </div>

                {performance.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-400">No sales performance data available</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900 border-b border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs uppercase font-bold text-slate-400 tracking-widest">Sales Rep</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Total Deals</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Open</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Won</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Lost</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Win Rate</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Total Value</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Won Value</th>
                                    <th className="px-6 py-4 text-right text-xs uppercase font-bold text-slate-400 tracking-widest">Avg Deal Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {performance.map((metric) => (
                                    <tr key={metric.person_id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-white">
                                            {getPersonName(metric.person_id)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-white">
                                            <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg text-sm font-bold">
                                                {metric.total_deals}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-300">{metric.open_deals}</td>
                                        <td className="px-6 py-4 text-right text-green-400 font-semibold">{metric.won_deals}</td>
                                        <td className="px-6 py-4 text-right text-red-400 font-semibold">{metric.lost_deals}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${parseFloat(metric.win_rate as any) > 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {metric.win_rate}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-white font-semibold">
                                            ${(metric.total_value / 1000).toFixed(1)}K
                                        </td>
                                        <td className="px-6 py-4 text-right text-green-400 font-semibold">
                                            ${(metric.won_value / 1000).toFixed(1)}K
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-300">
                                            ${parseFloat(metric.avg_deal_value as any).toFixed(0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesPerformancePage;
