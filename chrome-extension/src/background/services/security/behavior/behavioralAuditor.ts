/**
 * BehavioralAuditor — lightweight real-time action anomaly detector.
 *
 * Provides a simple per-session recorder that detects two attack patterns:
 *  1. Velocity spike   — more than MAX_ACTIONS_PER_WINDOW distinct actions in
 *                        WINDOW_MS milliseconds (e.g. a script hammering clicks).
 *  2. Repetition loop  — the same (type, context-key) pair fired more than
 *                        MAX_REPEATS consecutive times (stuck agent / loop injection).
 *
 * Unlike BehaviorAnalyzer (which tracks step-indexed action sequences for
 * post-hoc reporting), BehavioralAuditor is designed to be called inline
 * during execution and returns an anomaly verdict immediately.
 */

export interface AuditEntry {
  type: string;
  contextKey: string;
  timestamp: number;
}

export interface AnomalyResult {
  detected: boolean;
  reason: string;
}

const MAX_ACTIONS_PER_WINDOW = 10;
const WINDOW_MS = 1000;
const MAX_REPEATS = 5;

export class BehavioralAuditor {
  private readonly log: AuditEntry[] = [];

  /**
   * Record an action and immediately check for anomalies.
   * @param type     Action type (e.g. 'click', 'navigate')
   * @param context  Identifying context object; used to detect repetition loops
   * @returns        AnomalyResult — { detected, reason }
   */
  recordAction(type: string, context: Record<string, string> = {}): AnomalyResult {
    const now = Date.now();
    const contextKey = Object.entries(context)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    this.log.push({ type, contextKey, timestamp: now });

    // --- Velocity check (sliding window) ---
    const windowStart = now - WINDOW_MS;
    const recentCount = this.log.filter(e => e.timestamp >= windowStart).length;
    if (recentCount > MAX_ACTIONS_PER_WINDOW) {
      return { detected: true, reason: `velocity too high (${recentCount} actions in last ${WINDOW_MS}ms)` };
    }

    // --- Repetition loop check ---
    const key = `${type}:${contextKey}`;
    let streak = 0;
    for (let i = this.log.length - 1; i >= 0; i--) {
      const e = this.log[i];
      if (`${e.type}:${e.contextKey}` === key) {
        streak++;
      } else {
        break;
      }
    }
    if (streak > MAX_REPEATS) {
      return { detected: true, reason: `velocity too high — repetitive action loop detected (${streak} repeats)` };
    }

    return { detected: false, reason: '' };
  }
}
