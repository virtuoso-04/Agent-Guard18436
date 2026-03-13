import { describe, it, expect, vi } from 'vitest';
import { domainScorer } from '../domainScorer';
import { pageAnalyzer } from '../pageAnalyzer';
import { redirectAuditor } from '../redirectAuditor';
import { credentialVerifier, type CredentialContext } from '../credentialVerifier';
import { type BrowserState, type NavigationChain } from '@src/background/browser/views';

describe('Phase 3: Phishing Detection Integration', () => {
  const allowList = ['google.com', 'paypal.com'];

  it('Scenario 1: Fake PayPal Login (Lookalike + Credential Form)', async () => {
    const url = 'https://paypa1.com/login';
    const state: BrowserState = {
      url,
      title: 'Log in to your PayPal account',
      tabId: 1,
      tabs: [],
      screenshot: null,
      scrollY: 0,
      scrollHeight: 1000,
      visualViewportHeight: 800,
      elementTree: {} as any,
      selectorMap: new Map([
        [1, { tagName: 'input', attributes: { type: 'password', name: 'password' } } as any],
        [2, { tagName: 'form', attributes: { action: 'https://evil-server.com/collect' } } as any]
      ])
    };

    // 1. Domain Scorer
    const domainResult = domainScorer.scoreDomain(url);
    expect(domainResult.risk).toBe('critical');

    // 2. Page Analyzer
    const pageResult = await pageAnalyzer.analyze(state, url);
    expect(pageResult.risk).toBe('critical'); // mismatch (0.7) + suspicious target (0.6) = 1.3

    const finalRisk = domainResult.score < pageResult.score ? domainResult.risk : pageResult.risk;
    expect(finalRisk).toBe('critical');

    // 3. Credential Verification
    const context: CredentialContext = {
      taskId: 'task-1',
      expectedDomains: ['paypal.com'],
      credentialType: 'password',
      extractedFrom: 'task_text'
    };
    const verification = credentialVerifier.verifyDomain(url, context, 'password');
    expect(verification.allowed).toBe(false);
    expect(verification.isLookalike).toBe(true);
  });

  it('Scenario 2: Redirect Chain (Trusted -> Intermediate -> Phishing)', async () => {
    const chain: NavigationChain = {
      taskId: 'task-1',
      intendedDestination: 'https://paypal.com',
      hops: [
        { url: 'https://paypal.com', domain: 'paypal.com', timestamp: 1, transitionType: 'link', transitionQualifiers: [] },
        { url: 'https://bit.ly/secure-login', domain: 'bit.ly', timestamp: 2, transitionType: 'server_redirect', transitionQualifiers: [] },
        { url: 'https://paypa1.com/login', domain: 'paypa1.com', timestamp: 3, transitionType: 'server_redirect', transitionQualifiers: [] }
      ],
      finalDestination: 'https://paypa1.com/login',
      crossedTrustBoundary: false,
      chainStartedAt: 0
    };

    const auditResult = await redirectAuditor.auditChain(chain, allowList);
    expect(auditResult.crossedTrustBoundary).toBe(true);
    expect(auditResult.violatedHop?.domain).toBe('paypa1.com');
  });

  it('Scenario 3: Credential Form on HTTP', async () => {
    const url = 'http://my-secure-bank.com/login';
    const state: BrowserState = {
        url,
        title: 'Bank Login',
        tabId: 1,
        tabs: [],
        screenshot: null,
        scrollY: 0,
        scrollHeight: 1000,
        visualViewportHeight: 800,
        elementTree: {} as any,
        selectorMap: new Map([
          [1, { tagName: 'input', attributes: { type: 'password' } } as any]
        ])
    };

    const pageResult = await pageAnalyzer.analyze(state, url);
    expect(pageResult.risk).toBe('critical'); // Password form on HTTP
    expect(pageResult.signals.some(s => s.type === 'CREDENTIAL_FORM_ON_HTTP')).toBe(true);

    const verification = credentialVerifier.verifyDomain(url, null, 'password');
    expect(verification.allowed).toBe(false);
    expect(verification.reason).toContain('HTTP');
  });
});
