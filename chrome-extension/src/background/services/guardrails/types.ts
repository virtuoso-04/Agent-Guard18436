/**
 * Simple security guardrails type definitions
 * Focused on content sanitization and basic threat detection
 */

/**
 * Simplified threat types for v1
 */
export enum ThreatType {
  // Core threats
  TASK_OVERRIDE = 'task_override',
  PROMPT_INJECTION = 'prompt_injection',
  SENSITIVE_DATA = 'sensitive_data',
  DANGEROUS_ACTION = 'dangerous_action',
}

/**
 * Security pattern / sanitization rule entry.
 * Each rule has a unique id so it can be tested and referenced in threat events.
 */
export interface SecurityPattern {
  /** Unique rule identifier (e.g. "task_override_ignore") */
  id: string;
  pattern: RegExp;
  type: ThreatType;
  description: string;
  /** Replacement string or function. Empty string removes the match. */
  replacement?: string | ((match: string) => string);
  /** When true the rule only runs in strict mode */
  strictOnly?: boolean;
}

/**
 * Sanitization result
 */
export interface SanitizationResult {
  sanitized: string;
  threats: ThreatType[];
  modified: boolean;
}

/**
 * Future extensibility - validation result
 */
export interface ValidationResult {
  isValid: boolean;
  threats?: ThreatType[];
  message?: string;
}
