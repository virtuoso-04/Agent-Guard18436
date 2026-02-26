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

const LEVEL_CONFIG: Record<SecurityLevel, { label: string; bg: string; text: string; border: string; pulse: boolean }> =
  {
    [SecurityLevel.NORMAL]: {
      label: 'Secure',
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-300 dark:border-green-700',
      pulse: false,
    },
    [SecurityLevel.ELEVATED]: {
      label: 'Elevated',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-300 dark:border-yellow-700',
      pulse: false,
    },
    [SecurityLevel.HIGH]: {
      label: 'High Risk',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-300 dark:border-orange-700',
      pulse: false,
    },
    [SecurityLevel.CRITICAL]: {
      label: 'Critical',
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-300 dark:border-red-700',
      pulse: true,
    },
  };

export default function SecurityBadge({ level, detectionCount, eventSummary = [] }: SecurityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close tooltip when user clicks outside the badge container
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

  // Don't render anything when there are no threats and we are at NORMAL level
  if (level === SecurityLevel.NORMAL && detectionCount === 0) {
    return null;
  }

  const config = LEVEL_CONFIG[level];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        aria-haspopup="true"
        aria-label={`Security level: ${config.label}. ${detectionCount} threat(s) detected. Click for details.`}
        className={[
          'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
          config.bg,
          config.text,
          config.border,
          // motion-safe: respects prefers-reduced-motion OS setting
          config.pulse ? 'motion-safe:animate-pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}>
        {/* Dot indicator */}
        <span
          className={[
            'inline-block h-2 w-2 rounded-full',
            level === SecurityLevel.NORMAL ? 'bg-green-500' : '',
            level === SecurityLevel.ELEVATED ? 'bg-yellow-500' : '',
            level === SecurityLevel.HIGH ? 'bg-orange-500' : '',
            level === SecurityLevel.CRITICAL ? 'bg-red-500' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <span>{config.label}</span>
        {detectionCount > 0 && (
          <span className="ml-0.5 rounded-full bg-white/50 px-1 dark:bg-black/20">{detectionCount}</span>
        )}
      </button>

      {/* Expandable threat summary */}
      {expanded && (
        <div
          className={[
            'absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border p-3 shadow-lg',
            'bg-white dark:bg-gray-800',
            config.border,
          ].join(' ')}>
          <p className={`mb-2 text-xs font-semibold ${config.text}`}>Security Level: {config.label}</p>
          {eventSummary.length > 0 ? (
            <ul className="space-y-1">
              {eventSummary.map((event, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                  • {event}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {detectionCount} threat(s) detected. Check the Security tab in settings for details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
