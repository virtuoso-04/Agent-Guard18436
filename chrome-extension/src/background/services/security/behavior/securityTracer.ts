/**
 * TOON-Based Auditable Reasoning Traces (Issue 4.3).
 *
 * Generates tamper-evident "reasoning chains" for every agent step.
 * Each trace includes:
 *   - The agent's structured reasoning (TOON)
 *   - The previous step's trace hash (chaining)
 *   - An HMAC signature (provenance)
 */

import { signPayload } from '../../../agent/messages/crypto';
import { createLogger } from '@src/background/log';

const logger = createLogger('SecurityTracer');

export interface ReasoningTrace {
  stepNumber: number;
  reasoning: string;
  previousTraceHash: string | null;
  timestamp: number;
  signature?: string;
}

export class SecurityTracer {
  private lastTraceHash: string | null = null;
  private sessionKey: CryptoKey | null = null;
  private traces: ReasoningTrace[] = [];

  constructor(sessionKey?: CryptoKey) {
    if (sessionKey) this.sessionKey = sessionKey;
  }

  public setSessionKey(key: CryptoKey) {
    this.sessionKey = key;
  }

  /**
   * Append a new reasoning step to the auditable trace.
   */
  public async traceStep(stepNumber: number, reasoning: string): Promise<ReasoningTrace> {
    const trace: ReasoningTrace = {
      stepNumber,
      reasoning,
      previousTraceHash: this.lastTraceHash,
      timestamp: Date.now(),
    };

    if (this.sessionKey) {
      const payload = `${stepNumber}|${reasoning}|${this.lastTraceHash || 'NULL'}|${trace.timestamp}`;
      trace.signature = await signPayload(this.sessionKey, payload);
    }

    this.traces.push(trace);
    this.lastTraceHash = await this.computeHash(trace);

    logger.debug(`Step ${stepNumber} trace secured.`);
    return trace;
  }

  private async computeHash(trace: ReasoningTrace): Promise<string> {
    const payload = `${trace.stepNumber}|${trace.reasoning}|${trace.previousTraceHash}|${trace.timestamp}|${trace.signature || ''}`;
    const encoded = new TextEncoder().encode(payload);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public getTraces(): ReasoningTrace[] {
    return [...this.traces];
  }
}
