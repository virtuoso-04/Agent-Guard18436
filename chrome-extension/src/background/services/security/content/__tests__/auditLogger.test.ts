import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock global crypto at the very top
const mockHash = new Uint8Array(32).fill(0xaa);
const mockHashHex = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const mockSig = new Uint8Array(32).fill(0xbb);
const mockSigHex = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      sign: vi.fn().mockResolvedValue(mockSig.buffer),
      digest: vi.fn().mockResolvedValue(mockHash.buffer),
      verify: vi.fn().mockImplementation((_algo, _key, _sig, _data) => {
        const sigArr = new Uint8Array(_sig as ArrayBuffer);
        return Promise.resolve(sigArr.every(v => v === 0xbb));
      }),
    },
    randomUUID: vi.fn().mockReturnValue('123-uuid'),
  },
  configurable: true,
});

// 2. Mock dependencies
vi.mock('@agent-guard/storage', () => ({
  threatLogStore: {
    append: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getRecent: vi.fn(),
    getStats: vi.fn(),
    getLastHash: vi.fn().mockResolvedValue(null),
  },
}));

import { AuditLogger } from '../auditLogger';
import { threatLogStore } from '@agent-guard/storage';
import type { ThreatEvent } from '@agent-guard/storage/lib/security/types';

// Helper to create a fully populated mock event
function createMockEvent(overrides: Partial<ThreatEvent> = {}): ThreatEvent {
  return {
    id: 'id-' + Math.random(),
    timestamp: Date.now(),
    sessionId: 's',
    taskId: 't',
    stepNumber: 0,
    sourceUrl: 'http://u.com',
    threatType: 'prompt_injection',
    severity: 'medium',
    rawFragment: 'r',
    sanitizedFragment: 's',
    wasBlocked: false,
    detectionLayer: 'sanitizer',
    previousHash: null,
    ...overrides,
  } as ThreatEvent;
}

describe('Phase 4: Tamper-Evident Audit Logger - Edge Cases', () => {
  let logger: AuditLogger;
  const mockKey = { type: 'secret' } as unknown as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new AuditLogger(mockKey);
  });

  describe('Chaining Logic', () => {
    it('Case 1: First threat in session should have null previousHash', async () => {
      vi.mocked(threatLogStore.getAll).mockResolvedValue([]);
      await logger.logThreat({
        sessionId: 's1',
        taskId: 't1',
        stepNumber: 0,
        sourceUrl: 'u',
        threatType: 'prompt_injection' as any,
        severity: 'high' as any,
        rawFragment: 'r',
        sanitizedFragment: 's',
        wasBlocked: false,
        detectionLayer: 'sanitizer' as any,
      });
      expect(threatLogStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          previousHash: null,
        }),
      );
    });

    it('Case 2: Subsequent threats should chain correctly', async () => {
      // Mock an existing log
      const e0 = createMockEvent({ id: '0' });
      vi.mocked(threatLogStore.getAll).mockResolvedValue([e0]);

      await logger.logThreat({
        sessionId: 's1',
        taskId: 't1',
        stepNumber: 1,
        sourceUrl: 'u',
        threatType: 'prompt_injection' as any,
        severity: 'high' as any,
        rawFragment: 'r',
        sanitizedFragment: 's',
        wasBlocked: false,
        detectionLayer: 'sanitizer' as any,
      });

      expect(threatLogStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          previousHash: mockHashHex,
        }),
      );
    });
  });

  describe('Signing Logic', () => {
    it('Case 3: Should not sign if sessionKey is missing', async () => {
      const loggerNoKey = new AuditLogger(null as any);
      vi.mocked(threatLogStore.getAll).mockResolvedValue([]);
      await loggerNoKey.logThreat({
        sessionId: 's1',
        taskId: 't1',
        stepNumber: 0,
        sourceUrl: 'u',
        threatType: 'prompt_injection' as any,
        severity: 'high' as any,
        rawFragment: 'r',
        sanitizedFragment: 's',
        wasBlocked: false,
        detectionLayer: 'sanitizer' as any,
      });
      const appended = vi.mocked(threatLogStore.append).mock.calls[0][0];
      expect(appended.signature).toBeUndefined();
    });

    it('Case 4: Should sign if sessionKey is present', async () => {
      vi.mocked(threatLogStore.getAll).mockResolvedValue([]);
      await logger.logThreat({
        sessionId: 's1',
        taskId: 't1',
        stepNumber: 1,
        sourceUrl: 'u',
        threatType: 'prompt_injection' as any,
        severity: 'high' as any,
        rawFragment: 'r',
        sanitizedFragment: 's',
        wasBlocked: false,
        detectionLayer: 'sanitizer' as any,
      });
      const appended = vi.mocked(threatLogStore.append).mock.calls[0][0];
      expect(appended.signature).toBe(mockSigHex);
    });
  });

  describe('Verification (verifyIntegrity)', () => {
    it('Case 5: Should pass for a perfectly valid chain', async () => {
      const e1 = createMockEvent({
        id: '1',
        previousHash: null,
        signature: mockSigHex,
        timestamp: 100,
      });

      const e2 = createMockEvent({
        id: '2',
        previousHash: mockHashHex,
        signature: mockSigHex,
        timestamp: 200,
      });

      vi.mocked(threatLogStore.getAll).mockResolvedValue([e1, e2]);

      const result = await logger.verifyIntegrity();
      expect(result.isValid).toBe(true);
      expect(result.corruptedCount).toBe(0);
    });

    it('Case 6: Should fail if a hash is tampered', async () => {
      const e1 = createMockEvent({ id: '1', previousHash: null, signature: mockSigHex, timestamp: 100 });
      const e2 = createMockEvent({ id: '2', previousHash: 'WRONG_HASH', timestamp: 200 });

      vi.mocked(threatLogStore.getAll).mockResolvedValue([e1, e2]);

      const result = await logger.verifyIntegrity();
      expect(result.isValid).toBe(false);
      expect(result.corruptedCount).toBe(1);
    });

    it('Case 7: Should fail if a signature is tampered', async () => {
      const e1 = createMockEvent({
        id: '1',
        previousHash: null,
        signature: 'deadbeef',
      });

      vi.mocked(threatLogStore.getAll).mockResolvedValue([e1]);

      const result = await logger.verifyIntegrity();
      expect(result.isValid).toBe(false);
    });
  });
});
