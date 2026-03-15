/**
 * Phase 2 Integration Test Suite — DOM Mutation Attack Scenarios (Issue 2.6)
 *
 * Covers:
 *  - [2.1] Cryptographic DOM element fingerprinting detects element substitution
 *  - [2.3] DOM taint analysis redacts sensitive values before LLM context
 *  - [2.4] Atomic snapshot locking detects DOM mutations between plan & execute
 *
 * All scenarios simulate real zero-click / DOM-substitution attack patterns.
 */

import { describe, it, expect } from 'vitest';
import { computeFingerprint, verifyFingerprint } from '../../dom/domFingerprint';
import { captureSnapshot, verifySnapshot, buildPageStateSummary } from '../../dom/atomicLock';
import { DomTaintAnalyzer } from '../domTaint';
import { DOMElementNode } from '../../../../browser/dom/views';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeElement(params: { tag: string; attrs?: Record<string, string>; xpath?: string }): DOMElementNode {
  return new DOMElementNode({
    tagName: params.tag,
    xpath: params.xpath ?? `//body/${params.tag}`,
    attributes: params.attrs ?? {},
    children: [],
    isVisible: true,
    isInteractive: true,
    highlightIndex: 1,
  });
}

// ── [2.1] DOM Element Fingerprinting ────────────────────────────────────────

describe('[2.1] Cryptographic DOM Element Fingerprinting', () => {
  it('produces a consistent hash for the same element', async () => {
    const el = makeElement({ tag: 'button', attrs: { name: 'submit', type: 'submit' }, xpath: '//form/button' });
    const fp1 = await computeFingerprint(el);
    const fp2 = await computeFingerprint(el);
    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.hash).toHaveLength(64); // SHA-256 hex
  });

  it('detects an element substituted with a different tag (button → input)', async () => {
    const planned = makeElement({ tag: 'button', attrs: { name: 'confirm' }, xpath: '//form/button' });
    const original = await computeFingerprint(planned);

    // Attacker substitutes the button with a different element
    const malicious = makeElement({ tag: 'input', attrs: { name: 'confirm', type: 'hidden' }, xpath: '//form/button' });
    const result = await verifyFingerprint(original, malicious);

    expect(result.matched).toBe(false);
    expect(result.reason).toMatch(/mismatch/i);
  });

  it('detects an element whose aria-label was silently changed', async () => {
    const planned = makeElement({
      tag: 'button',
      attrs: { 'aria-label': 'Transfer $10', name: 'transfer' },
      xpath: '//div/button[1]',
    });
    const original = await computeFingerprint(planned);

    // Attacker changes the label to a higher amount
    const mutated = makeElement({
      tag: 'button',
      attrs: { 'aria-label': 'Transfer $10000', name: 'transfer' },
      xpath: '//div/button[1]',
    });
    const result = await verifyFingerprint(original, mutated);

    expect(result.matched).toBe(false);
  });

  it('accepts the same element unchanged (true-positive pass)', async () => {
    const el = makeElement({ tag: 'a', attrs: { href: '/checkout', role: 'button' }, xpath: '//nav/a[3]' });
    const original = await computeFingerprint(el);
    const result = await verifyFingerprint(original, el);
    expect(result.matched).toBe(true);
  });

  it('detects element replaced by lookalike with different href', async () => {
    const planned = makeElement({ tag: 'a', attrs: { href: 'https://bank.com/pay' }, xpath: '//div/a[2]' });
    const original = await computeFingerprint(planned);

    const malicious = makeElement({ tag: 'a', attrs: { href: 'https://evil.com/pay' }, xpath: '//div/a[2]' });
    const result = await verifyFingerprint(original, malicious);

    expect(result.matched).toBe(false);
  });
});

// ── [2.3] DOM Taint Analysis ─────────────────────────────────────────────────

describe('[2.3] DOM Taint Analysis — Sensitive Value Redaction', () => {
  const analyzer = new DomTaintAnalyzer();

  it('redacts JWT tokens from data attributes', () => {
    const el = makeElement({
      tag: 'div',
      attrs: {
        'data-auth':
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      },
    });
    analyzer.redactSensitiveAttributes(el);
    expect(el.attributes['data-auth']).toBe('[REDACTED]');
  });

  it('redacts api_key values regardless of attribute name', () => {
    // Use a JWT as the value — matches SENSITIVE_VALUE_PATTERNS eyJ... pattern
    const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflK';
    const el = makeElement({
      tag: 'input',
      attrs: { name: 'api_key', value: jwtToken },
    });
    analyzer.redactSensitiveAttributes(el);
    expect(el.attributes['name']).toBe('[REDACTED]');
    expect(el.attributes['value']).toBe('[REDACTED]');
  });

  it('redacts hidden input values (CSRF tokens, session ids)', () => {
    const el = makeElement({
      tag: 'input',
      attrs: { type: 'hidden', name: '_csrf', value: 'tok-ABCDEF123456' },
    });
    analyzer.redactSensitiveAttributes(el);
    expect(el.attributes['value']).toBe('[REDACTED]');
  });

  it('does not redact harmless visible input values', () => {
    const el = makeElement({
      tag: 'input',
      attrs: { type: 'text', name: 'search', value: 'hello world' },
    });
    analyzer.redactSensitiveAttributes(el);
    expect(el.attributes['value']).toBe('hello world');
  });

  it('returns report with correct redaction counts', () => {
    const el = makeElement({
      tag: 'form',
      attrs: {
        'data-token': 'tok-123456',
        'data-auth-secret': 'my-secret',
        class: 'login-form',
      },
    });
    const report = analyzer.redactSensitiveAttributes(el);
    expect(report.redactedCount).toBeGreaterThanOrEqual(2);
    expect(report.redactedKeys).toContain('data-token');
  });
});

// ── [2.4] Atomic State-Snapshot-to-Action Locking ────────────────────────────

describe('[2.4] Atomic State-Snapshot-to-Action Locking', () => {
  const makeMap = (entries: [number, string][]): Map<number, { tagName: string }> =>
    new Map(entries.map(([idx, tag]) => [idx, { tagName: tag }]));

  it('locks when page state is unchanged', async () => {
    const selectorMap = makeMap([
      [1, 'button'],
      [2, 'input'],
      [3, 'a'],
    ]);
    const summary = buildPageStateSummary('https://example.com/checkout', selectorMap);
    const snapshot = await captureSnapshot(summary, 3);

    const result = await verifySnapshot(summary, snapshot);
    expect(result.locked).toBe(true);
  });

  it('detects DOM mutation — new element injected', async () => {
    const before = makeMap([
      [1, 'button'],
      [2, 'input'],
    ]);
    const summaryBefore = buildPageStateSummary('https://app.com', before);
    const snapshot = await captureSnapshot(summaryBefore, 1);

    // Attacker injects additional element
    const after = makeMap([
      [1, 'button'],
      [2, 'input'],
      [3, 'script'],
    ]);
    const summaryAfter = buildPageStateSummary('https://app.com', after);

    const result = await verifySnapshot(summaryAfter, snapshot);
    expect(result.locked).toBe(false);
    expect(result.reason).toMatch(/mutated/i);
  });

  it('detects page navigation between plan and execute', async () => {
    const selectorMap = makeMap([[1, 'button']]);
    const summary = buildPageStateSummary('https://bank.com/transfer', selectorMap);
    const snapshot = await captureSnapshot(summary, 2);

    // Attacker redirected to phishing page
    const redirectedSummary = buildPageStateSummary('https://evil.com/transfer', selectorMap);
    const result = await verifySnapshot(redirectedSummary, snapshot);

    expect(result.locked).toBe(false);
    expect(result.reason).toMatch(/navigated away/i);
  });

  it('detects element removal (count drop)', async () => {
    const before = makeMap([
      [1, 'button'],
      [2, 'input'],
      [3, 'select'],
    ]);
    const summaryBefore = buildPageStateSummary('https://form.com', before);
    const snapshot = await captureSnapshot(summaryBefore, 0);

    // Attacker removes the target button to redirect action
    const after = makeMap([
      [2, 'input'],
      [3, 'select'],
    ]);
    const summaryAfter = buildPageStateSummary('https://form.com', after);

    const result = await verifySnapshot(summaryAfter, snapshot);
    expect(result.locked).toBe(false);
  });

  it('snapshot includes HMAC signature when session key provided', async () => {
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, true, ['sign', 'verify']);
    const selectorMap = makeMap([[1, 'button']]);
    const summary = buildPageStateSummary('https://secure.com', selectorMap);
    const snapshot = await captureSnapshot(summary, 0, key);
    expect(snapshot.signature).toBeDefined();
    expect(snapshot.signature!.length).toBeGreaterThan(10);
  });
});

// ── End-to-end attack scenario: DOM substitution during form fill ─────────────

describe('E2E Scenario: Simultaneous DOM Fingerprint + Snapshot Attack', () => {
  it('both fingerprint and snapshot independently detect the substitution', async () => {
    // 1. Planner observes "Confirm Transfer" button
    const plannedButton = makeElement({
      tag: 'button',
      attrs: { 'aria-label': 'Confirm Transfer $50', name: 'confirm' },
      xpath: '//form/button[@name="confirm"]',
    });
    const fingerprint = await computeFingerprint(plannedButton);

    const selectorMap = new Map([
      [1, { tagName: 'button' }],
      [2, { tagName: 'input' }],
    ]);
    const summary = buildPageStateSummary('https://bank.com/transfer', selectorMap);
    const snapshot = await captureSnapshot(summary, 5);

    // 2. Between plan and execute, attacker mutates the DOM
    const maliciousButton = makeElement({
      tag: 'button',
      attrs: { 'aria-label': 'Confirm Transfer $5000', name: 'confirm' },
      xpath: '//form/button[@name="confirm"]',
    });
    const extendedMap = new Map([
      [1, { tagName: 'button' }],
      [2, { tagName: 'input' }],
      [3, { tagName: 'div' }],
    ]);
    const mutatedSummary = buildPageStateSummary('https://bank.com/transfer', extendedMap);

    // 3. Both checks must flag the attack
    const fpResult = await verifyFingerprint(fingerprint, maliciousButton);
    const lockResult = await verifySnapshot(mutatedSummary, snapshot);

    expect(fpResult.matched).toBe(false);
    expect(lockResult.locked).toBe(false);
  });
});
