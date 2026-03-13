/**
 * Poisoning Attempt Timeline UI (Issue 4.4).
 *
 * Per-task security event visualisation — shows the sequence of threat
 * detections within a task as a vertical timeline so operators can see
 * exactly *when* and *where* poisoning attempts occurred.
 */

import { useEffect, useState } from 'react';
import { threatLogStore } from '@extension/storage';
import type { ThreatEvent } from '@extension/storage/lib/security/types';
import { FiShield, FiAlertCircle, FiAlertTriangle, FiInfo, FiRefreshCw, FiClock } from 'react-icons/fi';

interface PoisoningTimelineProps {
  isDarkMode?: boolean;
}

interface TaskGroup {
  taskId: string;
  events: ThreatEvent[];
  firstSeen: number;
  lastSeen: number;
  maxSeverity: string;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const SEVERITY_CONFIG = {
  critical: {
    color: 'bg-red-500',
    textColor: 'text-red-500',
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/10',
    label: 'Critical',
    icon: FiAlertCircle,
  },
  high: {
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500/30',
    bgColor: 'bg-orange-500/10',
    label: 'High',
    icon: FiAlertTriangle,
  },
  medium: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    borderColor: 'border-yellow-500/30',
    bgColor: 'bg-yellow-500/10',
    label: 'Medium',
    icon: FiAlertTriangle,
  },
  low: {
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10',
    label: 'Low',
    icon: FiInfo,
  },
} as const;

function groupByTask(events: ThreatEvent[]): TaskGroup[] {
  const map = new Map<string, ThreatEvent[]>();
  for (const e of events) {
    const existing = map.get(e.taskId) ?? [];
    existing.push(e);
    map.set(e.taskId, existing);
  }

  return [...map.entries()]
    .map(([taskId, evts]) => {
      const sorted = evts.sort((a, b) => a.timestamp - b.timestamp);
      const maxSev = evts.reduce((max, e) => {
        return (SEVERITY_ORDER[e.severity] ?? 0) > (SEVERITY_ORDER[max] ?? 0) ? e.severity : max;
      }, 'low');
      return {
        taskId,
        events: sorted,
        firstSeen: sorted[0].timestamp,
        lastSeen: sorted[sorted.length - 1].timestamp,
        maxSeverity: maxSev,
      };
    })
    .sort((a, b) => b.firstSeen - a.firstSeen);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function TaskTimeline({ group, isDarkMode }: { group: TaskGroup; isDarkMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[group.maxSeverity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
  const Icon = cfg.icon;
  const duration = group.lastSeen - group.firstSeen;

  return (
    <div className={`settings-card overflow-hidden border ${cfg.borderColor}`}>
      {/* Task header */}
      <button className="w-full flex items-center gap-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bgColor}`}>
          <Icon className={`size-5 ${cfg.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold font-mono truncate opacity-80">Task {group.taskId.slice(0, 16)}…</p>
          <p className="text-[10px] opacity-40 font-medium">
            {group.events.length} event{group.events.length !== 1 ? 's' : ''} •{' '}
            {new Date(group.firstSeen).toLocaleString()} •{' '}
            {duration > 0 ? `span: ${formatDuration(duration)}` : 'single step'}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-current ${cfg.textColor}`}>
          {cfg.label}
        </span>
        <span className={`text-[10px] opacity-40 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Event timeline */}
      {expanded && (
        <div className="mt-4 ml-5 border-l-2 border-dashed border-current/20 pl-6 space-y-4">
          {group.events.map((evt, i) => {
            const evtCfg = SEVERITY_CONFIG[evt.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
            return (
              <div key={evt.id} className="relative">
                {/* Dot on timeline */}
                <div className={`absolute -left-[1.625rem] top-1.5 h-3 w-3 rounded-full ${evtCfg.color}`} />

                <div className={`rounded-xl p-3 ${evtCfg.bgColor} border ${evtCfg.borderColor}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">
                      Step {evt.stepNumber} • {evt.detectionLayer}
                    </span>
                    <span className="text-[9px] opacity-40 flex items-center gap-1">
                      <FiClock className="size-2.5" />
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={`text-xs font-bold ${evtCfg.textColor}`}>
                    {evt.threatType.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5 truncate" title={evt.sourceUrl}>
                    {evt.sourceUrl}
                  </p>
                  {evt.rawFragment && (
                    <code className="mt-1 block text-[9px] opacity-40 truncate font-mono">
                      {evt.rawFragment.slice(0, 80)}
                    </code>
                  )}
                  <div className="mt-1.5 flex gap-2">
                    <span className={`text-[9px] font-bold uppercase ${evtCfg.textColor}`}>{evtCfg.label}</span>
                    {evt.wasBlocked && <span className="text-[9px] font-bold text-green-500 uppercase">• Blocked</span>}
                    {evt.ruleId && <span className="text-[9px] opacity-30 font-mono">rule:{evt.ruleId}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const PoisoningTimeline = ({ isDarkMode = false }: PoisoningTimelineProps) => {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const all = await threatLogStore.getAll();
    setGroups(groupByTask(all));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return threatLogStore.subscribe(load);
  }, []);

  return (
    <div className="animate-in fade-in space-y-6 duration-700">
      {/* Header */}
      <div className="settings-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiShield className="size-5 opacity-60" />
            <div>
              <h2 className="text-sm font-bold">Poisoning Attempt Timeline</h2>
              <p className="text-[10px] opacity-40 mt-0.5">
                Per-task security event visualisation — expand a task to see the full attack sequence
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95">
            <FiRefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          {(['critical', 'high', 'medium'] as const).map(sev => {
            const count = groups.filter(g => g.maxSeverity === sev).length;
            const c = SEVERITY_CONFIG[sev];
            return (
              <div key={sev} className={`rounded-xl p-3 ${c.bgColor} border ${c.borderColor}`}>
                <p className={`text-2xl font-bold ${c.textColor}`}>{count}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-0.5">{c.label} Tasks</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task timelines */}
      {loading ? (
        <div className="text-center py-12 opacity-30 text-sm italic">Loading timeline…</div>
      ) : groups.length === 0 ? (
        <div className="settings-card text-center py-12">
          <FiShield className="size-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm opacity-30 italic">No poisoning attempts recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <TaskTimeline key={group.taskId} group={group} isDarkMode={isDarkMode} />
          ))}
        </div>
      )}
    </div>
  );
};
