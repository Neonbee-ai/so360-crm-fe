import React, { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertCircle, Clock, CheckCircle2,
  DollarSign, Zap, Activity, Calendar
} from 'lucide-react';
import { Badge, Card, CountUp, Grid, GridItem } from '@so360/design-system';
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

const KPICard: React.FC<KPICardProps> = ({ label, value, trend, icon }) => {
  const trendColorClasses = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-fg-subtle',
  };

  const trendBgClasses = {
    up: 'bg-success/10',
    down: 'bg-danger/10',
    neutral: 'bg-fg-muted/10',
  };

  return (
    <div className="flex flex-col gap-nb-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-subtle">{label}</span>
        <div className="p-2 bg-surface-raised rounded-nb">{icon}</div>
      </div>
      <div>
        <div className="text-2xl font-medium text-fg leading-tight"><CountUp value={value} /></div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColorClasses[trend.direction]}`}>
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
  const tone = badge.type === 'overdue' ? 'danger' : badge.type === 'stalled' ? 'warning' : 'neutral';
  return (
    <Badge size="sm" tone={tone}>
      {badge.icon}
      <span>{badge.label}</span>
    </Badge>
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
    <Card
      title="Executive summary"
      actions={
        kpis.lastActivityDate ? (
          <span className="text-xs text-fg-muted">
            Last activity {formatters.formatDate(kpis.lastActivityDate.toISOString())}
          </span>
        ) : undefined
      }
    >
      <p className="text-xs text-fg-muted mb-nb-3">
        {dealCount} {dealCount === 1 ? 'deal' : 'deals'} • {kpis.recentActivitiesCount} activities (30d)
      </p>

      {/* Risk Badges */}
      {riskBadges.length > 0 && (
        <div className="mb-nb-3 pb-nb-3 border-b border-line">
          <p className="text-xs font-medium text-fg-muted mb-3">
            Active risks
          </p>
          <div className="flex flex-wrap gap-2">
            {riskBadges.map((badge, idx) => (
              <RiskBadgeComponent key={idx} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <Grid gap="md">
        <GridItem span={{ md: 4, lg: 3 }}><KPICard
          label="Total deal value"
          value={formatters.formatCurrency(kpis.totalDealValue)}
          color="blue"
          icon={<DollarSign size={16} className="text-primary" />}
        /></GridItem>

        <GridItem span={{ md: 4, lg: 3 }}><KPICard
          label="Pipeline health"
          value={
            <span className="text-sm truncate" title={kpis.pipelineHealthLabel}>
              {kpis.pipelineHealthLabel}
            </span>
          }
          color="emerald"
          icon={<CheckCircle2 size={16} className="text-success" />}
        /></GridItem>

        <GridItem span={{ md: 4, lg: 3 }}><KPICard
          label="Engagement score"
          value={`${kpis.engagementScore}/100`}
          trend={kpis.engagementTrend}
          color="amber"
          icon={<Zap size={16} className="text-warning fill-warning" />}
        /></GridItem>

        <GridItem span={{ md: 4, lg: 3 }}><KPICard
          label="Sales intelligence"
          value={
            <div className="flex flex-col gap-2">
              <span className="text-sm">
                {kpis.lastActivityDate
                  ? `${Math.floor((Date.now() - kpis.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))}d ago`
                  : 'Never'}
              </span>
              <span className="text-xs text-fg-subtle">Last touch</span>
            </div>
          }
          color="purple"
          icon={<Activity size={16} className="text-info" />}
        /></GridItem>
      </Grid>
    </Card>
  );
};

export default ExecutiveSummaryPanel;
