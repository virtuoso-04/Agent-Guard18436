/**
 * Task-level security state machine (Issue 1.5).
 *
 * The security level escalates as injection attempts are detected:
 *
 *   NORMAL  →  ELEVATED  →  HIGH  →  CRITICAL
 *
 * Escalation rules (default thresholds):
 *   1 TASK_OVERRIDE or PROMPT_INJECTION detection  →  NORMAL → ELEVATED
 *   2nd detection from same task                   →  ELEVATED → HIGH
 *   3 total detections or a history tamper         →  HIGH → CRITICAL
 *
 * At each level the executor and sanitizer apply progressively stricter
 * behaviour (see README / issue #1.5 for full table).
 */

export enum SecurityLevel {
  NORMAL = 0, // Standard guardrails
  ELEVATED = 1, // Strict mode enabled, extra system prompt warning
  HIGH = 2, // Page content token limit halved, vision disabled
  CRITICAL = 3, // Task suspended pending user decision
}

export interface TaskSecurityState {
  level: SecurityLevel;
  /** Total injection detections across all severities in this task */
  injectionCount: number;
  /** Detections of CRITICAL severity (e.g. history tamper) */
  criticalThreatCount: number;
  /** Timestamps for each escalation step */
  elevatedAt?: number;
  highAt?: number;
  criticalAt?: number;
  /** IDs of ThreatEvents that caused each escalation */
  triggeringEvents: string[];
}

/** Escalation thresholds — can be overridden via settings in the future */
export interface EscalationThresholds {
  /** Detections before NORMAL → ELEVATED */
  toElevated: number;
  /** Detections before ELEVATED → HIGH */
  toHigh: number;
  /** Detections before HIGH → CRITICAL */
  toCritical: number;
}

export const DEFAULT_THRESHOLDS: EscalationThresholds = {
  toElevated: 1,
  toHigh: 2,
  toCritical: 3,
};

/** Create a fresh NORMAL security state for a new task */
export function createSecurityState(): TaskSecurityState {
  return {
    level: SecurityLevel.NORMAL,
    injectionCount: 0,
    criticalThreatCount: 0,
    triggeringEvents: [],
  };
}

/**
 * Record a new detection and return the (possibly escalated) state.
 * This function is pure — it returns a new object rather than mutating.
 *
 * @param state       - Current security state
 * @param threatId    - ID of the ThreatEvent that was just logged
 * @param isCritical  - true for history-tamper or DANGEROUS_ACTION threats
 * @param thresholds  - Optional custom escalation thresholds
 * @returns Updated TaskSecurityState
 */
export function recordDetection(
  state: TaskSecurityState,
  threatId: string,
  isCritical = false,
  thresholds: EscalationThresholds = DEFAULT_THRESHOLDS,
): TaskSecurityState {
  const now = Date.now();
  const next: TaskSecurityState = {
    ...state,
    injectionCount: state.injectionCount + 1,
    criticalThreatCount: state.criticalThreatCount + (isCritical ? 1 : 0),
    triggeringEvents: [...state.triggeringEvents, threatId],
  };

  // Critical threats always jump straight to CRITICAL
  if (isCritical && next.level < SecurityLevel.CRITICAL) {
    return { ...next, level: SecurityLevel.CRITICAL, criticalAt: now };
  }

  // Normal escalation ladder
  if (next.level === SecurityLevel.NORMAL && next.injectionCount >= thresholds.toElevated) {
    return { ...next, level: SecurityLevel.ELEVATED, elevatedAt: now };
  }
  if (next.level === SecurityLevel.ELEVATED && next.injectionCount >= thresholds.toHigh) {
    return { ...next, level: SecurityLevel.HIGH, highAt: now };
  }
  if (next.level === SecurityLevel.HIGH && next.injectionCount >= thresholds.toCritical) {
    return { ...next, level: SecurityLevel.CRITICAL, criticalAt: now };
  }

  return next;
}

// Note: display helpers (label/colour) live in SecurityBadge.tsx (LEVEL_CONFIG)
// where they are co-located with the UI that consumes them, avoiding a
// cross-package import from the background service worker to the side panel.
