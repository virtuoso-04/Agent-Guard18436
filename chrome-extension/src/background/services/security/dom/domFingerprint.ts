/**
 * Cryptographic DOM Element Fingerprinting (Issue 2.1).
 *
 * Binds navigator actions to the *identity* of a DOM element rather than its
 * index or CSS selector, which can silently shift when the page mutates.
 *
 * Before executing each planned action the Navigator:
 *   1. Calls `computeFingerprint()` during planning to capture the element identity.
 *   2. Calls `verifyFingerprint()` immediately before execution.
 *   3. Aborts if the fingerprint has changed — the element was substituted.
 *
 * The hash covers:
 *   - tagName (lowercased)
 *   - Stable attributes: type, name, role, aria-label, placeholder, href, value (first 40 chars)
 *   - Visible text content (first 80 chars, normalised whitespace)
 *   - xpath (if available — primary disambiguation key)
 */

import { DOMElementNode, DOMTextNode } from '../../../browser/dom/views';
import type { DOMBaseNode } from '../../../browser/dom/views';
import { createLogger } from '@src/background/log';

const logger = createLogger('DomFingerprint');

/** Attributes included in the fingerprint. Dynamic/ephemeral attrs are excluded. */
const STABLE_ATTRS = ['type', 'name', 'role', 'aria-label', 'aria-labelledby', 'placeholder', 'href', 'data-testid'];

export interface ElementFingerprint {
  /** SHA-256 hex digest of the element's stable properties */
  hash: string;
  /** Human-readable summary of what was hashed (for debugging / logging) */
  descriptor: string;
  /** Unix ms timestamp when the fingerprint was captured */
  capturedAt: number;
}

export interface FingerprintVerificationResult {
  matched: boolean;
  original: ElementFingerprint;
  current: ElementFingerprint | null;
  /** Reason when `matched === false` */
  reason?: string;
}

/**
 * Extract visible text content from a node (depth-first, up to `maxChars`).
 */
function extractText(node: DOMBaseNode, maxChars = 80): string {
  const parts: string[] = [];
  let total = 0;

  const traverse = (n: DOMBaseNode) => {
    if (total >= maxChars) return;
    if (n instanceof DOMTextNode && n.isVisible && n.text.trim()) {
      const chunk = n.text.trim().slice(0, maxChars - total);
      parts.push(chunk);
      total += chunk.length;
    }
    if (n instanceof DOMElementNode) {
      for (const child of n.children) {
        if (total >= maxChars) break;
        traverse(child);
      }
    }
  };

  traverse(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build the raw string that is hashed for a given element.
 * Must be deterministic: same element → same string every call.
 */
function buildFingerprintPayload(element: DOMElementNode): string {
  const tag = (element.tagName ?? 'unknown').toLowerCase();
  const attrs = STABLE_ATTRS.map(a => {
    const v = element.attributes[a];
    return v ? `${a}=${v.slice(0, 40)}` : '';
  })
    .filter(Boolean)
    .join(',');

  const text = extractText(element);
  const xpath = element.xpath ?? '';

  return [tag, attrs, text, xpath].join('|');
}

/**
 * Compute a SHA-256 fingerprint for a DOM element.
 */
export async function computeFingerprint(element: DOMElementNode): Promise<ElementFingerprint> {
  const payload = buildFingerprintPayload(element);
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const descriptor = payload.slice(0, 120);
  logger.debug(`Fingerprinted element: ${descriptor}`);

  return { hash, descriptor, capturedAt: Date.now() };
}

/**
 * Re-compute the fingerprint for `currentElement` and compare it against
 * a previously captured `original` fingerprint.
 *
 * Returns `matched: true` only if the hashes are identical.
 */
export async function verifyFingerprint(
  original: ElementFingerprint,
  currentElement: DOMElementNode,
): Promise<FingerprintVerificationResult> {
  let current: ElementFingerprint | null = null;
  try {
    current = await computeFingerprint(currentElement);
  } catch (err) {
    return {
      matched: false,
      original,
      current: null,
      reason: `Failed to compute current fingerprint: ${err}`,
    };
  }

  if (current.hash !== original.hash) {
    logger.warning(`DOM fingerprint mismatch! Element identity changed between planning and execution.`);
    logger.warning(`  Original: ${original.descriptor}`);
    logger.warning(`  Current:  ${current.descriptor}`);
    return {
      matched: false,
      original,
      current,
      reason: `Hash mismatch: element was mutated or substituted after planning (age: ${Date.now() - original.capturedAt}ms)`,
    };
  }

  return { matched: true, original, current };
}
