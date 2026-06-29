import React, { useEffect, useState, useCallback } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { salesTargetService } from '../../services/salesTargetService';

type Period = 'day' | 'week' | 'month' | 'year';
type Color = 'green' | 'yellow' | 'red';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

const COLOR_CLASSES: Record<Color, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const COLOR_TEXT: Record<Color, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

const COLOR_BORDER: Record<Color, string> = {
  green: 'border-green-700',
  yellow: 'border-yellow-700',
  red: 'border-red-700',
};

function ProgressBar({ actual, target, color }: { actual: number; target: number; color: Color }) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{actual} / {target}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${COLOR_CLASSES[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MyScorecardPage() {
  const shell = useShellBridge();
  const [period, setPeriod] = useState<Period>('week');
  const [scorecard, setScorecard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<Record<string, boolean>>({});
  const [customCount, setCustomCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = useCallback(() => {
    setLoading(true);
    salesTargetService.getScorecard({ period })
      .then(setScorecard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleLog = async (taskTypeId: string, count: number) => {
    setLogging(l => ({ ...l, [taskTypeId]: true }));
    try {
      await salesTargetService.logActivity({ task_type_id: taskTypeId, count });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLogging(l => ({ ...l, [taskTypeId]: false }));
    }
  };

  const items: any[] = scorecard?.items ?? [];
  const greenCount = items.filter(i => i.color === 'green').length;
  const redCount = items.filter(i => i.color === 'red').length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">My Scorecard</h1>
        <p className="text-sm text-slate-400 mt-1">Your activity vs target at a glance</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Summary pills */}
      {!loading && items.length > 0 && (
        <div className="flex gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 border border-green-800 rounded-lg text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-green-300 font-medium">{greenCount} on track</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-800 rounded-lg text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-300 font-medium">{redCount} behind</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg">No targets set for you yet</p>
          <p className="text-sm mt-1">Ask your manager to assign activity targets</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div
              key={item.task_type_id}
              className={`bg-slate-900 rounded-xl border p-4 ${COLOR_BORDER[item.color as Color]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_CLASSES[item.color as Color]}`} />
                    <h3 className="text-slate-100 font-medium truncate">{item.task_type_name}</h3>
                  </div>
                  <ProgressBar actual={item.actual} target={item.prorated_target} color={item.color} />
                  <p className="text-xs text-slate-500 mt-1">
                    Full period target: {item.target} {item.unit}
                  </p>
                </div>

                {/* +1 / +N buttons for MANUAL types only */}
                {item.source === 'MANUAL' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min={1}
                      value={customCount[item.task_type_id] ?? 1}
                      onChange={e => setCustomCount(c => ({ ...c, [item.task_type_id]: parseInt(e.target.value) || 1 }))}
                      className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 text-center focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      disabled={logging[item.task_type_id]}
                      onClick={() => handleLog(item.task_type_id, customCount[item.task_type_id] ?? 1)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors"
                    >
                      {logging[item.task_type_id] ? '…' : `+${customCount[item.task_type_id] ?? 1}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
