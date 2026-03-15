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
 * Characters to strip/normalize beyond standard NFKC.
 */
const WORD_SPLITTERS = /[\u200B-\u200C\u200D\uFEFF\u00AD]/g;
const CONTROL_CHARS = /[\u00A0\u034F\u200E\u200F\u202A-\u202E\u2060-\u206F\u3000]/g;

/**
 * Pre-processes content for consistent scanning.
 */
function preProcessContent(content: string): { normalized: string; mixedScript: boolean } {
  // 1. NFKC normalization
  let current = (content || '').normalize('NFKC');

  // 2. Strip word-splitters to allow middle-of-word detection (e.g., ig\u200Bnore -> ignore)
  current = current.replace(WORD_SPLITTERS, '');

  // 3. Replace control/Bidi chars with space to preserve word boundaries (e.g., ignore\u202Eprevious -> ignore previous)
  current = current.replace(CONTROL_CHARS, ' ');

  const mixedScript = hasMixedScripts(current);

  // 4. Homoglyph normalization
  current = normalizeHomoglyphs(current);

  return { normalized: current, mixedScript };
}

/**
 * Apply a single pass of all security patterns to the content.
 */
function applySinglePass(input: string, strict: boolean): { output: string; foundThreats: Set<ThreatType> } {
  const foundThreats = new Set<ThreatType>();
  let output = input;

  const patterns = getPatterns(strict);

  for (const rule of patterns) {
    try {
      const testRegex = new RegExp(rule.pattern.source, rule.pattern.flags);

      if (testRegex.test(output)) {
        foundThreats.add(rule.type);

        const replaceRegex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const replacement = rule.replacement ?? '';
        output = output.replace(replaceRegex, replacement as any);

        logger.debug(`[pass] Sanitized rule "${rule.id}": ${rule.description}`);
      }
    } catch (error) {
      logger.error(`Error processing pattern "${rule.id}":`, error);
    }
  }

  return { output, foundThreats };
}

/**
 * Sanitize untrusted content.
 */
export function sanitizeContent(content: string | undefined, strict: boolean = false): SanitizationResult {
  if (!content || content.trim() === '') {
    return { sanitized: '', threats: [], modified: false };
  }

  const { normalized, mixedScript } = preProcessContent(content);
  let current = normalized;

  const allThreats = new Set<ThreatType>();

  // Deep inspection (Base64, Entities)
  const encodedThreats = detectEncodedThreats(current, strict);
  encodedThreats.forEach(t => allThreats.add(t));

  // Multi-pass pattern loop
  let passes = 0;
  do {
    const prev = current;
    const { output, foundThreats } = applySinglePass(current, strict);
    foundThreats.forEach(t => allThreats.add(t));
    current = output;
    passes++;
    if (current === prev) break;
  } while (passes < MAX_PASSES);

  if (passes >= MAX_PASSES) {
    logger.info(`Sanitizer did not converge after ${MAX_PASSES} passes`);
  }

  // Post-pass cleanup
  let sanitized = current
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  sanitized = cleanEmptyTags(sanitized);

  return {
    sanitized,
    threats: Array.from(allThreats),
    modified: sanitized !== content || mixedScript || encodedThreats.length > 0,
  };
}

/**
 * Detect threats without modifying content.
 */
export function detectThreats(content: string, strict: boolean = false): ThreatType[] {
  if (!content || content.trim() === '') return [];

  const { normalized } = preProcessContent(content);
  const detectedThreats = new Set<ThreatType>();
  const patterns = getPatterns(strict);

  for (const rule of patterns) {
    try {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      if (regex.test(normalized)) {
        detectedThreats.add(rule.type);
        logger.debug(`Threat detected: rule "${rule.id}"`);
      }
    } catch (error) {
      logger.error(`Error testing pattern "${rule.id}":`, error);
    }
  }

  const encodedThreats = detectEncodedThreats(normalized, strict);
  encodedThreats.forEach(t => detectedThreats.add(t));

  return Array.from(detectedThreats);
}

export function cleanEmptyTags(content: string): string {
  const emptyPairPattern = /<(\w+)[^>]*>\s*<\/\1>/g;
  const result = content.replace(emptyPairPattern, '');
  const strayEmptyTagPattern = /<\s*\/?\s*>/g;
  return result.replace(strayEmptyTagPattern, '');
}

function detectEncodedThreats(content: string, strict: boolean): ThreatType[] {
  const threats = new Set<ThreatType>();

  // Base64
  const base64Regex = /\b[A-Za-z0-9+/]{12,}(?:==| =)?\b/g;
  let match;
  while ((match = base64Regex.exec(content)) !== null) {
    try {
      const decoded = atob(match[0]);
      if (decoded.length > 5) {
        scanForThreats(decoded, strict).forEach(t => threats.add(t));
      }
    } catch {}
  }

  // Entities
  if (content.includes('&#')) {
    const decoded = content.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
    scanForThreats(decoded, strict).forEach(t => threats.add(t));
  }

  return Array.from(threats);
}

function scanForThreats(content: string, strict: boolean): ThreatType[] {
  const { normalized } = preProcessContent(content);
  const detectedThreats = new Set<ThreatType>();
  const patterns = getPatterns(strict);

  for (const rule of patterns) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (regex.test(normalized)) {
      detectedThreats.add(rule.type);
    }
  }

  return Array.from(detectedThreats);
}
