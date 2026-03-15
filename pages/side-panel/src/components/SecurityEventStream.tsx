import { useRef, useEffect } from 'react';
import type { ExecutionState } from '../types/event';

export interface SecurityStreamEntry {
  id: string;
  timestamp: number;
  level: number;
  message: string;
  state: ExecutionState;
}

export interface SecurityEventStreamProps {
  events: SecurityStreamEntry[];
  onClear: (id?: string) => void;
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-safe-green',
  1: 'bg-elevated-yellow',
  2: 'bg-high-orange',
  3: 'bg-critical-red',
};

/**
 * SecurityEventStream — a real-time timeline of security-related events.
 *
 * Displays escalations, phishing detections, and trust boundary crossings
 * in a scrollable, glassmorphic feed.
 */
export default function SecurityEventStream({ events, onClear }: SecurityEventStreamProps) {
  if (events.length === 0) return null;

  // Only show the last 3 events to keep it tidy
  const displayEvents = events.slice(-3);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [displayEvents]);

  return (
    <div id="security-event-stream" role="log" aria-live="polite" aria-label="Security notifications">
      <div ref={streamRef} className="flex flex-col items-center" tabIndex={-1}>
        {displayEvents.map((event, index) => (
          <div
            key={event.id}
            className={`security-toast ${index === displayEvents.length - 1 ? 'new' : ''}`}
            role="status"
            aria-live="polite">
            <div className={`h-2 w-2 rounded-full ${LEVEL_COLORS[event.level] || 'bg-blue-500'}`} />
            <span className="text-xs font-medium tracking-tight">{event.message}</span>
            <button
              onClick={() => onClear(event.id)}
              className="ml-2 text-[10px] opacity-30 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guard-primary"
              aria-label="Dismiss security event">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
