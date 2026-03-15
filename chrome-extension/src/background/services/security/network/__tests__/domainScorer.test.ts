import { describe, it, expect } from 'vitest';
import { domainScorer } from '../domainScorer';

describe('Phase 3: Phishing Domain Scorer', () => {
  it('paypa1.com → editDistance=1 from paypal.com → critical', () => {
    const result = domainScorer.scoreDomain('paypa1.com');
    expect(result.risk).toBe('critical');
    expect(result.signals[0].technique).toBe('numeric_substitution');
    expect(result.signals[0].closestMatch).toBe('paypal.com');
  });

  it('аmazon.com (Cyrillic) → homoglyph match → critical', () => {
    const result = domainScorer.scoreDomain('аmazon.com');
    expect(result.risk).toBe('critical');
    expect(result.signals[0].technique).toBe('homoglyph');
    expect(result.signals[0].closestMatch).toBe('amazon.com');
  });

  it('paypal.com.evil.io → subdomain abuse → critical', () => {
    const result = domainScorer.scoreDomain('paypal.com.evil.io');
    expect(result.risk).toBe('critical');
    expect(result.signals[0].technique).toBe('subdomain_abuse');
    expect(result.signals[0].closestMatch).toBe('paypal.com');
  });

  it('microsoft.net → TLD swap → high', () => {
    const result = domainScorer.scoreDomain('microsoft.net');
    expect(result.risk).toBe('high');
    expect(result.signals[0].technique).toBe('tld_swap');
    expect(result.signals[0].closestMatch).toBe('microsoft.com');
  });

  it('pay-pal.com → hyphen insertion → high', () => {
    const result = domainScorer.scoreDomain('pay-pal.com');
    expect(result.risk).toBe('high');
    expect(result.signals[0].technique).toBe('hyphen_insertion');
    expect(result.signals[0].closestMatch).toBe('paypal.com');
  });

  it('github.com (exact match on safe list) → score=100, risk=none', () => {
    const result = domainScorer.scoreDomain('github.com');
    expect(result.score).toBe(100);
    expect(result.risk).toBe('none');
    expect(result.signals.length).toBe(0);
  });

  it('mycustomapp.io (no similarity to known targets) → risk=none', () => {
    const result = domainScorer.scoreDomain('mycustomapp.io');
    expect(result.risk).toBe('none');
  });

  it('Performance: scoring 50 domains < 500ms total', () => {
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      domainScorer.scoreDomain(`random-app-${i}.com`);
    }
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(500);
  });
});
