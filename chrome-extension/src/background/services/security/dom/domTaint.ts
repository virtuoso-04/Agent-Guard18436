import type { DOMBaseNode } from '../../../browser/dom/views';
import { DOMElementNode } from '../../../browser/dom/views';
import { createLogger } from '@src/background/log';

const logger = createLogger('DomTaintAnalyzer');

/**
 * Patterns of attribute keys that likely contain sensitive data.
 * Matches are case-insensitive.
 */
export const SENSITIVE_ATTR_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /auth/i,
  /credit/i,
  /ssn/i,
  /cvv/i,
  /api_key/i,
  /apikey/i,
  /authorization/i,
  /private/i,
  /key/i,
  /credential/i,
];

/**
 * Values that should always be redacted regardless of the key.
 */
export const SENSITIVE_VALUE_PATTERNS = [
  /[a-zA-Z0-9+/]{40,}/, // Likely a long base64/hash token
  /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, // JWT pattern
];

export interface TaintReport {
  redactedCount: number;
  redactedKeys: string[];
}

export class DomTaintAnalyzer {
  /**
   * Recursively traverses the DOM tree and redacts sensitive attributes.
   * This is a non-destructive operation on the source objects if they are cloned,
   * but for efficiency we might mutate a copy or the original depending on usage.
   *
   * @param node The root node to start redaction from
   * @returns A report of what was redacted
   */
  public redactSensitiveAttributes(node: DOMBaseNode): TaintReport {
    const report: TaintReport = {
      redactedCount: 0,
      redactedKeys: [],
    };

    const traverse = (currentNode: DOMBaseNode) => {
      if (currentNode instanceof DOMElementNode) {
        // Redact hidden input values by default as they often contain tokens
        const isHiddenInput =
          currentNode.tagName?.toLowerCase() === 'input' && currentNode.attributes['type']?.toLowerCase() === 'hidden';

        for (const [key, value] of Object.entries(currentNode.attributes)) {
          let shouldRedact = false;

          // 1. Check key patterns
          if (SENSITIVE_ATTR_PATTERNS.some(pattern => pattern.test(key))) {
            shouldRedact = true;
          }

          // 2. Check value patterns (heuristics for tokens/secrets in values)
          if (
            !shouldRedact &&
            (SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value)) ||
              // Also redact if the value ITSELF looks like a sensitive key being passed (e.g. name="api_key")
              (value.length < 50 && SENSITIVE_ATTR_PATTERNS.some(pattern => pattern.test(value))))
          ) {
            shouldRedact = true;
          }

          // 3. Special case: hidden inputs
          if (!shouldRedact && isHiddenInput && key === 'value' && value.length > 5) {
            shouldRedact = true;
          }

          if (shouldRedact) {
            currentNode.attributes[key] = '[REDACTED]';
            report.redactedCount++;
            if (!report.redactedKeys.includes(key)) {
              report.redactedKeys.push(key);
            }
          }
        }

        // Recurse
        for (const child of currentNode.children) {
          traverse(child);
        }
      }
    };

    traverse(node);

    if (report.redactedCount > 0) {
      logger.info(`Redacted ${report.redactedCount} sensitive attributes: ${report.redactedKeys.join(', ')}`);
    }

    return report;
  }
}

export const domTaintAnalyzer = new DomTaintAnalyzer();
