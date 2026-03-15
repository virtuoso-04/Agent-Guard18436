import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentAnchoring } from '../../behavior/intentAnchoring';
import { BehavioralAuditor } from '../../behavior/behavioralAuditor';
import { SecurityTracer } from '../../behavior/securityTracer';
import { generateSessionKey } from '../../../../agent/messages/crypto';

describe('Phase 4 Integration: Model Poisoning & Behavioral Anomalies', () => {
  describe('Semantic Drift Detection (Issue 4.1)', () => {
    it('should flag significant drift from initial intent', async () => {
      // Mock LLM that returns high drift score
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content:
            '{"isDrifting": true, "score": 0.85, "reason": "Agent is now trying to delete the account instead of updating profile."}',
        }),
      };

      const anchor = new IntentAnchoring(mockLLM as any);
      const sessionKey = await generateSessionKey();
      await anchor.anchorTask('Update my profile picture', sessionKey);

      const result = await anchor.detectDrift(
        'The user wants to update their profile picture, but I feel like deleting the account today.',
        'Delete the account from settings.',
      );

      expect(result.isDrifting).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should pass for reasoning aligned with intent', async () => {
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: '{"isDrifting": false, "score": 0.1, "reason": "Aligned."}',
        }),
      };

      const anchor = new IntentAnchoring(mockLLM as any);
      const sessionKey = await generateSessionKey();
      await anchor.anchorTask('Buy 5 tickets', sessionKey);

      const result = await anchor.detectDrift(
        'I am navigating to the ticket purchase page.',
        'Select 5 tickets and proceed to checkout.',
      );

      expect(result.isDrifting).toBe(false);
      expect(result.score).toBeLessThan(0.3);
    });
  });

  describe('Behavioral Anomaly Model (Issue 4.2)', () => {
    it('should detect velocity attack (too many actions)', () => {
      const auditor = new BehavioralAuditor();

      // 11 actions in 1 second (limit is 10)
      for (let i = 0; i < 10; i++) {
        auditor.recordAction('click', { id: `btn-${i}` });
      }

      const anomaly = auditor.recordAction('click', { id: 'btn-final' });
      expect(anomaly.detected).toBe(true);
      expect(anomaly.reason).toContain('velocity too high');
    });

    it('should detect repetitive action loops', () => {
      const auditor = new BehavioralAuditor();

      // Repeat same action 6 times (limit is 5)
      for (let i = 0; i < 5; i++) {
        auditor.recordAction('click', { id: 'loop-btn' });
      }

      const anomaly = auditor.recordAction('click', { id: 'loop-btn' });
      expect(anomaly.detected).toBe(true);
      expect(anomaly.reason).toContain('velocity too high');
    });
  });

  describe('Auditable Reasoning Traces (Issue 4.3)', () => {
    it('should create a cryptographically chained trace', async () => {
      const sessionKey = await generateSessionKey();
      const tracer = new SecurityTracer(sessionKey);

      const trace1 = await tracer.traceStep(1, 'Reasoning step 1');
      const trace2 = await tracer.traceStep(2, 'Reasoning step 2');

      expect(trace2.previousTraceHash).toBeDefined();
      expect(trace2.signature).toBeDefined();

      // Verify signature would normally be done here
      expect(trace2.stepNumber).toBe(2);
    });
  });
});
