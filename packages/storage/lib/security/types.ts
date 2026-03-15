/**
 * Types for the immutable threat audit log (Issue 1.4).
 *
 * Every detection layer (sanitizer, message provenance check, action
 * validator) writes a ThreatEvent to the append-only log so that:
 *  - Threats survive service-worker restarts (stored in chrome.storage.local)
 *  - Repeated attack patterns from the same domain can be detected across tasks
 *  - Security researchers and operators have a forensic artifact to work with
 */

/** Maps to ThreatType in the guardrails package — duplicated here to avoid a
 *  cross-package import cycle from storage → chrome-extension. */
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ThreatCategory =
  | 'task_override'
  | 'prompt_injection'
  | 'sensitive_data'
  | 'dangerous_action'
  | 'history_tamper'
  | 'malicious_navigation';

/** Which layer of the pipeline detected the threat */
export type DetectionLayer =
  | 'sanitizer'
  | 'message_manager'
  | 'action_validator'
  | 'provenance_check'
  | 'phishing_detector'
  | 'ip_protection'
  | 'intent_anchoring'
  | 'behavioral_auditor';

/**
 * A single threat detection event persisted to the audit log.
 * Instances are append-only — the log never overwrites or deletes entries.
 */
export interface ThreatEvent {
  /** UUID generated at detection time */
  id: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Per-executor session identifier */
  sessionId: string;
  /** Task identifier */
  taskId: string;
  /** Step within the task where the threat was detected */
  stepNumber: number;
  /** URL of the page where the threat originated */
  sourceUrl: string;
  /** Category of the detected threat */
  threatType: ThreatCategory;
  severity: ThreatSeverity;
  /**
   * First 200 chars of detected content (truncated to keep log compact).
   * Never store more — this is a forensic fragment, not a copy of the payload.
   */
  rawFragment: string;
  /** What the content was replaced with after sanitization */
  sanitizedFragment: string;
  /** True if the threat caused an action to be blocked / task suspended */
  wasBlocked: boolean;
  detectionLayer: DetectionLayer;
  /** Stable rule id (e.g. "task_override_ignore") for cross-referencing patterns */
  ruleId?: string;
  /** Cryptographic chaining: SHA-256 hash of the previous log entry. Null for first entry. */
  previousHash: string | null;
  /** HMAC-SHA256 signature of the current entry (all fields except this one) */
  signature?: string;
}
