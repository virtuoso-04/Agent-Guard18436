import { describe, it, expect } from 'vitest';
import { pageAnalyzer } from '../pageAnalyzer';
import { type BrowserState } from '@src/background/browser/views';

describe('Phase 3: Phishing Page Analyzer', () => {
  it('Password form on HTTP page → critical risk', async () => {
    const mockState = {
      selectorMap: new Map([
        [1, { tagName: 'input', attributes: { type: 'password' } } as any],
      ])
    } as unknown as BrowserState;
    const result = await pageAnalyzer.analyze(mockState, 'http://insecure-site.com');
    expect(result.risk).toBe('critical');
    expect(result.signals.some(s => s.type === 'CREDENTIAL_FORM_ON_HTTP')).toBe(true);
  });

  it('Title "Google Account" on evil.com → high risk', async () => {
    const mockState = {
      title: 'Google Account Login',
      selectorMap: new Map()
    } as unknown as BrowserState;
    const result = await pageAnalyzer.analyze(mockState, 'https://evil.com');
    expect(result.risk).toBe('high');
    expect(result.signals.some(s => s.type === 'DOMAIN_TITLE_MISMATCH')).toBe(true);
  });

  it('Urgency language in text', async () => {
    const mockState = {
      selectorMap: new Map([
        [1, { tagName: 'div', text: 'Your account is suspended! Verify immediately.' } as any]
      ])
    } as unknown as BrowserState;
    const result = await pageAnalyzer.analyze(mockState, 'https://unknown.com');
    expect(result.signals.some(s => s.type === 'URGENCY_LANGUAGE')).toBe(true);
  });

  it('Suspicious form target', async () => {
    const mockState = {
      selectorMap: new Map([
        [1, { tagName: 'form', attributes: { action: 'https://attacker.com/collect' } } as any]
      ])
    } as unknown as BrowserState;
    const result = await pageAnalyzer.analyze(mockState, 'https://legit-site.com');
    expect(result.signals.some(s => s.type === 'SUSPICIOUS_FORM_TARGET')).toBe(true);
  });

  it('Legitimate Google login page → zero signals', async () => {
    const mockState = {
      title: 'Sign in - Google Accounts',
      selectorMap: new Map()
    } as unknown as BrowserState;
    const result = await pageAnalyzer.analyze(mockState, 'https://accounts.google.com');
    expect(result.risk).toBe('none');
    expect(result.signals.length).toBe(0);
  });
});
