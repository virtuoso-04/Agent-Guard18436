/**
 * Content sanitizer — multi-pass engine with convergent recursion.
 *
 * Attack vectors addressed:
 *  - Nested-tag bypass  (<in<instruction>struction> collapses on pass 2)
 *  - Unicode space bypass  (U+00A0, U+200B, U+3000, etc.)
 *  - Homoglyph bypass  (Cyrillic `а` looks like Latin `a`)
 *  - Mixed-script tokens  (caught by hasMixedScripts)
 *  - Standard regex-pattern attacks  (task override, prompt injection, sensitive data)
 */

import type { SanitizationResult, ThreatType } from './types';
import { getPatterns } from './patterns';
import { normalizeHomoglyphs, hasMixedScripts } from './confusables';
import { createLogger } from '@src/background/log';

const logger = createLogger('SecuritySanitizer');

/** Maximum sanitization passes before we declare convergence */
const MAX_PASSES = 10;

/**
 * Characters to strip beyond standard NFKC normalization.
 * Covers invisible/control characters that evade word-boundary patterns.
 *
 * Ranges stripped:
 *  U+00A0  NO-BREAK SPACE
 *  U+00AD  SOFT HYPHEN
 *  U+034F  COMBINING GRAPHEME JOINER
 *  U+200B–U+200F  zero-width chars (ZWSP, ZWNJ, ZWJ, LRM, RLM)
 *  U+2028–U+2029  line/paragraph separators
 *  U+202A–U+202E  bidi overrides (can reverse displayed text)
 *  U+2060–U+2064  invisible operators
 *  U+3000  IDEOGRAPHIC SPACE
 *  U+FEFF  BOM / zero-width no-break space
 */
const INVISIBLE_CHARS_REGEX = /[\u00A0\u00AD\u034F\u200B-\u200F\u2028-\u202E\u2060-\u2064\u3000\uFEFF]/g;

/**
 * Apply a single pass of all security patterns to the content.
 * Returns the processed string and the set of threat types found.
 */
function applySinglePass(input: string, strict: boolean): { output: string; foundThreats: Set<ThreatType> } {
  const foundThreats = new Set<ThreatType>();
  let output = input;

  const patterns = getPatterns(strict);

  for (const rule of patterns) {
    try {
      // Fresh RegExp instance per rule per pass to reset lastIndex
      const testRegex = new RegExp(rule.pattern.source, rule.pattern.flags);

      if (testRegex.test(output)) {
        foundThreats.add(rule.type);

        const replaceRegex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const replacement = rule.replacement ?? '';
        output =
          typeof replacement === 'function'
            ? output.replace(replaceRegex, replacement)
            : output.replace(replaceRegex, replacement);

        logger.debug(`[pass] Sanitized rule "${rule.id}": ${rule.description}`);
      }
    } catch (error) {
      logger.error(`Error processing pattern "${rule.id}":`, error);
      // Continue — never let a bad pattern abort the whole pipeline
    }
  }

  return { output, foundThreats };
}

/**
 * Sanitize untrusted content by removing dangerous patterns.
 *
 * @param content - Raw untrusted content
 * @param strict  - Use strict mode with additional patterns
 * @returns SanitizationResult with cleaned content, detected threats, and modified flag
 */
export function sanitizeContent(content: string | undefined, strict: boolean = false): SanitizationResult {
  if (!content || content.trim() === '') {
    return { sanitized: '', threats: [], modified: false };
  }

  // ── Step 1: NFKC normalization (handles fullwidth chars, ligatures, etc.) ──
  let current = content.normalize('NFKC');

  // ── Step 2: Strip invisible/control characters ───────────────────────────
  current = current.replace(INVISIBLE_CHARS_REGEX, '');

  // ── Step 3: Homoglyph normalization (Cyrillic/Greek → Latin) ────────────
  current = normalizeHomoglyphs(current);

  // ── Step 4: Mixed-script detection (flag but don't modify) ──────────────
  const mixedScript = hasMixedScripts(current);

  // ── Step 5: Convergent multi-pass pattern loop ───────────────────────────
  // Each pass may expose new patterns (e.g. <in<instruction>struction> →
  // after inner tag removed → <instruction> → caught in pass 2).
  const allThreats = new Set<ThreatType>();
  let passes = 0;

  do {
    const prev = current;
    const { output, foundThreats } = applySinglePass(current, strict);
    foundThreats.forEach(t => allThreats.add(t));
    current = output;
    passes++;

    if (current === prev) break; // Converged — no further changes
  } while (passes < MAX_PASSES);

  if (passes >= MAX_PASSES) {
    logger.info(`Sanitizer did not converge after ${MAX_PASSES} passes — possible pathological input`);
  }

  const wasModified = current !== content;

  // ── Step 6: Post-pass cleanup ────────────────────────────────────────────
  if (wasModified || mixedScript) {
    current = current
      .replace(/[^\S\r\n]+/g, ' ') // Collapse spaces/tabs (keep newlines)
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive blank lines
      .trim();

    current = cleanEmptyTags(current);
  }

  return {
    sanitized: current,
    threats: Array.from(allThreats),
    modified: wasModified,
  };
}

/**
 * Detect threats in content without modifying it.
 * Useful for read-only analysis (e.g., threat audit logging before sanitization).
 */
export function detectThreats(content: string, strict: boolean = false): ThreatType[] {
  if (!content || content.trim() === '') return [];

  // Normalise first so patterns have the same view as sanitizeContent
  let normalised = content.normalize('NFKC').replace(INVISIBLE_CHARS_REGEX, '');
  normalised = normalizeHomoglyphs(normalised);

  const detectedThreats = new Set<ThreatType>();
  const patterns = getPatterns(strict);

  for (const rule of patterns) {
    try {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      if (regex.test(normalised)) {
        detectedThreats.add(rule.type);
        logger.debug(`Threat detected: rule "${rule.id}" — ${rule.description}`);
      }
    } catch (error) {
      logger.error(`Error testing pattern "${rule.id}":`, error);
    }
  }

  return Array.from(detectedThreats);
}

/**
 * Remove empty tag pairs and stray empty tags left after sanitization.
 * E.g. <tag></tag>  →  ''
 *      <>text</>    →  'text'
 */
export function cleanEmptyTags(content: string): string {
  const emptyPairPattern = /<(\w+)[^>]*>\s*<\/\1>/g;
  let result = content.replace(emptyPairPattern, '');
  const strayEmptyTagPattern = /<\s*\/?\s*>/g;
  result = result.replace(strayEmptyTagPattern, '');
  return result;
}
