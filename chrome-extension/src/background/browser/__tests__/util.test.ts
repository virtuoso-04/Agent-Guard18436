import { describe, it, expect } from 'vitest';
import { isUrlAllowed, evaluateUrl } from '../util';

describe('Phase 3: URL Reputation & Smart Firewall', () => {
  describe('isUrlAllowed (Regression & New Features)', () => {
    it('should allow subdomains when base domain is in allow list', () => {
       expect(isUrlAllowed('https://sub.google.com', ['google.com'], [])).toBe(true);
    });

    it('should NOT allow evil- prefix bypass (Subdomain Bypass Fix)', () => {
       // rule is 'example.com'
       // 'evil-example.com' should be allowed if it's NOT in deny list
       // but here we check if a deny rule for 'example.com' blocks 'evil-example.com'
       expect(isUrlAllowed('https://evil-example.com', [], ['example.com'])).toBe(true);
    });

    it('should block subdomains when base domain is in deny list', () => {
       expect(isUrlAllowed('https://sub.evil.com', [], ['evil.com'])).toBe(false);
    });

    it('should block based on path prefix', () => {
       expect(isUrlAllowed('https://example.com/admin/dashboard', [], ['example.com/admin'])).toBe(false);
       expect(isUrlAllowed('https://example.com/home', [], ['example.com/admin'])).toBe(true);
    });

    it('should block critical reputation domains (Reputation Override)', () => {
       // paypa1.com is a critical risk lookalike
       expect(isUrlAllowed('https://paypa1.com', ['paypa1.com'], [])).toBe(false);
    });
  });

  describe('evaluateUrl', () => {
    it('should return detailed decision for block', async () => {
       const decision = await evaluateUrl('https://paypa1.com', [], []);
       expect(decision.allowed).toBe(false);
       expect(decision.reason).toBe('reputation_block');
       expect(decision.reputationScore?.risk).toBe('critical');
    });

    it('should return detailed decision for explicit allow', async () => {
        const decision = await evaluateUrl('https://google.com', ['google.com'], []);
        expect(decision.allowed).toBe(true);
        expect(decision.reason).toBe('explicit_allow');
     });
  });
});
