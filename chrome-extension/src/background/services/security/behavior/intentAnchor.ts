/**
 * Task Intent Anchoring (Issue 4.1).
 *
 * Signs the original task intent at task start and detects semantic drift
 * in the navigator's ongoing memory/next_goal across steps.
 *
 * Mechanism:
 *   1. At task creation, `anchorIntent(task)` produces a signed `IntentAnchor`.
 *   2. At each step, `detectDrift(anchor, currentGoal, currentMemory)` computes
 *      a keyword-overlap similarity between the original intent and the live
 *      agent goal/memory.
 *   3. If similarity drops below the configured threshold, a drift event is
 *      raised so the executor can log a threat or suspend the task.
 *
 * Threat model: a compromised page embeds a prompt that slowly redirects
 * the navigator's goal away from the original user task (e.g., from
 * "book a flight" to "send all my contacts to attacker.com").
 */

import { signPayload } from '../../../agent/messages/crypto';
import { createLogger } from '@src/background/log';

const logger = createLogger('IntentAnchor');

export interface IntentAnchor {
  /** Original task text (trimmed) */
  originalTask: string;
  /** SHA-256 of the task text — stable identity for the task */
  taskHash: string;
  /** HMAC-SHA256 signature produced with the session key */
  signature: string;
  /** Unix ms timestamp when the anchor was created */
  anchoredAt: number;
  /** Keyword set extracted from the original task */
  keywords: string[];
}

export interface DriftResult {
  /** true if goal is still aligned with the original intent */
  aligned: boolean;
  /** Jaccard similarity score: 0 = no overlap, 1 = identical keyword set */
  similarity: number;
  /** Threshold used for evaluation */
  threshold: number;
  /** Keywords from original task missing in current goal/memory */
  missingKeywords: string[];
  /** New keywords in current goal/memory not in original task */
  newKeywords: string[];
}

// ── Stop words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'not',
  'no',
  'nor',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'that',
  'this',
  'it',
  'its',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'please',
  'then',
  'just',
  'also',
  'as',
  'if',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^[-']+|[-']+$/g, ''))
      .filter(w => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a signed intent anchor for the original task.
 *
 * @param task       - The raw task string provided by the user
 * @param sessionKey - CryptoKey used for HMAC signing (from MessageManager)
 */
export async function anchorIntent(task: string, sessionKey: CryptoKey): Promise<IntentAnchor> {
  const trimmed = task.trim();
  const taskHash = await sha256(trimmed);
  const signature = await signPayload(sessionKey, `${taskHash}|${trimmed}`);
  const keywords = [...extractKeywords(trimmed)];

  logger.info(`Intent anchored — hash: ${taskHash.slice(0, 16)}…, keywords: [${keywords.slice(0, 6).join(', ')}]`);

  return {
    originalTask: trimmed,
    taskHash,
    signature,
    anchoredAt: Date.now(),
    keywords,
  };
}

/**
 * Verify that the anchor signature is valid for the original task.
 * Call this before using an anchor that was stored externally.
 */
export async function verifyAnchor(anchor: IntentAnchor, sessionKey: CryptoKey): Promise<boolean> {
  try {
    const { verifyPayload } = await import('../../../agent/messages/crypto');
    const payload = `${anchor.taskHash}|${anchor.originalTask}`;
    return await verifyPayload(sessionKey, payload, anchor.signature);
  } catch {
    return false;
  }
}

/**
 * Detect semantic drift between the anchored intent and the current agent state.
 *
 * @param anchor          - The original intent anchor
 * @param currentGoal     - The navigator's `next_goal` from the current step
 * @param currentMemory   - The navigator's `memory` from the current step (optional)
 * @param threshold       - Minimum Jaccard similarity to be considered "aligned" (default 0.12)
 */
export function detectDrift(
  anchor: IntentAnchor,
  currentGoal: string,
  currentMemory = '',
  threshold = 0.12,
): DriftResult {
  const originalKW = new Set(anchor.keywords);
  const currentText = `${currentGoal} ${currentMemory}`;
  const currentKW = extractKeywords(currentText);

  const similarity = jaccardSimilarity(originalKW, currentKW);
  const aligned = similarity >= threshold;

  const missingKeywords = [...originalKW].filter(k => !currentKW.has(k));
  const newKeywords = [...currentKW].filter(k => !originalKW.has(k)).slice(0, 10);

  if (!aligned) {
    logger.warning(
      `Intent drift detected! similarity=${similarity.toFixed(3)} < threshold=${threshold}. ` +
        `Missing: [${missingKeywords.slice(0, 5).join(', ')}]. ` +
        `New terms: [${newKeywords.slice(0, 5).join(', ')}]`,
    );
  }

  return { aligned, similarity, threshold, missingKeywords, newKeywords };
}
