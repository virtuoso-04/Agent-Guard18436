import { domainScorer, type DomainTrustScore } from '../services/phishing/domainScorer';

/**
 * Checks if a URL is allowed based on firewall configuration
 * @param url The URL to check
 * @param allowList The allow list
 * @param denyList The deny list
 * @returns True if the URL is allowed, false otherwise
 */
export interface FirewallDecision {
  allowed: boolean;
  reason: 'explicit_allow' | 'explicit_deny' | 'reputation_block' | 'default_allow' | 'default_deny' | 'dangerous_prefix';
  reputationScore?: DomainTrustScore;
}

export function isUrlAllowed(url: string, allowList: string[], denyList: string[]): boolean {
  const decision = evaluateUrlSync(url, allowList, denyList);
  return decision.allowed;
}

function evaluateUrlSync(url: string, allowList: string[], denyList: string[]): FirewallDecision {
  // Normalize and validate input
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return { allowed: false, reason: 'dangerous_prefix' };
  }

  const lowerCaseUrl = trimmedUrl.toLowerCase();

  // ALWAYS block dangerous/forbidden URLs
  const DANGEROUS_PREFIXES = [
    'https://chromewebstore.google.com',
    'chrome-extension://',
    'chrome://',
    'javascript:',
    'data:',
    'file:',
    'vbscript:',
    'ws:',
    'wss:',
  ];

  if (DANGEROUS_PREFIXES.some(prefix => lowerCaseUrl.startsWith(prefix))) {
    return { allowed: false, reason: 'dangerous_prefix' };
  }

  // Special case: Allow 'about:blank' explicitly
  if (trimmedUrl === 'about:blank' || trimmedUrl === 'chrome://new-tab-page/' || trimmedUrl === 'chrome://new-tab-page') {
    return { allowed: true, reason: 'default_allow' };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const fullUrlPath = hostname + parsedUrl.pathname + parsedUrl.search;

    // Reputation check (Issues 3.1 & 3.5)
    // We do this sync if possible, but domainScorer is sync anyway
    const trust = domainScorer.scoreDomain(hostname);
    if (trust.risk === 'critical') {
      return { allowed: false, reason: 'reputation_block', reputationScore: trust };
    }

    // 1. Check against deny list (exact domain or subdomain)
    for (const deniedEntry of denyList) {
      const normalizedRule = deniedEntry.toLowerCase();
      if (hostname === normalizedRule || hostname.endsWith('.' + normalizedRule) || fullUrlPath.startsWith(normalizedRule)) {
        return { allowed: false, reason: 'explicit_deny' };
      }
    }

    // 2. Check against allow list
    for (const allowedEntry of allowList) {
      const normalizedRule = allowedEntry.toLowerCase();
      if (hostname === normalizedRule || hostname.endsWith('.' + normalizedRule) || fullUrlPath.startsWith(normalizedRule)) {
        return { allowed: true, reason: 'explicit_allow' };
      }
    }

    // Default policy
    if (allowList.length === 0) {
      return { allowed: true, reason: 'default_allow' };
    } else {
      return { allowed: false, reason: 'default_deny' };
    }
  } catch (error) {
    return { allowed: false, reason: 'dangerous_prefix' };
  }
}

export async function evaluateUrl(url: string, allowList: string[], denyList: string[]): Promise<FirewallDecision> {
  // Currently scoring is sync, but we want to allow for future async sources (reputation APIs)
  return evaluateUrlSync(url, allowList, denyList);
}

// Check if a URL is a new tab page (about:blank or chrome://new-tab-page).
export function isNewTabPage(url: string): boolean {
  return url === 'about:blank' || url === 'chrome://new-tab-page' || url === 'chrome://new-tab-page/';
}

export function capTextLength(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + '...';
  }
  return text;
}
