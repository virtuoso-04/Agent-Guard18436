/**
 * Operator Security Dashboard (Issue 4.6).
 *
 * Aggregate analytics across all recorded sessions:
 *   - Threat volume over time (rolling 7-day bar chart)
 *   - Top attacked domains
 *   - Attack vector breakdown (threat type distribution)
 *   - Session-level summary with severity heat-map
 */

import { useEffect, useState, useMemo } from 'react';
import { threatLogStore } from '@agent-guard/storage';
import type { ThreatEvent } from '@agent-guard/storage/lib/security/types';
import { FiShield, FiTrendingUp, FiGlobe, FiZap, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

interface SecurityDashboardProps {
  isDarkMode?: boolean;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 30);
  }
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

interface DailyBucket {
  label: string;
  date: string;
  count: number;
  critical: number;
}

function buildDailyBuckets(events: ThreatEvent[], days = 7): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayEvents = events.filter(e => new Date(e.timestamp).toISOString().slice(0, 10) === dateStr);
    buckets.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Yest.' : d.toLocaleDateString('en', { weekday: 'short' }),
      date: dateStr,
      count: dayEvents.length,
      critical: dayEvents.filter(e => e.severity === 'critical').length,
    });
  }
  return buckets;
}

function topN<T extends string>(arr: T[], n = 5): Array<{ value: T; count: number }> {
  const counts = arr.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([value, count]) => ({ value: value as T, count }));
}

// ── MiniBar component ─────────────────────────────────────────────────────────

function MiniBar({ bucket, maxCount }: { bucket: DailyBucket; maxCount: number }) {
  const pct = maxCount > 0 ? Math.round((bucket.count / maxCount) * 100) : 0;
  const critPct = bucket.count > 0 ? Math.round((bucket.critical / bucket.count) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="text-[9px] font-mono opacity-50">{bucket.count || ''}</span>
      <div className="w-full flex-1 flex items-end" style={{ minHeight: 40 }}>
        <div
          className="w-full rounded-t-sm overflow-hidden"
          style={{ height: `${Math.max(pct, bucket.count > 0 ? 4 : 0)}%`, minHeight: bucket.count > 0 ? 4 : 0 }}>
          <div className="h-full w-full bg-orange-500/40 relative">
            <div className="absolute bottom-0 left-0 right-0 bg-red-500" style={{ height: `${critPct}%` }} />
          </div>
        </div>
      </div>
      <span className="text-[9px] opacity-40 font-bold">{bucket.label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const SecurityDashboard = ({ isDarkMode = false }: SecurityDashboardProps) => {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setEvents(await threatLogStore.getAll());
    setLoading(false);
  };

  useEffect(() => {
    load();
    return threatLogStore.subscribe(load);
  }, []);

  const daily = useMemo(() => buildDailyBuckets(events), [events]);
  const maxDaily = useMemo(() => Math.max(...daily.map(b => b.count), 1), [daily]);

  const topDomains = useMemo(() => topN(events.map(e => getDomain(e.sourceUrl))), [events]);
  const topTypes = useMemo(() => topN(events.map(e => e.threatType)), [events]);

  const bySeverity = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const e of events) {
      if (e.severity in counts) counts[e.severity as keyof typeof counts]++;
    }
    return counts;
  }, [events]);

  const blockedCount = events.filter(e => e.wasBlocked).length;
  const sanitizedCount = events.length - blockedCount;

  // Unique sessions
  const sessionCount = new Set(events.map(e => e.sessionId)).size;

  return (
    <div className="animate-in fade-in space-y-6 duration-700">
      {/* Header */}
      <div className="settings-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiShield className="size-6 opacity-60" />
            <div>
              <h2 className="text-sm font-bold">Security Dashboard</h2>
              <p className="text-[10px] opacity-40">Aggregate threat analytics across all sessions</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95">
            <FiRefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Threats', value: events.length, icon: FiAlertCircle, color: 'text-orange-500' },
            { label: 'Sessions', value: sessionCount, icon: FiZap, color: 'text-blue-500' },
            { label: 'Blocked', value: blockedCount, icon: FiShield, color: 'text-red-500' },
            { label: 'Sanitized', value: sanitizedCount, icon: FiTrendingUp, color: 'text-green-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl glass p-4 text-center border border-transparent hover:border-current/10 transition-colors">
              <Icon className={`size-5 mx-auto mb-2 ${color} opacity-70`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Threat volume chart */}
      <div className="settings-card">
        <div className="flex items-center gap-2 mb-4 opacity-60">
          <FiTrendingUp className="size-4" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest">7-Day Threat Volume</h3>
          <span className="ml-auto flex items-center gap-2 text-[9px] opacity-50">
            <span className="inline-block h-2 w-2 rounded bg-orange-500/40" /> Total
            <span className="inline-block h-2 w-2 rounded bg-red-500" /> Critical
          </span>
        </div>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {daily.map(b => (
            <MiniBar key={b.date} bucket={b} maxCount={maxDaily} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top attacked domains */}
        <div className="settings-card">
          <div className="flex items-center gap-2 mb-4 opacity-60">
            <FiGlobe className="size-4" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Top Attacked Domains</h3>
          </div>
          {topDomains.length === 0 ? (
            <p className="text-sm opacity-30 italic text-center py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {topDomains.map(({ value, count }) => {
                const pct = Math.round((count / events.length) * 100);
                return (
                  <div key={value}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-mono opacity-70 truncate max-w-[70%]">{value}</span>
                      <span className="text-[9px] font-bold opacity-50">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-current/10 overflow-hidden">
                      <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attack vector breakdown */}
        <div className="settings-card">
          <div className="flex items-center gap-2 mb-4 opacity-60">
            <FiZap className="size-4" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Attack Vectors</h3>
          </div>
          {topTypes.length === 0 ? (
            <p className="text-sm opacity-30 italic text-center py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {topTypes.map(({ value, count }) => {
                const pct = Math.round((count / events.length) * 100);
                return (
                  <div key={value}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-mono opacity-70">{value.replace(/_/g, ' ')}</span>
                      <span className="text-[9px] font-bold opacity-50">{count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-current/10 overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="settings-card">
        <div className="flex items-center gap-2 mb-4 opacity-60">
          <FiAlertCircle className="size-4" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest">Severity Breakdown</h3>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          {(
            [
              { key: 'critical', label: 'Critical', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
              { key: 'high', label: 'High', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
              { key: 'medium', label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
              { key: 'low', label: 'Low', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
            ] as const
          ).map(({ key, label, color }) => (
            <div key={key} className={`rounded-2xl border p-4 ${color}`}>
              <p className="text-2xl font-bold">{bySeverity[key]}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[9px] opacity-20 font-mono">
        Agent-Guard Security Analytics v1.0 • Data retained in chrome.storage.local
      </p>
    </div>
  );
};
