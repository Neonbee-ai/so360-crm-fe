import React, { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertCircle, Clock, CheckCircle2,
  DollarSign, Zap, Activity, Calendar
} from 'lucide-react';
import { Lead, Deal, Task } from '../types/crm';
import { useCRMFormatters } from '../utils/formatters';

interface ExecutiveSummaryPanelProps {
  lead: Lead;
  deals: Deal[];
  tasks: Task[];
}

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'amber' | 'purple';
}

interface RiskBadge {
  type: 'overdue' | 'stalled' | 'no_activity';
  label: string;
  icon: React.ReactNode;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, trend, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  const trendColorClasses = {
    up: 'text-emerald-400',
    down: 'text-rose-400',
    neutral: 'text-slate-400',
  };

  const trendBgClasses = {
    up: 'bg-emerald-500/10',
    down: 'bg-rose-500/10',
    neutral: 'bg-slate-500/10',
  };

  return (
    <div className={`border rounded-2xl p-4 flex flex-col gap-3 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="p-2 bg-slate-900/50 rounded-lg">{icon}</div>
      </div>
      <div>
        <div className="text-2xl font-black text-slate-50 leading-tight">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trendColorClasses[trend.direction]}`}>
            {trend.direction === 'up' && <TrendingUp size={12} />}
            {trend.direction === 'down' && <TrendingDown size={12} />}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const RiskBadgeComponent: React.FC<{ badge: RiskBadge }> = ({ badge }) => {
  const colorMap = {
    overdue: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    stalled: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    no_activity: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${colorMap[badge.type]}`}>
      {badge.icon}
      <span>{badge.label}</span>
    </div>
  );
};

export const ExecutiveSummaryPanel: React.FC<ExecutiveSummaryPanelProps> = ({ lead, deals, tasks }) => {
  const formatters = useCRMFormatters();

  // Calculate KPIs
  const kpis = useMemo(() => {
    // Total Deal Value
    const totalDealValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

    // Pipeline Health - count by stage
    const pipelineByStage = deals.reduce((acc, deal) => {
      const stage = deal.stage || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pipelineHealthLabel = Object.entries(pipelineByStage)
      .slice(0, 3)
      .map(([stage, count]) => `${count} ${stage}`)
      .join(' • ') || 'No deals';

    // Engagement Score and trend - based on last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentActivities = (lead.activities || []).filter(
      a => new Date(a.created_at) >= thirtyDaysAgo
    );
    const priorActivities = (lead.activities || []).filter(
      a => new Date(a.created_at) >= sixtyDaysAgo && new Date(a.created_at) < thirtyDaysAgo
    );

    const engagementScore = Math.min(100, Math.round((recentActivities.length / 30) * 100));
    const engagementTrend =
      priorActivities.length === 0
        ? { direction: 'neutral' as const, value: 'First month' }
        : recentActivities.length > priorActivities.length
        ? {
            direction: 'up' as const,
            value: `+${recentActivities.length - priorActivities.length} from last month`,
          }
        : recentActivities.length < priorActivities.length
        ? {
            direction: 'down' as const,
            value: `${recentActivities.length - priorActivities.length} from last month`,
          }
        : { direction: 'neutral' as const, value: 'Same as last month' };

    // Last activity date
    const lastActivity = [...(lead.activities || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const lastActivityDate = lastActivity
      ? new Date(lastActivity.created_at)
      : null;

    return {
      totalDealValue,
      pipelineHealthLabel,
      engagementScore,
      engagementTrend,
      lastActivityDate,
      recentActivitiesCount: recentActivities.length,
      dealCount: deals.length,
    };
  }, [lead, deals]);

  // Calculate Risk Badges
  const riskBadges = useMemo(() => {
    const badges: RiskBadge[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Check for overdue tasks
    const overdueTasks = tasks.filter(
      t => t.status !== 'DONE' && new Date(t.due_date) < now
    );
    if (overdueTasks.length > 0) {
      badges.push({
        type: 'overdue',
        label: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`,
        icon: <AlertCircle size={12} />,
      });
    }

    // Check for stalled deals (no activity > 30 days)
    const stalledDeals = deals.filter(deal => {
      if (deal.stage === 'Won' || deal.stage === 'Lost') return false; // Terminal stages
      const dealActivities = (deal.activities || []).filter(
        a => new Date(a.created_at) >= thirtyDaysAgo
      );
      return dealActivities.length === 0;
    });
    if (stalledDeals.length > 0) {
      badges.push({
        type: 'stalled',
        label: `${stalledDeals.length} Stalled Deal${stalledDeals.length > 1 ? 's' : ''}`,
        icon: <Clock size={12} />,
      });
    }

    // Check for no recent activity (> 7 days)
    const recentActivities = (lead.activities || []).filter(
      a => new Date(a.created_at) >= sevenDaysAgo
    );
    if (recentActivities.length === 0) {
      badges.push({
        type: 'no_activity',
        label: 'No Activity (7d)',
        icon: <Calendar size={12} />,
      });
    }

    return badges;
  }, [lead, deals, tasks]);

  const dealCount = deals.length;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Activity size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Executive Summary
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {dealCount} {dealCount === 1 ? 'deal' : 'deals'} • {kpis.recentActivitiesCount} activities (30d)
            </p>
          </div>
        </div>
        {kpis.lastActivityDate && (
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Last Activity
            </span>
            <span className="text-xs text-slate-400 font-bold mt-1 block">
              {formatters.formatDate(kpis.lastActivityDate.toISOString())}
            </span>
          </div>
        )}
      </div>

      {/* Risk Badges */}
      {riskBadges.length > 0 && (
        <div className="mb-6 pb-6 border-b border-slate-800">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            Active Risks
          </p>
          <div className="flex flex-wrap gap-2">
            {riskBadges.map((badge, idx) => (
              <RiskBadgeComponent key={idx} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Deal Value"
          value={formatters.formatCurrency(kpis.totalDealValue)}
          color="blue"
          icon={<DollarSign size={16} className="text-blue-400" />}
        />

        <KPICard
          label="Pipeline Health"
          value={
            <span className="text-sm truncate" title={kpis.pipelineHealthLabel}>
              {kpis.pipelineHealthLabel}
            </span>
          }
          color="emerald"
          icon={<CheckCircle2 size={16} className="text-emerald-400" />}
        />

        <KPICard
          label="Engagement Score"
          value={`${kpis.engagementScore}/100`}
          trend={kpis.engagementTrend}
          color="amber"
          icon={<Zap size={16} className="text-amber-400 fill-amber-400" />}
        />

        <KPICard
          label="Sales Intelligence"
          value={
            <div className="flex flex-col gap-2">
              <span className="text-sm">
                {kpis.lastActivityDate
                  ? `${Math.floor((Date.now() - kpis.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))}d ago`
                  : 'Never'}
              </span>
              <span className="text-[10px] text-slate-400">Last touch</span>
            </div>
          }
          color="purple"
          icon={<Activity size={16} className="text-purple-400" />}
        />
      </div>
    </div>
  );
};

export default ExecutiveSummaryPanel;
