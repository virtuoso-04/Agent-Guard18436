import { describe, it, expect } from 'vitest';
import { DomTaintAnalyzer } from '../domTaint';
import { DOMElementNode } from '../../../../browser/dom/views';

describe('DomTaintAnalyzer', () => {
  const analyzer = new DomTaintAnalyzer();

  it('redacts sensitive attribute keys', () => {
    const node = new DOMElementNode({
      tagName: 'div',
      isVisible: true,
      xpath: '//div',
      attributes: {
        'data-token': 'abc-123',
        'auth-secret': 'super-secret',
      },
      children: [],
    });

    analyzer.redactSensitiveAttributes(node);

    expect(node.attributes['data-token']).toBe('[REDACTED]');
    expect(node.attributes['auth-secret']).toBe('[REDACTED]');
  });

  it('redacts sensitive values (heuristics)', () => {
    const node = new DOMElementNode({
      tagName: 'input',
      isVisible: true,
      xpath: '//input',
      attributes: {
        name: 'api_key', // Value itself matches pattern
        placeholder: 'Your secret here', // Value matches pattern
      },
      children: [],
    });

    analyzer.redactSensitiveAttributes(node);

    expect(node.attributes['name']).toBe('[REDACTED]');
    expect(node.attributes['placeholder']).toBe('[REDACTED]');
  });

  it('redacts hidden inputs', () => {
    const node = new DOMElementNode({
      tagName: 'input',
      isVisible: true,
      xpath: '//input',
      attributes: {
        type: 'hidden',
        value: 'session-777-888-999',
      },
      children: [],
    });

    analyzer.redactSensitiveAttributes(node);
    expect(node.attributes['value']).toBe('[REDACTED]');
  });

  it('redacts long blobs', () => {
    const node = new DOMElementNode({
      tagName: 'div',
      isVisible: true,
      xpath: '//div',
      attributes: {
        'data-config': 'A'.repeat(50),
      },
      children: [],
    });

    analyzer.redactSensitiveAttributes(node);
    expect(node.attributes['data-config']).toBe('[REDACTED]');
  });
});
