/**
 * URL Reputation Scoring & Smart Firewall (Issue 3.5).
 *
 * Combines static reputation lists with the lookalike domain scorer to
 * produce a per-URL firewall verdict before the navigator visits a page.
 *
 * Decision pipeline:
 *   1. Static denylist  → immediate BLOCK (known-bad domains)
 *   2. Static allowlist → immediate ALLOW (explicitly trusted)
 *   3. DomainScorer     → risk-based WARN / BLOCK for lookalike domains
 *   4. URL heuristics   → flag IP-literal URLs, data: URIs, very long paths, etc.
 *   5. Default          → ALLOW with LOW_CONFIDENCE tag
 *
 * Extensibility:
 *   - `addToDenylist()` / `addToAllowlist()` for runtime updates
 *   - `setCustomScoreThreshold()` to tune WARN vs BLOCK boundaries per deployment
 */

import { domainScorer } from './domainScorer';
import type { DomainTrustScore, RiskLevel } from './domainScorer';
import { createLogger } from '@src/background/log';

const logger = createLogger('UrlFirewall');

// ── Reputation Lists ─────────────────────────────────────────────────────────

/**
 * Domains that are unconditionally trusted by the firewall.
 * Entries are eTLD+1 (e.g., "google.com" covers subdomains).
 */
const STATIC_ALLOWLIST: ReadonlySet<string> = new Set([
  // Search & productivity
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  // Developer
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'npmjs.com',
  'pypi.org',
  // Microsoft
  'microsoft.com',
  'azure.com',
  'office.com',
  'live.com',
  'outlook.com',
  // Apple
  'apple.com',
  'icloud.com',
  // Amazon
  'amazon.com',
  'amazonaws.com',
  'aws.amazon.com',
  // Communication
  'slack.com',
  'zoom.us',
  'teams.microsoft.com',
  'discord.com',
  // Financial (major)
  'paypal.com',
  'stripe.com',
  'chase.com',
  'wellsfargo.com',
  // Social
  'linkedin.com',
  'twitter.com',
  'facebook.com',
  // Cloud
  'cloudflare.com',
  'fastly.com',
  'vercel.app',
  'netlify.app',
]);

/**
 * Domains that are always blocked regardless of scorer output.
 * Maintained as a high-confidence known-bad list.
 */
const STATIC_DENYLIST: Set<string> = new Set([
  // Test/demo malicious domains
  'phishing-demo.example',
  'malware-test.invalid',
  'evil-corp.fake',
]);

// ── URL Heuristics ───────────────────────────────────────────────────────────

const URL_HEURISTIC_PATTERNS: Array<{ pattern: RegExp; reason: string; verdict: FirewallVerdict }> = [
  // data: URIs should never be navigated to by the agent
  { pattern: /^data:/i, reason: 'data: URI navigation blocked', verdict: 'block' },
  // javascript: pseudo-URLs
  { pattern: /^javascript:/i, reason: 'javascript: URI blocked', verdict: 'block' },
  // IP literal addresses (could be internal SSRF or phishing)
  {
    pattern: /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    reason: 'IP-literal URL — possible SSRF or phishing',
    verdict: 'warn',
  },
  // Extremely long URLs (> 500 chars) — often used in phishing
  { pattern: /.{500,}/, reason: 'Unusually long URL (>500 chars)', verdict: 'warn' },
  // Encoded dots to evade detection
  { pattern: /%2e%2e|%252e/i, reason: 'URL-encoded path traversal', verdict: 'block' },
];

// ── Types ────────────────────────────────────────────────────────────────────

export type FirewallVerdict = 'allow' | 'warn' | 'block';

export interface UrlReputationResult {
  url: string;
  domain: string;
  verdict: FirewallVerdict;
  /** Aggregated risk level from all checks */
  risk: RiskLevel;
  /** Human-readable reason for the verdict */
  reason: string;
  /** Whether the domain is on the explicit allowlist */
  allowlisted: boolean;
  /** Whether the domain is on the explicit denylist */
  denylisted: boolean;
  /** Domain scorer output if computed */
  domainScore?: DomainTrustScore;
  /** Heuristic flag if triggered */
  heuristicFlag?: string;
}

// ── Thresholds ───────────────────────────────────────────────────────────────

let SCORE_WARN_THRESHOLD = 60; // score < 60 → warn
let SCORE_BLOCK_THRESHOLD = 30; // score < 30 → block

export function setCustomScoreThreshold(warn: number, block: number): void {
  SCORE_WARN_THRESHOLD = warn;
  SCORE_BLOCK_THRESHOLD = block;
}

// ── Runtime list management ──────────────────────────────────────────────────

const _runtimeAllowlist: Set<string> = new Set();
const _runtimeDenylist: Set<string> = new Set();

export function addToAllowlist(domain: string): void {
  _runtimeAllowlist.add(domain.toLowerCase().trim());
  logger.info(`Added to allowlist: ${domain}`);
}

export function addToDenylist(domain: string): void {
  _runtimeDenylist.add(domain.toLowerCase().trim());
  logger.info(`Added to denylist: ${domain}`);
}

export function removeFromAllowlist(domain: string): void {
  _runtimeAllowlist.delete(domain.toLowerCase().trim());
}

export function removeFromDenylist(domain: string): void {
  _runtimeDenylist.delete(domain.toLowerCase().trim());
}

// ── Core logic ───────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase();
  }
}

function isAllowlisted(domain: string): boolean {
  // Exact match or subdomain of allowlisted entry
  if (STATIC_ALLOWLIST.has(domain) || _runtimeAllowlist.has(domain)) return true;
  for (const entry of [...STATIC_ALLOWLIST, ..._runtimeAllowlist]) {
    if (domain === entry || domain.endsWith(`.${entry}`)) return true;
  }
  return false;
}

function isDenylisted(domain: string): boolean {
  if (STATIC_DENYLIST.has(domain) || _runtimeDenylist.has(domain)) return true;
  for (const entry of [...STATIC_DENYLIST, ..._runtimeDenylist]) {
    if (domain === entry || domain.endsWith(`.${entry}`)) return true;
  }
  return false;
}

/**
 * Evaluate the reputation of a URL and return a firewall verdict.
 *
 * @param url - The full URL to evaluate (must include scheme for heuristics)
 */
export async function checkUrl(url: string): Promise<UrlReputationResult> {
  const domain = extractDomain(url);

  // 1. URL heuristic checks (fast, no domain scorer needed)
  for (const { pattern, reason, verdict } of URL_HEURISTIC_PATTERNS) {
    if (pattern.test(url)) {
      logger.warning(`URL heuristic triggered [${verdict}]: ${reason} — ${url}`);
      return {
        url,
        domain,
        verdict,
        risk: verdict === 'block' ? 'critical' : 'high',
        reason,
        allowlisted: false,
        denylisted: false,
        heuristicFlag: reason,
      };
    }
  }

  // 2. Static denylist — unconditional block
  if (isDenylisted(domain)) {
    logger.warning(`Denylist block: ${domain}`);
    return {
      url,
      domain,
      verdict: 'block',
      risk: 'critical',
      reason: `Domain "${domain}" is on the known-bad denylist`,
      allowlisted: false,
      denylisted: true,
    };
  }

  // 3. Static allowlist — unconditional allow (skip scorer)
  if (isAllowlisted(domain)) {
    logger.debug(`Allowlist pass: ${domain}`);
    return {
      url,
      domain,
      verdict: 'allow',
      risk: 'none',
      reason: `Domain "${domain}" is explicitly trusted`,
      allowlisted: true,
      denylisted: false,
    };
  }

  // 4. Domain scorer (lookalike / homoglyph / etc.)
  const domainScore = domainScorer.scoreDomain(url);
  logger.debug(`Domain score for ${domain}: ${domainScore.score} (${domainScore.risk})`);

  let verdict: FirewallVerdict;
  let reason: string;

  if (domainScore.score < SCORE_BLOCK_THRESHOLD) {
    verdict = 'block';
    reason = `Domain "${domain}" scored ${domainScore.score}/100 — high lookalike risk (${domainScore.signals[0]?.technique ?? 'unknown'} technique detected)`;
  } else if (domainScore.score < SCORE_WARN_THRESHOLD) {
    verdict = 'warn';
    reason = `Domain "${domain}" scored ${domainScore.score}/100 — possible lookalike (closest match: ${domainScore.signals[0]?.closestMatch ?? 'unknown'})`;
  } else {
    verdict = 'allow';
    reason = `Domain "${domain}" passed all reputation checks (score: ${domainScore.score}/100)`;
  }

  return {
    url,
    domain,
    verdict,
    risk: domainScore.risk,
    reason,
    allowlisted: false,
    denylisted: false,
    domainScore,
  };
}

/**
 * Batch-check a list of URLs.
 * Returns results in the same order as the input.
 */
export async function checkUrls(urls: string[]): Promise<UrlReputationResult[]> {
  return Promise.all(urls.map(checkUrl));
}

/**
 * Convenience: returns true if navigation to this URL should be blocked.
 */
export async function shouldBlock(url: string): Promise<boolean> {
  const result = await checkUrl(url);
  return result.verdict === 'block';
}

// ── Singleton re-export ───────────────────────────────────────────────────────

export const urlFirewall = {
  checkUrl,
  checkUrls,
  shouldBlock,
  addToAllowlist,
  addToDenylist,
  removeFromAllowlist,
  removeFromDenylist,
  setCustomScoreThreshold,
};
