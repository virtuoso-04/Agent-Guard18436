import { threatLogStore } from '@agent-guard/storage';
import type {
  ThreatEvent,
  ThreatCategory,
  ThreatSeverity,
  DetectionLayer,
} from '@agent-guard/storage/lib/security/types';
import { signPayload, verifyPayload } from '../../../agent/messages/crypto';

/**
 * AuditLogger — manages the tamper-evident threat log.
 * It handles SHA-256 chaining and HMAC signing before persisting to storage.
 */
export class AuditLogger {
  private sessionKey: CryptoKey | null = null;
  private lastHash: string | null = null;

  constructor(sessionKey?: CryptoKey) {
    if (sessionKey) {
      this.sessionKey = sessionKey;
    }
  }

  public setSessionKey(key: CryptoKey) {
    this.sessionKey = key;
  }

  /**
   * Log a new threat event with tamper-evident protections.
   */
  public async logThreat(params: {
    sessionId: string;
    taskId: string;
    stepNumber: number;
    sourceUrl: string;
    threatType: ThreatCategory;
    severity: ThreatSeverity;
    rawFragment: string;
    sanitizedFragment: string;
    wasBlocked: boolean;
    detectionLayer: DetectionLayer;
    ruleId?: string;
  }): Promise<void> {
    // 1. Initialize lastHash if not already done
    if (this.lastHash === null) {
      const all = await threatLogStore.getAll();
      if (all.length > 0) {
        this.lastHash = await this.computeHash(all[all.length - 1]);
      }
    }

    // 2. Build the event
    const event: ThreatEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...params,
      previousHash: this.lastHash,
    };

    // 3. Sign it if we have a key
    if (this.sessionKey) {
      const payload = this.stringifyEventForCrypto(event);
      event.signature = await signPayload(this.sessionKey, payload);
    }

    // 4. Append to storage
    await threatLogStore.append(event);

    // 5. Update chain
    this.lastHash = await this.computeHash(event);
  }

  /**
   * Verify the entire audit log for tampering.
   * Checks:
   * 1. SHA-256 hash chains (each previousHash matches)
   * 2. HMAC-SHA256 signatures (if key is still in memory)
   */
  public async verifyIntegrity(): Promise<{
    isValid: boolean;
    totalCount: number;
    corruptedCount: number;
    details: string[];
  }> {
    const all = await threatLogStore.getAll();
    const details: string[] = [];
    let corruptedCount = 0;

    for (let i = 0; i < all.length; i++) {
      const event = all[i];
      const prev = i > 0 ? all[i - 1] : null;

      // 1. Check Hash Chain
      if (i > 0) {
        const expectedPrevHash = await this.computeHash(prev!);
        if (event.previousHash !== expectedPrevHash) {
          corruptedCount++;
          details.push(`Entry ${event.id}: Hash chain mismatch. Previous hash was modified.`);
          continue;
        }
      } else if (event.previousHash !== null) {
        corruptedCount++;
        details.push(`Entry ${event.id}: First entry should have null previousHash.`);
        continue;
      }

      // 2. Check Signature (only if we have the key)
      if (this.sessionKey && event.signature) {
        const payload = this.stringifyEventForCrypto(event);
        const sigValid = await verifyPayload(this.sessionKey, payload, event.signature);
        if (!sigValid) {
          corruptedCount++;
          details.push(`Entry ${event.id}: HMAC signature verification failed.`);
          continue;
        }
      }
    }

    return {
      isValid: corruptedCount === 0,
      totalCount: all.length,
      corruptedCount,
      details,
    };
  }

  /**
   * Compute a stable SHA-256 hash of an entry.
   */
  private async computeHash(event: ThreatEvent): Promise<string> {
    const payload = this.stringifyEventForCrypto(event);
    const encoded = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Stringify only the fields that should be part of the cryptographic identity.
   * Excluding the signature itself.
   */
  private stringifyEventForCrypto(event: ThreatEvent): string {
    // We explicitly list fields to ensure stability if the interface grows
    const parts = [
      event.id,
      event.timestamp.toString(),
      event.sessionId,
      event.taskId,
      event.stepNumber.toString(),
      event.sourceUrl,
      event.threatType,
      event.severity,
      event.rawFragment,
      event.sanitizedFragment,
      event.wasBlocked.toString(),
      event.detectionLayer,
      event.ruleId || '',
      event.previousHash || 'NULL',
    ];
    return parts.join('|');
  }
}

// Singleton instance for global background use
export const auditLogger = new AuditLogger();
