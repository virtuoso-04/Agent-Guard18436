import { describe, it, expect } from 'vitest';
import { credentialVerifier, type CredentialContext } from '../credentialVerifier';

describe('Phase 3: Credential Verifier', () => {
  const context: CredentialContext = {
    taskId: 'test-task',
    expectedDomains: ['paypal.com', 'www.paypal.com'],
    credentialType: 'password',
    extractedFrom: 'task_text',
  };

  it('Typing password on correct domain → allowed', () => {
    const result = credentialVerifier.verifyDomain('https://www.paypal.com/login', context, 'password');
    expect(result.allowed).toBe(true);
  });

  it('Typing password on subdomain of correct domain → allowed', () => {
    const result = credentialVerifier.verifyDomain('https://checkout.paypal.com/pay', context, 'password');
    expect(result.allowed).toBe(true);
  });

  it('Typing password on lookalike (paypa1.com) → BLOCKED', () => {
    const result = credentialVerifier.verifyDomain('https://paypa1.com/login', context, 'password');
    expect(result.allowed).toBe(false);
    expect(result.isLookalike).toBe(true);
    expect(result.reason).toContain('LOOKALIKE');
  });

  it('Typing password on unrelated domain → BLOCKED', () => {
    const result = credentialVerifier.verifyDomain('https://evil.com/login', context, 'password');
    expect(result.allowed).toBe(false);
    expect(result.isLookalike).toBe(false);
    expect(result.reason).toContain('UNRELATED');
  });

  it('Password input on HTTP page → hard block', () => {
    const result = credentialVerifier.verifyDomain('http://paypal.com/login', context, 'password');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('HTTP');
  });

  it('No credential context + password field → allowed (with warning)', () => {
    const result = credentialVerifier.verifyDomain('https://some-site.com/login', null, 'password');
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('No credential context');
  });
});
