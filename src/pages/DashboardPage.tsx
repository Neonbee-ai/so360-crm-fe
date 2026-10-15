import React, { useState, useEffect, useCallback } from 'react';
import { crmService } from '../services/crmService';
import {
    DollarSign, TrendingUp, Users, CheckCircle2,
    BarChart3, ArrowUpRight, ArrowDownRight, Briefcase,
    Calendar, User as UserIcon, Loader2, ShoppingBag, Package, LayoutDashboard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CrossLinkChip, DashboardPageTemplate, KpiCard, Card, SegmentedControl } from '@so360/design-system';
import { useBusinessSettings, useShell } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import REWidgets from '../components/dashboard/REWidgets';
import { onLeadsChanged } from '../utils/leadEvents';
import { parseStoredTimestamp, dueDateCalendarDay, hasTimeComponent } from '../utils/datetime';
import { RE_FLAGS, useCrmFeatureFlag } from '../hooks/useCrmFeatureFlag';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import {
    DASHBOARD_WIDGET_LABELS,
    DashboardWidgetKey,
    layoutRows,
    visibleWidgets,
} from '../utils/dashboardLayout';
import LeadLayoutSettingsPanel from './components/LeadLayoutSettingsPanel';

/**
 * Derive a reminder's schedule state from its due instant.
 *
 * The card previously hardcoded "Upcoming", which was wrong for every overdue
 * reminder — the one case a user most needs flagged.
 */
export function reminderState(dueDate: string | null | undefined, now: Date = new Date()) {
    if (!dueDate) return { label: 'No date', dot: 'bg-fg-subtle' };
    const due = parseStoredTimestamp(dueDate);
    if (isNaN(due.getTime())) return { label: 'No date', dot: 'bg-fg-subtle' };
    // A task due "20 Aug" with no time is not overdue at one minute past
    // midnight — it has the whole day. Only a task with a chosen time expires
    // at that moment.
    const deadline = hasTimeComponent(dueDate)
        ? due
        : new Date(`${dueDateCalendarDay(dueDate)}T23:59:59`);
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs < 0) return { label: 'Overdue', dot: 'bg-danger' };
    if (diffMs <= 60 * 60 * 1000) return { label: 'Due soon', dot: 'bg-warning' };
    return { label: 'Upcoming', dot: 'bg-warning' };
}

const DashboardPage = () => {
    const formatters = useCRMFormatters();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<'yearly' | 'quarterly' | 'monthly' | 'weekly'>('yearly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(() => {
        const month = new Date().getMonth() + 1;
        return Math.ceil(month / 3); // Current quarter
    });
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [week, setWeek] = useState(() => {
        const now = new Date();
        const jan4 = new Date(now.getFullYear(), 0, 4);
        const startOfWeek1 = new Date(jan4);
        startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
        return Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    });
    const { settings } = useBusinessSettings();
    const { isModuleEnabled, isFeatureHidden } = useShell();
    const isDailyStoreEnabled = isModuleEnabled('dailystore');
    const showPipeline = !isFeatureHidden?.('submodule:crm:pipeline');
    const showTasks    = !isFeatureHidden?.('submodule:crm:tasks');
    const showLeads    = !isFeatureHidden?.('submodule:crm:leads');
    // RE §31 — per-user widget order / visibility (off unless flagged).
    const customizeEnabled = useCrmFeatureFlag(RE_FLAGS.DASHBOARD_CUSTOMIZE);
    const dashLayout = useDashboardLayout(customizeEnabled);
    const [showCustomize, setShowCustomize] = useState(false);

    const [commerceKPIs, setCommerceKPIs] = useState<{
        revenue: number; orderCount: number; aov: number;
        repeatPurchaseRate: number; refundRate: number;
        orderChartData: { labels: string[]; values: number[] };
    } | null>(null);
    const [isCommerceLoading, setIsCommerceLoading] = useState(false);

    const fetchStats = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setIsLoading(true);
        try {
            const data = await crmService.getDashboardStats({
                period,
                year,
                quarter: period === 'quarterly' ? quarter : undefined,
                month: period === 'monthly' ? month : undefined,
                week: period === 'weekly' ? week : undefined,
            });
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch dashboard stats', error);
        } finally {
            if (!opts?.silent) setIsLoading(false);
        }
    }, [period, year, quarter, month, week]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Deleting or restoring a lead changes counts, pipeline/stage totals and
    // conversion metrics. The backend already excludes soft-deleted leads from
    // every query — this re-read is what makes the dashboard show it without a
    // manual refresh. Silent: the numbers update in place, no loading flash.
    useEffect(() => onLeadsChanged(() => { void fetchStats({ silent: true }); }), [fetchStats]);

    useEffect(() => {
        if (!isDailyStoreEnabled) return;
        const fetchCommerce = async () => {
            setIsCommerceLoading(true);
            try {
                const data = await crmService.getCommerceKPIs({
                    period,
                    year,
                    quarter: period === 'quarterly' ? quarter : undefined,
                    month: period === 'monthly' ? month : undefined,
                    week: period === 'weekly' ? week : undefined,
                });
                setCommerceKPIs(data);
            } catch (err) {
                console.error('Failed to fetch commerce KPIs', err);
            } finally {
                setIsCommerceLoading(false);
            }
        };
        fetchCommerce();
    }, [isDailyStoreEnabled, period, year, quarter, month, week]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-fg-muted gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading insights...</span>
            </div>
        );
    }

    const { financials, counts, teamStats, monthlyRevenue, chartLabels, reminders } = stats;
    const revenueLabels = chartLabels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const formatCurrency = (amount: number) => {
        const locale = settings?.document_language || 'en-US';
        const currency = settings?.base_currency?.toUpperCase();

        if (currency) {
            try {
                return new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 0,
                }).format(amount);
            } catch {
                return `${currency} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)}`;
            }
        }

        return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
    };

    const maxRevenue = Math.max(...monthlyRevenue, 1);
    const maxOrders = Math.max(...(commerceKPIs?.orderChartData?.values ?? [0]), 1);
    const maxActivity = Math.max(...teamStats.map((s: any) => s.activityCount), 1);

    // RE §31 — every dashboard widget by key, rendered below in the user's
    // saved order. With the customize flag off the layout is the default,
    // which is the original page order, so nothing changes for those tenants.
    const widgetNodes: Record<DashboardWidgetKey, React.ReactNode> = {
        kpis: (
            <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-nb-3">
                {/* Deal Revenue — gated: deals are a B2B/Both concept */}
                {showPipeline && (
                    <KpiCard
                        label="Deal Revenue"
                        icon={DollarSign}
                        value={<>{formatCurrency(financials.totalRevenue)}
                            {financials.accountingRevenue != null ? (
                                <span className="block mt-1 text-xs font-normal"><span className="text-fg-muted">Booked: </span><span className="text-success">{formatCurrency(financials.accountingRevenue)}</span></span>
                            ) : (
                                <span className="block mt-1 text-xs font-normal text-fg-muted">From won deals</span>
                            )}</>}
                    />
                )}

                {showPipeline && (
                    <KpiCard
                        label="Pipeline Value"
                        icon={TrendingUp}
                        value={<>{formatCurrency(financials.pipelineValue)}
                            <span className="block mt-1 text-xs font-normal text-fg-muted">{counts.deals} Active Deals · Projected revenue</span></>}
                    />
                )}

                {showPipeline && (
                    <KpiCard
                        label="Win Rate"
                        icon={BarChart3}
                        value={<>{financials.winRate.toFixed(1)}%
                            <span className="block mt-1 text-xs font-normal text-fg-muted">AVG Deal Closure</span></>}
                    />
                )}

                {showPipeline && (
                    <KpiCard
                        label="Avg Deal Size"
                        icon={Briefcase}
                        value={<>{formatCurrency(financials.avgDealSize)}
                            <span className="block mt-1 text-xs font-normal text-fg-muted">Per closed-won deal</span></>}
                    />
                )}
            </div>
            </>
        ),
        commerce: (
            <>
            {/* Commerce Performance — DailyStore gated */}
            {isDailyStoreEnabled && (
                <Card className="min-w-0">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ShoppingBag size={16} className="text-primary" />
                        </div>
                        <h2 className="text-xs font-semibold text-fg-subtle">
                            Commerce Performance
                        </h2>
                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                            DailyStore
                        </span>
                        {isCommerceLoading && <Loader2 size={12} className="animate-spin text-fg-muted ml-auto" />}
                    </div>

                    <div className="grid grid-cols-2 wc-medium:grid-cols-3 lg:grid-cols-5 gap-nb-3">
                        {/* 1. Ecommerce Revenue */}
                        <div className="border-l border-line pl-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3 text-primary">
                                    <div className="p-1.5 bg-primary/10 rounded-lg"><DollarSign size={16} /></div>
                                    <span className="text-xs font-semibold text-fg-muted">Revenue</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-fg">
                                    {formatCurrency(commerceKPIs?.revenue ?? 0)}
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 font-medium">Recognized (paid)</p>
                            </div>
                        </div>

                        {/* 2. Orders Count */}
                        <div className="border-l border-line pl-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3 text-info">
                                    <div className="p-1.5 bg-info/10 rounded-lg"><Package size={16} /></div>
                                    <span className="text-xs font-semibold text-fg-muted">Orders</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-fg">
                                    {(commerceKPIs?.orderCount ?? 0).toLocaleString()}
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 font-medium">Total orders placed</p>
                            </div>
                        </div>

                        {/* 3. AOV */}
                        <div className="border-l border-line pl-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3 text-primary">
                                    <div className="p-1.5 bg-primary/10 rounded-lg"><BarChart3 size={16} /></div>
                                    <span className="text-xs font-semibold text-fg-muted">AOV</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-fg">
                                    {formatCurrency(commerceKPIs?.aov ?? 0)}
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 font-medium">Avg order value</p>
                            </div>
                        </div>

                        {/* 4. Repeat Purchase % */}
                        <div className="border-l border-line pl-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3 text-success">
                                    <div className="p-1.5 bg-success/10 rounded-lg"><Users size={16} /></div>
                                    <span className="text-xs font-semibold text-fg-muted">Repeat</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-fg">
                                    {(commerceKPIs?.repeatPurchaseRate ?? 0).toFixed(1)}%
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 font-medium">Repeat purchase rate</p>
                            </div>
                        </div>

                        {/* 5. Refund % */}
                        <div className="border-l border-line pl-4">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3 text-danger">
                                    <div className="p-1.5 bg-danger/10 rounded-lg"><TrendingUp size={16} className="rotate-180" /></div>
                                    <span className="text-xs font-semibold text-fg-muted">Refund</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-fg">
                                    {(commerceKPIs?.refundRate ?? 0).toFixed(1)}%
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 font-medium">Refund rate</p>
                            </div>
                        </div>
                    </div>

                    {/* Orders Distribution chart */}
                    {commerceKPIs?.orderChartData && commerceKPIs.orderChartData.values.length > 0 && (
                        <div className="mt-6 border-t border-line pt-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-base font-semibold text-fg">Orders Distribution</h3>
                                    <p className="text-xs text-fg-muted font-bold mt-1">Order volume by period</p>
                                </div>
                                <div className="px-3 py-1 bg-fg-muted/15 rounded-lg flex items-center gap-2 text-xs font-bold text-fg-subtle">
                                    <div className="w-2 h-2 rounded-full bg-info" /> DailyStore Orders
                                </div>
                            </div>

                            <div className="h-48 flex items-end justify-between gap-2 px-4 relative">
                                {/* Grid lines */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                                    <div className="w-full h-px bg-fg-muted/40 border-t border-dashed border-line" />
                                    <div className="w-full h-px bg-fg-muted/40 border-t border-dashed border-line" />
                                    <div className="w-full h-px bg-fg-muted/40 border-t border-dashed border-line" />
                                    <div className="w-full h-px bg-fg-muted/40 border-t border-dashed border-line" />
                                </div>

                                {commerceKPIs.orderChartData.values.map((val: number, idx: number) => {
                                    const heightPct = Math.max((val / maxOrders) * 100, 4);
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col justify-end group relative h-full">
                                            <div
                                                className="w-full bg-info/20 border-t-2 border-info rounded-t-sm hover:bg-info/40 transition-all relative group-hover:"
                                                style={{ height: `${heightPct}%` }}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-fg/90 text-primary-fg text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                    {val} orders
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-fg-muted text-center mt-3 group-hover:text-info transition-colors">
                                                {commerceKPIs.orderChartData.labels[idx]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Card>
            )}
            </>
        ),
        re_widgets: (
            <>
            {/* Real-estate widgets — renders nothing unless submodule:crm:re_widgets is on */}
            <REWidgets />
            </>
        ),
        reminders: (
            <>
            {/* Active Reminders Row */}
            {showTasks && (
            <Card title="Active Reminders">
                <div className="flex items-center justify-between mb-4">
                    <Link to="../tasks" className="text-xs font-semibold text-primary hover:text-primary transition-colors">View All Tasks</Link>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {reminders.length > 0 ? reminders.map((task: any) => (
                        <div key={task.id} className="flex-shrink-0 w-72 flex flex-col gap-2">
                        <Link
                            to={`../tasks/${task.id}`}
                            className="bg-surface-sunken p-4 rounded-nb hover:bg-surface-raised transition-all group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${reminderState(task.due_date).dot} animate-pulse`} />
                                    <span className="text-xs font-semibold text-fg-subtle">{reminderState(task.due_date).label}</span>
                                </div>
                            </div>
                            <h4 className="text-sm font-bold text-fg group-hover:text-primary transition-colors truncate mb-1">{task.title}</h4>
                            {/* Date, and the time ONLY when the user actually chose one.
                                Rendering the clock unconditionally turned every date-only
                                task into a reminder for "5:30 AM" — the org-timezone
                                reading of the UTC midnight such a task is stored at. */}
                            <div className="flex items-center gap-1.5 text-xs font-bold text-fg-subtle mb-2">
                                <Calendar size={11} className="text-fg-subtle" />
                                <span>{formatters.formatDate(dueDateCalendarDay(task.due_date), { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                {hasTimeComponent(task.due_date) && (
                                    <>
                                        <span className="text-fg-muted">·</span>
                                        <span className="text-fg-subtle">{formatters.formatDate(task.due_date, { hour: 'numeric', minute: '2-digit' })}</span>
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-fg-subtle line-clamp-1 mb-3">{task.description || "No description provided"}</p>
                            <div className="flex items-center gap-2 mt-auto pt-3 border-t border-line">
                                <div className="w-5 h-5 rounded-full bg-fg-muted/30 flex items-center justify-center text-xs font-semibold border border-line">
                                    {task.assigned_to?.avatar_url ? (
                                        <img src={task.assigned_to.avatar_url} className="w-full h-full rounded-full" />
                                    ) : task.assigned_to?.full_name?.charAt(0)}
                                </div>
                                <span className="text-xs font-bold text-fg-subtle truncate">{task.assigned_to?.full_name}</span>
                            </div>
                        </Link>
                        {task.deal_id && (
                            <CrossLinkChip type="crm.deal" id={task.deal_id} label={task.deal_name || task.deal?.name} compact />
                        )}
                        </div>
                    )) : (
                        <div className="w-full py-8 text-center bg-surface-sunken border border-line rounded-nb">
                            <p className="text-xs text-fg-muted font-bold">No active reminders</p>
                        </div>
                    )}
                </div>
            </Card>
            )}
            </>
        ),
        revenue: (
            <>
            <div className={`grid grid-cols-1 ${showLeads ? 'lg:grid-cols-12' : ''} gap-nb-3`}>
                {/* Revenue Chart */}
                <Card title="Revenue Performance" className={`${showLeads ? 'lg:col-span-8' : ''} min-w-0`}>
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <p className="text-xs text-fg-muted font-bold mt-1">Monthly Revenue Distribution</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-fg-subtle">
                            <div className="px-3 py-1 bg-fg-muted/15 rounded-lg flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" /> Current Year
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-2 px-4 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                            <div className="w-full h-px bg-line border-t border-dashed" />
                            <div className="w-full h-px bg-line border-t border-dashed" />
                            <div className="w-full h-px bg-line border-t border-dashed" />
                            <div className="w-full h-px bg-line border-t border-dashed" />
                        </div>

                        {monthlyRevenue.map((val: number, idx: number) => {
                            const heightPercentage = Math.max((val / maxRevenue) * 100, 4);

                            return (
                                <div key={idx} className="flex-1 flex flex-col justify-end group relative h-full">
                                    <div
                                        className="w-full bg-primary/20 border-t-2 border-primary rounded-t-sm hover:bg-primary/40 transition-all relative group-hover:"
                                        style={{ height: `${heightPercentage}%` }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-fg/90 text-primary-fg text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                            {formatCurrency(val)}
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-fg-muted text-center mt-3 group-hover:text-primary transition-colors">{revenueLabels[idx]}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Team Leaderboard */}
                {showLeads && <Card title="Top Performers" className="lg:col-span-4 min-w-0 overflow-hidden flex flex-col">
                    <p className="text-xs text-fg-muted font-bold mb-4">Revenue Leaders</p>

                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {teamStats.length === 0 && (
                            <div className="h-full min-h-[140px] flex flex-col items-center justify-center gap-2 text-center px-4 bg-surface-sunken border border-line rounded-xl">
                                <UserIcon size={18} className="text-fg-muted" />
                                <p className="text-xs font-bold text-fg-subtle">No revenue attributed yet</p>
                                <p className="text-xs text-fg-muted leading-relaxed">Close a deal with an owner assigned and reps will rank here.</p>
                                <Link to="../pipeline" className="mt-1 text-xs font-semibold text-primary hover:text-primary transition-colors">Open pipeline</Link>
                            </div>
                        )}
                        {teamStats.map((stat: any, index: number) => (
                            <div key={stat.user.id} className="flex items-center gap-4 p-3 rounded-nb bg-surface-sunken hover:bg-surface-raised transition-all group">
                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-semibold text-xs ${index === 0 ? 'bg-warning text-primary-fg shadow-lg shadow-warning/20' :
                                    index === 1 ? 'bg-fg-muted/40 text-fg-subtle' :
                                        index === 2 ? 'bg-fg-muted/25 text-fg-subtle' :
                                            'bg-transparent text-fg-subtle'
                                    }`}>
                                    {index + 1}
                                </div>

                                <div className="w-10 h-10 rounded-full bg-fg-muted/30 flex items-center justify-center overflow-hidden border border-line">
                                    {stat.user.avatar_url ? (
                                        <img src={stat.user.avatar_url} alt={stat.user.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-bold text-fg-subtle">{stat.user.full_name?.charAt(0)}</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-fg truncate group-hover:text-primary transition-colors">{stat.user.full_name}</h4>
                                    <div className="flex items-center gap-3 text-xs font-medium text-fg-muted mt-0.5">
                                        <span>{stat.dealCount} Deals</span>
                                        <span className="w-1 h-1 bg-fg-muted/50 rounded-full" />
                                        <span>{stat.activeLeads} Leads</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="block text-sm font-semibold text-success">{formatCurrency(stat.revenue)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>}
            </div>
            </>
        ),
        performance: (
            <>
            {/* Employee Performance Visualization — a per-rep breakdown has nothing
                to say without reps, so it stays hidden rather than reserving a
                full-width band of empty cards. */}
            {showPipeline && teamStats.length > 0 && <Card title="Performance Analytics" className="relative overflow-hidden">
                <div className="relative">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <p className="text-xs text-fg-muted font-bold mt-1">Activity vs. Conversion Efficiency</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 lg:grid-cols-4 gap-nb-3">
                        {teamStats.slice(0, 4).map((stat: any) => (
                            <div key={stat.user.id} className="border-t border-line pt-4 hover:border-line transition-all shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-fg-muted/30 flex items-center justify-center overflow-hidden">
                                        {stat.user.avatar_url ? <img src={stat.user.avatar_url} /> : stat.user.full_name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-fg">{stat.user.full_name}</span>
                                        <span className="text-xs font-semibold text-fg-muted">{stat.user.role || 'Sales Rep'}</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                                            <span className="text-fg-muted">Activity Level</span>
                                            <span className="text-primary">{stat.activityCount} pts</span>
                                        </div>
                                        <div className="h-1.5 bg-fg-muted/25 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-1000"
                                                style={{ width: `${(stat.activityCount / maxActivity) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                                            <span className="text-fg-muted">Conversion Rate</span>
                                            <span className="text-success">{stat.conversionRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-fg-muted/25 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-success to-success rounded-full transition-all duration-1000"
                                                style={{ width: `${Math.min(stat.conversionRate * 2, 100)}%` }} // Scaling for visual impact
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-2 mt-6">
                                    <div className="bg-fg-muted/10 p-2 rounded-lg text-center">
                                        <div className="text-xs font-semibold text-fg-muted mb-0.5">Won</div>
                                        <div className="text-sm font-semibold text-fg">{stat.dealCount}</div>
                                    </div>
                                    <div className="bg-fg-muted/10 p-2 rounded-lg text-center">
                                        <div className="text-xs font-semibold text-fg-muted mb-0.5">Leads</div>
                                        <div className="text-sm font-semibold text-fg">{stat.activeLeads}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>}
            </>
        ),
    };

    return (
        <DashboardPageTemplate
            title="Executive Overview"
            description={`Sales performance and financial insights for ${
                            period === 'yearly'
                                ? `${year}`
                                : period === 'quarterly'
                                    ? `Q${quarter} ${year}`
                                    : period === 'weekly'
                                        ? (() => {
                                            const jan4 = new Date(year, 0, 4);
                                            const startOfWeek1 = new Date(jan4);
                                            startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                                            const wStart = new Date(startOfWeek1);
                                            wStart.setDate(startOfWeek1.getDate() + (week - 1) * 7);
                                            const wEnd = new Date(wStart);
                                            wEnd.setDate(wStart.getDate() + 6);
                                            const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                                            return `Week ${week} · ${fmt(wStart)} – ${fmt(wEnd)}`;
                                        })()
                                        : `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}`}
            filters={
                <>
                    {customizeEnabled && (
                        <button
                            type="button"
                            onClick={() => setShowCustomize(true)}
                            aria-label="Customize dashboard"
                            className="flex items-center gap-1.5 h-nb-control-md px-3 bg-surface border border-line rounded-nb text-xs font-semibold text-fg-subtle hover:text-fg transition-all"
                        >
                            <LayoutDashboard size={14} /> Customize
                        </button>
                    )}
                <SegmentedControl
                    aria-label="Dashboard period"
                    size="sm"
                    value={period}
                    onChange={(v) => setPeriod(v as typeof period)}
                    options={[
                        { value: 'yearly', label: 'Yearly' },
                        { value: 'quarterly', label: 'Quarterly' },
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'weekly', label: 'Weekly' },
                    ]}
                />
                </>
            }
            primary={
                <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
            {visibleWidgets(dashLayout.layout).map((key) => (
                <div key={key} className="min-w-0 lg:col-span-12 flex flex-col gap-nb-3">{widgetNodes[key]}</div>
            ))}
            </div>

                </>
            }
        >
            {customizeEnabled && showCustomize && (
                <LeadLayoutSettingsPanel
                    title="Customize Dashboard"
                    labels={DASHBOARD_WIDGET_LABELS}
                    sections={layoutRows(dashLayout.layout)}
                    onToggleVisible={dashLayout.toggle}
                    onMove={dashLayout.move}
                    onReset={() => { void dashLayout.reset(); }}
                    onClose={() => setShowCustomize(false)}
                />
            )}
        </DashboardPageTemplate>
    );
};

export default DashboardPage;
