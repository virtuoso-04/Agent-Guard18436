import { describe, it, expect, beforeEach } from 'vitest';
import { domainScorer } from '../domainScorer';
import { urlFirewall } from '../urlFirewall';
import { redirectAuditor } from '../redirectAuditor';
import { pageAnalyzer } from '../pageAnalyzer';
import { DOMElementNode } from '../../../../browser/dom/views';
import { build_initial_state } from '../../../../browser/page';

describe('Phase 3 Integration: Phishing Detection & Navigation Trust', () => {
  describe('Domain Lookalike Scoring (Issue 3.1)', () => {
    it('should detect homoglyph domains', () => {
      // 'pаypal.com' with Cyrillic 'а'
      const score = domainScorer.scoreDomain('p\u0430ypal.com');
      expect(score.risk).toBe('critical');
      expect(score.signals[0].technique).toBe('homoglyph');
    });

    it('should detect subdomain abuse', () => {
      const score = domainScorer.scoreDomain('paypal.com.secure-login.io');
      expect(score.risk).toBe('critical');
      expect(score.signals[0].technique).toBe('subdomain_abuse');
    });

    it('should detect TLD swaps', () => {
      const score = domainScorer.scoreDomain('google.co');
      expect(score.risk).toBe('high');
      expect(score.signals[0].technique).toBe('tld_swap');
    });
  });

  describe('URL Firewall (Issue 3.5)', () => {
    it('should block known-bad domains', async () => {
      const result = await urlFirewall.checkUrl('https://phishing-demo.example');
      expect(result.verdict).toBe('block');
    });

    it('should allow explicitly trusted domains', async () => {
      const result = await urlFirewall.checkUrl('https://github.com/login');
      expect(result.verdict).toBe('allow');
    });

    it('should block data: URIs', async () => {
      const result = await urlFirewall.checkUrl('data:text/html,<html>PWNED</html>');
      expect(result.verdict).toBe('block');
    });
  });

  describe('Redirect Chain Auditor (Issue 3.3)', () => {
    it('should detect trust boundary crossing', async () => {
      const chain = {
        taskId: 'task-1',
        intendedDestination: 'https://paypal.com',
        chainStartedAt: Date.now(),
        finalDestination: 'https://paypal.com.evil.com', // critical subdomain abuse
        crossedTrustBoundary: false,
        hops: [
          { url: 'https://paypal.com', domain: 'paypal.com', transitionType: 'link' },
          { url: 'https://paypal.com.evil.com', domain: 'paypal.com.evil.com', transitionType: 'redirect' },
        ],
      };

      const result = await redirectAuditor.auditChain(chain as any, ['paypal.com']);
      expect(result.crossedTrustBoundary).toBe(true);
      expect(result.reason).toContain('Trust boundary crossed');
    });
  });
});
