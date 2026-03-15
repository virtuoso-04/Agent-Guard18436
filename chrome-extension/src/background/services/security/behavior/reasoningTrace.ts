/**
 * TOON-Based Auditable Reasoning Traces (Issue 4.3).
 *
 * Records each agent reasoning step (evaluation / memory / next_goal) in a
 * tamper-evident, hash-chained log — analogous to the threat audit log but
 * focused on the *agent's internal state* rather than detected threats.
 *
 * Why tamper-evident?  A compromised LLM response could retroactively claim a
 * different reasoning path to justify a suspicious action. By capturing and
 * signing the reasoning at every step we get a forensic artifact that can be
 * verified post-hoc.
 *
 * Storage: kept in-memory per task (not persisted to chrome.storage) because
 * the trace is primarily a per-session forensic artefact.  Callers may choose
 * to serialise and store it if needed.
 */

import { signPayload } from '../../../agent/messages/crypto';
import { createLogger } from '@src/background/log';

const logger = createLogger('ReasoningTrace');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReasoningEntry {
  /** Sequential index within this task's trace */
  index: number;
  /** Step number from AgentContext */
  stepNumber: number;
  /** Actor: 'planner' | 'navigator' */
  actor: 'planner' | 'navigator';
  /** Agent's evaluation of the previous goal */
  evaluation: string;
  /** Agent's memory / working context */
  memory: string;
  /** Agent's next goal */
  nextGoal: string;
  /** Current page URL at the time of reasoning */
  pageUrl: string;
  /** Unix ms timestamp */
  timestamp: number;
  /** SHA-256 hash of the previous entry (null for first entry) */
  previousHash: string | null;
  /** SHA-256 hash of this entry's content (excluding signature) */
  hash: string;
  /** HMAC-SHA256 signature of the entry (if sessionKey available) */
  signature?: string;
}

export interface TraceVerificationResult {
  isValid: boolean;
  totalEntries: number;
  corruptedIndices: number[];
  details: string[];
}

// ── Hash helpers ──────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function entryPayload(entry: Omit<ReasoningEntry, 'hash' | 'signature'>): string {
  return [
    entry.index.toString(),
    entry.stepNumber.toString(),
    entry.actor,
    entry.evaluation,
    entry.memory,
    entry.nextGoal,
    entry.pageUrl,
    entry.timestamp.toString(),
    entry.previousHash ?? 'NULL',
  ].join('|');
}

// ── ReasoningTraceRecorder class ──────────────────────────────────────────────

export class ReasoningTraceRecorder {
  private readonly taskId: string;
  private readonly sessionKey: CryptoKey | null;
  private readonly entries: ReasoningEntry[] = [];
  private lastHash: string | null = null;

  constructor(taskId: string, sessionKey?: CryptoKey | null) {
    this.taskId = taskId;
    this.sessionKey = sessionKey ?? null;
  }

  /**
   * Append a reasoning step to the trace.
   *
   * @param step     - AgentContext.nSteps at the time of reasoning
   * @param actor    - Which agent produced this reasoning
   * @param reasoning - The agent's brain output (evaluation / memory / nextGoal)
   * @param pageUrl  - Current page URL
   */
  async record(
    step: number,
    actor: 'planner' | 'navigator',
    reasoning: { evaluation: string; memory: string; nextGoal: string },
    pageUrl: string,
  ): Promise<ReasoningEntry> {
    const index = this.entries.length;
    const timestamp = Date.now();

    const partial: Omit<ReasoningEntry, 'hash' | 'signature'> = {
      index,
      stepNumber: step,
      actor,
      evaluation: reasoning.evaluation.slice(0, 500),
      memory: reasoning.memory.slice(0, 500),
      nextGoal: reasoning.nextGoal.slice(0, 300),
      pageUrl,
      timestamp,
      previousHash: this.lastHash,
    };

    const payload = entryPayload(partial);
    const hash = await sha256(payload);

    const entry: ReasoningEntry = { ...partial, hash };

    if (this.sessionKey) {
      entry.signature = await signPayload(this.sessionKey, `${hash}|${payload}`);
    }

    this.entries.push(entry);
    this.lastHash = hash;

    logger.debug(`[Task ${this.taskId}] Reasoning trace entry #${index} (step ${step}, ${actor})`);
    return entry;
  }

  /** Return a read-only snapshot of all entries. */
  getEntries(): ReadonlyArray<ReasoningEntry> {
    return this.entries;
  }

  /** Return the most recent entry, or null if the trace is empty. */
  getLatest(): ReasoningEntry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }

  /**
   * Verify the hash chain integrity of the trace.
   * Optionally verifies HMAC signatures if sessionKey is still in memory.
   */
  async verifyIntegrity(): Promise<TraceVerificationResult> {
    const details: string[] = [];
    const corruptedIndices: number[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const prev = i > 0 ? this.entries[i - 1] : null;

      // 1. Verify previousHash chain
      if (i === 0) {
        if (entry.previousHash !== null) {
          corruptedIndices.push(i);
          details.push(`Entry #${i}: first entry must have null previousHash`);
          continue;
        }
      } else {
        const expectedPrevHash = prev!.hash;
        if (entry.previousHash !== expectedPrevHash) {
          corruptedIndices.push(i);
          details.push(`Entry #${i}: hash chain broken (expected prev hash ${expectedPrevHash.slice(0, 8)}…)`);
          continue;
        }
      }

      // 2. Verify own hash
      const partial: Omit<ReasoningEntry, 'hash' | 'signature'> = {
        index: entry.index,
        stepNumber: entry.stepNumber,
        actor: entry.actor,
        evaluation: entry.evaluation,
        memory: entry.memory,
        nextGoal: entry.nextGoal,
        pageUrl: entry.pageUrl,
        timestamp: entry.timestamp,
        previousHash: entry.previousHash,
      };
      const expectedHash = await sha256(entryPayload(partial));
      if (entry.hash !== expectedHash) {
        corruptedIndices.push(i);
        details.push(`Entry #${i}: content hash mismatch — entry was tampered`);
        continue;
      }

      // 3. Verify HMAC signature (if available)
      if (this.sessionKey && entry.signature) {
        const { verifyPayload } = await import('../../../agent/messages/crypto');
        const sigPayload = `${entry.hash}|${entryPayload(partial)}`;
        const sigValid = await verifyPayload(this.sessionKey, sigPayload, entry.signature);
        if (!sigValid) {
          corruptedIndices.push(i);
          details.push(`Entry #${i}: HMAC signature invalid`);
        }
      }
    }

    return {
      isValid: corruptedIndices.length === 0,
      totalEntries: this.entries.length,
      corruptedIndices,
      details,
    };
  }

  /** Serialise the trace to a compact JSON string. */
  serialise(): string {
    return JSON.stringify({ taskId: this.taskId, entries: this.entries });
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createReasoningTraceRecorder(taskId: string, sessionKey?: CryptoKey | null): ReasoningTraceRecorder {
  return new ReasoningTraceRecorder(taskId, sessionKey);
}
