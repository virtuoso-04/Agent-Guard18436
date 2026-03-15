/**
 * Atomic State-Snapshot-to-Action Locking (Issue 2.4).
 *
 * Prevents zero-click attacks that mutate the DOM between the Planner's
 * observation phase and the Navigator's execution phase.
 *
 * Protocol:
 *   1. Before planning, call `captureSnapshot(url, elementCount, elementDigest)`.
 *      This SHA-256 hashes the current page state and (optionally) signs it.
 *   2. Before executing each action, call `verifySnapshot(currentState, snapshot)`.
 *      If the hash doesn't match, the action is blocked — the page was mutated.
 *
 * The hash covers:
 *   - Current page URL
 *   - Number of interactive elements visible
 *   - A lightweight digest of the top-N elements (tag + highlight index)
 *
 * We intentionally exclude ephemeral data (scroll position, timestamps) to
 * keep the snapshot stable under normal load while still catching injected
 * elements or navigations triggered by script.
 */

import { signPayload } from '../../../agent/messages/crypto';
import { createLogger } from '@src/background/log';

const logger = createLogger('AtomicLock');

export interface PageStateSummary {
  /** Current page URL */
  url: string;
  /** Number of interactive (highlightIndex != null) elements */
  interactiveCount: number;
  /**
   * Stable digest string built from the top-20 interactive elements.
   * Format: "idx:tag,idx:tag,..." — enough to detect insertions/deletions.
   */
  elementDigest: string;
}

export interface StateSnapshot {
  /** SHA-256 hex digest of the PageStateSummary fields */
  hash: string;
  /** The URL at snapshot time */
  url: string;
  /** Step number at which snapshot was taken */
  stepNumber: number;
  /** Unix ms timestamp */
  capturedAt: number;
  /** HMAC-SHA256 signature for tamper detection (signed with session key if available) */
  signature?: string;
}

export interface SnapshotVerificationResult {
  locked: boolean;
  snapshot: StateSnapshot;
  reason?: string;
}

/**
 * Compute a SHA-256 hash of the page state summary.
 */
async function hashPageState(summary: PageStateSummary): Promise<string> {
  const payload = [summary.url, summary.interactiveCount.toString(), summary.elementDigest].join('|');
  const encoded = new TextEncoder().encode(payload);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Capture a snapshot of the current page state.
 *
 * @param summary    - Lightweight summary of the current page state
 * @param stepNumber - Current step counter from AgentContext
 * @param sessionKey - Optional CryptoKey to HMAC-sign the snapshot
 */
export async function captureSnapshot(
  summary: PageStateSummary,
  stepNumber: number,
  sessionKey?: CryptoKey | null,
): Promise<StateSnapshot> {
  const hash = await hashPageState(summary);
  const snapshot: StateSnapshot = {
    hash,
    url: summary.url,
    stepNumber,
    capturedAt: Date.now(),
  };

  if (sessionKey) {
    const sigPayload = `${hash}|${summary.url}|${stepNumber}|${snapshot.capturedAt}`;
    snapshot.signature = await signPayload(sessionKey, sigPayload);
  }

  logger.debug(`Snapshot captured at step ${stepNumber}: ${hash.slice(0, 16)}… (${summary.interactiveCount} elements)`);
  return snapshot;
}

/**
 * Verify that the current page state matches a previously captured snapshot.
 *
 * Returns `locked: true` when the state is unchanged and execution may proceed.
 * Returns `locked: false` when a mismatch is detected — the action should be
 * aborted and a threat event logged.
 *
 * @param currentSummary - Fresh page state summary at execution time
 * @param snapshot       - The snapshot captured during planning
 */
export async function verifySnapshot(
  currentSummary: PageStateSummary,
  snapshot: StateSnapshot,
): Promise<SnapshotVerificationResult> {
  // URL must match — navigation means we're on a different page
  if (currentSummary.url !== snapshot.url) {
    logger.warning(`Snapshot URL mismatch: planned on "${snapshot.url}", now on "${currentSummary.url}"`);
    return {
      locked: false,
      snapshot,
      reason: `Page navigated away during planning: expected "${snapshot.url}", found "${currentSummary.url}"`,
    };
  }

  const currentHash = await hashPageState(currentSummary);

  if (currentHash !== snapshot.hash) {
    const ageDeltaMs = Date.now() - snapshot.capturedAt;
    logger.warning(
      `DOM mutation detected! Snapshot hash mismatch after ${ageDeltaMs}ms. ` +
        `Planned: ${snapshot.hash.slice(0, 16)}… Current: ${currentHash.slice(0, 16)}…`,
    );
    return {
      locked: false,
      snapshot,
      reason:
        `DOM was mutated between planning and execution (${ageDeltaMs}ms). ` +
        `Element count or structure changed — possible zero-click injection.`,
    };
  }

  logger.debug(`Snapshot verified: state unchanged at step ${snapshot.stepNumber}`);
  return { locked: true, snapshot };
}

/**
 * Build a PageStateSummary from a selector map (index → element tag).
 * Designed to work with BrowserState.selectorMap.
 */
export function buildPageStateSummary(
  url: string,
  selectorMap: Map<number, { tagName?: string | null }>,
): PageStateSummary {
  const entries = Array.from(selectorMap.entries())
    .sort(([a], [b]) => a - b)
    .slice(0, 20); // top-20 for stability

  const elementDigest = entries.map(([idx, el]) => `${idx}:${(el.tagName ?? '?').toLowerCase()}`).join(',');

  return {
    url,
    interactiveCount: selectorMap.size,
    elementDigest,
  };
}
