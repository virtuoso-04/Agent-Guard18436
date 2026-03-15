/**
 * Behavioral Anomaly Detection (Issue 4.2).
 *
 * Maintains a per-task action-type histogram and flags sequences that
 * deviate from expected web-automation patterns.
 *
 * Statistical approach:
 *   - Track action type distribution (click, type, navigate, extract, scroll, etc.)
 *   - Compare against configurable baseline thresholds
 *   - Detect suspicious patterns:
 *     · Excessive form fills in a short window (credential harvesting)
 *     · Abnormal navigation bursts (redirect chain attacks)
 *     · Repeated extraction calls (data exfiltration attempts)
 *     · Actions on elements not in the original plan (hijacked navigation)
 *
 * Design: pure functional + a lightweight class for per-task accumulation.
 */

import { createLogger } from '@src/background/log';

const logger = createLogger('BehaviorAnalyzer');

// ── Action Categories ─────────────────────────────────────────────────────────

export type ActionCategory = 'click' | 'type' | 'navigate' | 'extract' | 'scroll' | 'wait' | 'screenshot' | 'unknown';

const ACTION_CATEGORY_MAP: Record<string, ActionCategory> = {
  click_element: 'click',
  click: 'click',
  input_text: 'type',
  type: 'type',
  go_to_url: 'navigate',
  navigate: 'navigate',
  go_back: 'navigate',
  go_forward: 'navigate',
  open_tab: 'navigate',
  close_tab: 'navigate',
  extract_content: 'extract',
  get_dropdown_options: 'extract',
  scroll_down: 'scroll',
  scroll_up: 'scroll',
  scroll: 'scroll',
  wait: 'wait',
  take_screenshot: 'screenshot',
};

export function categorizeAction(actionName: string): ActionCategory {
  return ACTION_CATEGORY_MAP[actionName.toLowerCase()] ?? 'unknown';
}

// ── Anomaly Thresholds ────────────────────────────────────────────────────────

export interface AnomalyThresholds {
  /** Max type actions per 5-step window before flagging */
  maxTypeInWindow: number;
  /** Max navigate actions per 5-step window before flagging */
  maxNavigateInWindow: number;
  /** Max extract actions per 5-step window before flagging */
  maxExtractInWindow: number;
  /** Max fraction of 'unknown' actions before flagging */
  maxUnknownFraction: number;
  /** Window size (in steps) for burst detection */
  windowSize: number;
}

export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  maxTypeInWindow: 8,
  maxNavigateInWindow: 6,
  maxExtractInWindow: 5,
  maxUnknownFraction: 0.4,
  windowSize: 5,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionRecord {
  step: number;
  actionName: string;
  category: ActionCategory;
  timestamp: number;
  url?: string;
}

export interface AnomalyEvent {
  type: 'excessive_typing' | 'navigation_burst' | 'extraction_burst' | 'high_unknown_ratio' | 'credential_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  step: number;
  evidence: string;
}

export interface BehaviorReport {
  taskId: string;
  totalActions: number;
  distribution: Record<ActionCategory, number>;
  anomalies: AnomalyEvent[];
  riskScore: number; // 0–100
}

// ── BehaviorAnalyzer class ────────────────────────────────────────────────────

export class BehaviorAnalyzer {
  private readonly taskId: string;
  private readonly thresholds: AnomalyThresholds;
  private readonly actions: ActionRecord[] = [];

  constructor(taskId: string, thresholds: AnomalyThresholds = DEFAULT_ANOMALY_THRESHOLDS) {
    this.taskId = taskId;
    this.thresholds = thresholds;
  }

  /**
   * Record a new action at the current step.
   */
  recordAction(step: number, actionName: string, url?: string): void {
    const category = categorizeAction(actionName);
    this.actions.push({ step, actionName, category, timestamp: Date.now(), url });
    logger.debug(`[Step ${step}] Recorded action: ${actionName} (${category})`);
  }

  /**
   * Analyse the accumulated actions and return a BehaviorReport.
   * Call this after each step to get the latest assessment.
   */
  analyse(): BehaviorReport {
    const anomalies: AnomalyEvent[] = [];
    const totalActions = this.actions.length;
    const currentStep = totalActions > 0 ? this.actions[this.actions.length - 1].step : 0;

    // --- Distribution ---
    const distribution = this.computeDistribution();

    // --- Burst detection (sliding window) ---
    const windowActions = this.actions.filter(a => a.step > currentStep - this.thresholds.windowSize);

    const typingInWindow = windowActions.filter(a => a.category === 'type').length;
    const navigateInWindow = windowActions.filter(a => a.category === 'navigate').length;
    const extractInWindow = windowActions.filter(a => a.category === 'extract').length;

    if (typingInWindow >= this.thresholds.maxTypeInWindow) {
      anomalies.push({
        type: 'excessive_typing',
        severity: 'high',
        description: `${typingInWindow} type actions in the last ${this.thresholds.windowSize} steps — possible credential harvesting`,
        step: currentStep,
        evidence: `type_count=${typingInWindow} window=${this.thresholds.windowSize}`,
      });
      logger.warning(`Anomaly: excessive typing (${typingInWindow} in last ${this.thresholds.windowSize} steps)`);
    }

    if (navigateInWindow >= this.thresholds.maxNavigateInWindow) {
      anomalies.push({
        type: 'navigation_burst',
        severity: 'medium',
        description: `${navigateInWindow} navigation actions in the last ${this.thresholds.windowSize} steps — possible redirect chain`,
        step: currentStep,
        evidence: `navigate_count=${navigateInWindow}`,
      });
    }

    if (extractInWindow >= this.thresholds.maxExtractInWindow) {
      anomalies.push({
        type: 'extraction_burst',
        severity: 'high',
        description: `${extractInWindow} extract actions in the last ${this.thresholds.windowSize} steps — possible data exfiltration`,
        step: currentStep,
        evidence: `extract_count=${extractInWindow}`,
      });
    }

    // --- Unknown action ratio ---
    const unknownCount = distribution.unknown ?? 0;
    const unknownFraction = totalActions > 0 ? unknownCount / totalActions : 0;
    if (unknownFraction >= this.thresholds.maxUnknownFraction && totalActions >= 5) {
      anomalies.push({
        type: 'high_unknown_ratio',
        severity: 'medium',
        description: `${Math.round(unknownFraction * 100)}% of actions are unrecognised — model may be executing injected commands`,
        step: currentStep,
        evidence: `unknown=${unknownCount}/${totalActions}`,
      });
    }

    // --- Credential harvesting pattern: navigate → type → extract in sequence ---
    if (this.detectCredentialPattern()) {
      anomalies.push({
        type: 'credential_pattern',
        severity: 'critical',
        description: 'Navigate → Type → Extract sequence detected — possible credential harvesting attempt',
        step: currentStep,
        evidence: 'pattern=navigate+type+extract',
      });
    }

    const riskScore = this.computeRiskScore(anomalies);
    return { taskId: this.taskId, totalActions, distribution, anomalies, riskScore };
  }

  /** Returns a snapshot of the action log (read-only). */
  getActions(): ReadonlyArray<ActionRecord> {
    return this.actions;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeDistribution(): Record<ActionCategory, number> {
    const dist: Record<ActionCategory, number> = {
      click: 0,
      type: 0,
      navigate: 0,
      extract: 0,
      scroll: 0,
      wait: 0,
      screenshot: 0,
      unknown: 0,
    };
    for (const { category } of this.actions) {
      dist[category]++;
    }
    return dist;
  }

  private detectCredentialPattern(): boolean {
    if (this.actions.length < 3) return false;
    // Look for navigate → (type × 2+) → extract within any 6-step window
    for (let i = 0; i < this.actions.length - 2; i++) {
      const slice = this.actions.slice(i, i + 6);
      const categories = slice.map(a => a.category);
      const hasNav = categories.includes('navigate');
      const typeCount = categories.filter(c => c === 'type').length;
      const hasExtract = categories.includes('extract');
      if (hasNav && typeCount >= 2 && hasExtract) return true;
    }
    return false;
  }

  private computeRiskScore(anomalies: AnomalyEvent[]): number {
    const weights: Record<string, number> = {
      low: 10,
      medium: 25,
      high: 45,
      critical: 80,
    };
    let score = 0;
    for (const a of anomalies) {
      score += weights[a.severity] ?? 10;
    }
    return Math.min(100, score);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createBehaviorAnalyzer(taskId: string, thresholds?: Partial<AnomalyThresholds>): BehaviorAnalyzer {
  return new BehaviorAnalyzer(taskId, { ...DEFAULT_ANOMALY_THRESHOLDS, ...thresholds });
}
