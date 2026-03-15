/**
 * SecurityBadge — persistent security level indicator in the side panel.
 *
 * Displays the current task security level with colour coding:
 *   NORMAL   → green
 *   ELEVATED → yellow
 *   HIGH     → orange
 *   CRITICAL → red (pulsing)
 *
 * Click the badge to expand a threat summary tooltip.
 * The badge resets to NORMAL (hidden) when a new task starts.
 */

import { useState, useEffect, useRef } from 'react';

export enum SecurityLevel {
  NORMAL = 0,
  ELEVATED = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface SecurityBadgeProps {
  level: SecurityLevel;
  /** Number of detections recorded in the current task */
  detectionCount: number;
  /** Human-readable summary of triggering events (shown on expand) */
  eventSummary?: string[];
}

const LEVEL_CONFIG: Record<SecurityLevel, { label: string; color: string; pulse: boolean }> = {
  [SecurityLevel.NORMAL]: {
    label: 'Secure',
    color: 'var(--safe-green)',
    pulse: false,
  },
  [SecurityLevel.ELEVATED]: {
    label: 'Elevated',
    color: 'var(--elevated-yellow)',
    pulse: false,
  },
  [SecurityLevel.HIGH]: {
    label: 'High Risk',
    color: 'var(--high-orange)',
    pulse: false,
  },
  [SecurityLevel.CRITICAL]: {
    label: 'Critical',
    color: 'var(--critical-red)',
    pulse: true,
  },
};

export default function SecurityBadge({ level, detectionCount, eventSummary = [] }: SecurityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  if (level === SecurityLevel.NORMAL && detectionCount === 0) {
    return null;
  }

  const config = LEVEL_CONFIG[level];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setExpanded(prev => !prev)}
        className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider glass transition-all hover:scale-105 active:scale-95 ${config.pulse ? 'animate-pulse' : ''}`}
        style={{ color: config.color, borderColor: config.color }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span>{config.label}</span>
        {detectionCount > 0 && (
          <span className="ml-1 rounded-full bg-black/5 px-1.5 dark:bg-white/10">{detectionCount}</span>
        )}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-2xl glass p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">Security Analysis</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="text-sm font-semibold">{config.label}</span>
          </div>

          <div className="space-y-3">
            {eventSummary.length > 0 ? (
              <ul className="space-y-2">
                {eventSummary.map((event, i) => (
                  <li key={i} className="text-xs leading-relaxed opacity-80">
                    • {event}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed opacity-70">
                {detectionCount} potential threat(s) neutralized. System integrity maintained by Agent Guard.
              </p>
            )}

            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="w-full mt-2 py-2 text-[10px] font-bold uppercase tracking-widest text-guard-primary hover:underline">
              View Detailed Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
