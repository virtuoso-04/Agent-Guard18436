/**
 * Re-export from canonical location in dom/ directory.
 * The DomTaintAnalyzer performs Phase 2 DOM taint analysis — redacting sensitive
 * attributes (tokens, passwords, API keys) from the element tree before it is
 * sent to the LLM. This prevents credential leakage through the agent context window.
 *
 * Canonical source: services/security/dom/domTaint.ts
 */
export { domTaintAnalyzer, DomTaintAnalyzer, SENSITIVE_ATTR_PATTERNS, SENSITIVE_VALUE_PATTERNS } from '../dom/domTaint';
export type { TaintReport } from '../dom/domTaint';
