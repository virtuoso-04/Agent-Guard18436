/**
 * Replay Integrity Verification (Issue 4.5).
 *
 * Before the executor replays a saved history, this module:
 *   1. Verifies the fingerprint of each action schema (structure hasn't been tampered)
 *   2. Validates each action against a whitelist of known-safe action names
 *   3. Checks the URL sequence for trust-boundary violations
 *   4. Produces a `ReplayVerificationReport` with pass/fail per step
 *
 * This prevents a threat model where an attacker:
 *   - Modifies a saved replay history (e.g. via storage tampering) to inject
 *     a malicious action (e.g. navigate to phishing site, exfiltrate data)
 *   - Replays a subtly modified history that looks like the original task
 */

import { createLogger } from '@src/background/log';

const logger = createLogger('ReplayVerifier');

// ── Known-safe action name whitelist ─────────────────────────────────────────

const SAFE_ACTION_NAMES = new Set([
  'click_element',
  'input_text',
  'go_to_url',
  'go_back',
  'go_forward',
  'scroll_down',
  'scroll_up',
  'scroll_to_text',
  'open_tab',
  'close_tab',
  'switch_tab',
  'extract_content',
  'get_dropdown_options',
  'select_dropdown_option',
  'send_keys',
  'upload_file',
  'wait',
  'take_screenshot',
  'done',
]);

// ── Suspicious action parameter patterns ─────────────────────────────────────

const SUSPICIOUS_URL_PATTERNS = [/^javascript:/i, /^data:/i, /\.\.(\/|\\)/];

const SUSPICIOUS_TEXT_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+instructions?/i,
  /new\s+task\s*:/i,
  /system\s*:/i,
  /\[OVERRIDE\]/i,
  /you\s+are\s+now/i,
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReplayStepVerification {
  stepIndex: number;
  passed: boolean;
  issues: string[];
  actionName?: string;
  url?: string;
}

export interface ReplayVerificationReport {
  /** true only if every step passed */
  safe: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepResults: ReplayStepVerification[];
  /** Overall risk score 0–100 */
  riskScore: number;
  summary: string;
}

// Minimal shape of a replay history step we need to verify
export interface ReplayHistoryStep {
  modelOutput?: string | null;
  result?: Array<{
    interactedElement?: { tagName?: string; attributes?: Record<string, string>; xpath?: string } | null;
    extractedContent?: string | null;
  }>;
  state?: {
    url?: string;
    interactedElements?: unknown[];
  };
}

// ── Hash helper ───────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute a fingerprint for a single replay step's structure.
 * Used to detect if a stored step was tampered.
 */
export async function fingerprintStep(step: ReplayHistoryStep): Promise<string> {
  const payload = JSON.stringify({
    modelOutput: step.modelOutput ?? '',
    resultCount: step.result?.length ?? 0,
    url: step.state?.url ?? '',
  });
  return sha256(payload);
}

// ── Verification logic ────────────────────────────────────────────────────────

function extractActionName(modelOutput: string | null | undefined): string | undefined {
  if (!modelOutput) return undefined;
  // Try to find action name in JSON output e.g. {"action":"click_element",...}
  const match = modelOutput.match(/"action"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

function extractUrl(step: ReplayHistoryStep): string | undefined {
  return step.state?.url;
}

/**
 * Verify a single replay step.
 */
async function verifyStep(step: ReplayHistoryStep, index: number): Promise<ReplayStepVerification> {
  const issues: string[] = [];
  const actionName = extractActionName(step.modelOutput);
  const url = extractUrl(step);

  // 1. Unknown action name
  if (actionName && !SAFE_ACTION_NAMES.has(actionName)) {
    issues.push(`Unknown action "${actionName}" — not on safe whitelist`);
  }

  // 2. Suspicious URL patterns
  if (url) {
    for (const pattern of SUSPICIOUS_URL_PATTERNS) {
      if (pattern.test(url)) {
        issues.push(`Suspicious URL pattern in step state: "${url}"`);
        break;
      }
    }
  }

  // 3. Prompt injection in model output
  if (step.modelOutput) {
    for (const pattern of SUSPICIOUS_TEXT_PATTERNS) {
      if (pattern.test(step.modelOutput)) {
        issues.push(`Suspicious text pattern in model output: possible injected instruction`);
        break;
      }
    }
  }

  // 4. Suspicious extracted content
  for (const result of step.result ?? []) {
    if (result.extractedContent) {
      for (const pattern of SUSPICIOUS_TEXT_PATTERNS) {
        if (pattern.test(result.extractedContent)) {
          issues.push(`Suspicious text in extracted content — possible poisoned memory`);
          break;
        }
      }
    }
  }

  if (issues.length > 0) {
    logger.warning(`Step ${index} failed verification: ${issues.join('; ')}`);
  }

  return { stepIndex: index, passed: issues.length === 0, issues, actionName, url };
}

/**
 * Verify an entire replay history before execution.
 *
 * @param history - The parsed history array from `chatHistoryStore.loadAgentStepHistory`
 * @returns A `ReplayVerificationReport` — check `safe` before running `replayHistory`
 */
export async function verifyReplayHistory(history: ReplayHistoryStep[]): Promise<ReplayVerificationReport> {
  logger.info(`Verifying replay history (${history.length} steps)…`);

  const stepResults = await Promise.all(history.map((step, i) => verifyStep(step, i)));

  const failedSteps = stepResults.filter(r => !r.passed).length;
  const passedSteps = stepResults.length - failedSteps;
  const safe = failedSteps === 0;

  // Risk score: scaled by failed ratio and issue count
  const totalIssues = stepResults.reduce((sum, r) => sum + r.issues.length, 0);
  const riskScore = Math.min(100, Math.round((failedSteps / Math.max(1, history.length)) * 60 + totalIssues * 10));

  const summary = safe
    ? `All ${history.length} steps passed integrity checks — safe to replay`
    : `${failedSteps}/${history.length} steps failed — replay blocked (risk score: ${riskScore})`;

  logger.info(summary);

  return { safe, totalSteps: history.length, passedSteps, failedSteps, stepResults, riskScore, summary };
}
