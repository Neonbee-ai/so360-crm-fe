import React, { useEffect, useState, useCallback } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { salesTargetService } from '../../services/salesTargetService';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-400';
  if (pct >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function pctBarColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function LeaderboardPage() {
  const shell = useShellBridge();
  const [period, setPeriod] = useState<Period>('week');
  const [leaderboard, setLeaderboard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = useCallback(() => {
    setLoading(true);
    salesTargetService.getLeaderboard(period)
      .then(setLeaderboard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const reps: any[] = leaderboard?.reps ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Leaderboard</h1>
        <p className="text-sm text-slate-400 mt-1">Reps ranked by % of pro-rated target hit</p>
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

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : reps.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg">No rep targets configured yet</p>
          <p className="text-sm mt-1">Assign targets to reps in Settings → Targets</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reps.map((rep: any) => (
            <div
              key={rep.rep_person_id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-4"
            >
              {/* Rank badge */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                rep.rank === 1 ? 'bg-yellow-500 text-yellow-950'
                : rep.rank === 2 ? 'bg-slate-400 text-slate-900'
                : rep.rank === 3 ? 'bg-orange-700 text-orange-100'
                : 'bg-slate-800 text-slate-400'
              }`}>
                {rep.rank}
              </div>

              {/* Rep info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-200 font-medium text-sm truncate">
                    Rep {rep.rep_person_id.slice(-6)}
                  </span>
                  <span className={`text-sm font-bold ${pctColor(rep.pct)}`}>
                    {rep.pct}%
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${pctBarColor(rep.pct)}`}
                    style={{ width: `${Math.min(rep.pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {rep.total_actual} / {rep.total_target} (pro-rated)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
