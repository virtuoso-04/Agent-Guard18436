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

  return (
    <div id="security-event-stream">
      <div className="flex flex-col items-center">
        {displayEvents.map((event, index) => (
          <div key={event.id} className={`security-toast ${index === displayEvents.length - 1 ? 'new' : ''}`}>
            <div className={`h-2 w-2 rounded-full ${LEVEL_COLORS[event.level] || 'bg-blue-500'}`} />
            <span className="text-xs font-medium tracking-tight">{event.message}</span>
            <button onClick={() => onClear(event.id)} className="ml-2 text-[10px] opacity-30 hover:opacity-100">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
