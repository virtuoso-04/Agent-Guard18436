import { describe, it, expect } from 'vitest';
import { redirectAuditor } from '../redirectAuditor';
import { type NavigationChain } from '@src/background/browser/views';

describe('Phase 3: Redirect Chain Auditor', () => {
  it('Single-hop (no redirect): chain has 1 entry, no boundary crossed', async () => {
    const chain: NavigationChain = {
      taskId: 'test-task',
      intendedDestination: 'https://google.com',
      hops: [
        { url: 'https://google.com', domain: 'google.com', timestamp: Date.now(), transitionType: 'link', transitionQualifiers: [] }
      ],
      finalDestination: 'https://google.com',
      crossedTrustBoundary: false,
      chainStartedAt: Date.now()
    };
    const result = await redirectAuditor.auditChain(chain, ['google.com']);
    expect(result.crossedTrustBoundary).toBe(false);
  });

  it('302 redirect from trusted to untrusted (lookalike): TRUST_BOUNDARY_CROSSED emitted', async () => {
    const chain: NavigationChain = {
        taskId: 'test-task',
        intendedDestination: 'https://google.com',
        hops: [
          { url: 'https://google.com', domain: 'google.com', timestamp: Date.now(), transitionType: 'link', transitionQualifiers: [] },
          { url: 'https://paypa1.com', domain: 'paypa1.com', timestamp: Date.now(), transitionType: 'server_redirect', transitionQualifiers: [] }
        ],
        finalDestination: 'https://paypa1.com',
        crossedTrustBoundary: false,
        chainStartedAt: Date.now()
      };
      const result = await redirectAuditor.auditChain(chain, ['google.com']);
      expect(result.crossedTrustBoundary).toBe(true);
      expect(result.violatedHop?.domain).toBe('paypa1.com');
  });

  it('302 redirect from trusted to trusted: no event', async () => {
    const chain: NavigationChain = {
        taskId: 'test-task',
        intendedDestination: 'https://google.com',
        hops: [
          { url: 'https://google.com', domain: 'google.com', timestamp: Date.now(), transitionType: 'link', transitionQualifiers: [] },
          { url: 'https://gmail.com', domain: 'gmail.com', timestamp: Date.now(), transitionType: 'server_redirect', transitionQualifiers: [] }
        ],
        finalDestination: 'https://gmail.com',
        crossedTrustBoundary: false,
        chainStartedAt: Date.now()
      };
      // For this test, assume domainScorer knows gmail.com is safe or it's in allow list
      const result = await redirectAuditor.auditChain(chain, ['google.com', 'gmail.com']);
      expect(result.crossedTrustBoundary).toBe(false);
  });
});
