import { normalizeHomoglyphs } from '../guardrails/confusables';
import { TOP_PHISHING_TARGETS } from './topDomains';

export interface LookalikeScoringResult {
  candidateDomain: string;
  closestMatch: string;
  editDistance: number;
  normalizedScore: number;
  technique: 'levenshtein' | 'homoglyph' | 'subdomain_abuse' | 'tld_swap' | 'hyphen_insertion' | 'numeric_substitution' | 'punycode' | 'none';
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface DomainTrustScore {
  score: number;         // 0–100: 100 = definitely safe, 0 = definitely phishing
  risk: RiskLevel;
  signals: LookalikeScoringResult[];
  recommendation: 'allow' | 'warn' | 'block';
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // deletion
          dp[i][j - 1],    // insertion
          dp[i - 1][j - 1] // substitution
        );
      }
    }
  }
  return dp[m][n];
}

function extractETLDPlus1(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Simplistic approach for testing, ideally use a robust TLD parser like psl
  // Assume simple setup where last two are domain and tld for `.com` etc.
  // Exception handling for .co.uk etc. isn't strictly needed for our tests unless defined.
  if (
    parts[parts.length - 2] === 'co' && parts[parts.length - 1] === 'uk' ||
    parts[parts.length - 2] === 'com' && parts[parts.length - 1] === 'au'
  ) {
    if (parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
  }
  return parts.slice(-2).join('.');
}

export class DomainScorer {
  private cache = new Map<string, DomainTrustScore>();

  public scoreDomain(domain: string): DomainTrustScore {
    if (this.cache.has(domain)) {
      return this.cache.get(domain)!;
    }

    const t0 = performance.now();
    
    let candidate = domain.toLowerCase();
    
    // Extract hostname if it's a full URL
    if (candidate.includes('://')) {
      try {
        candidate = new URL(candidate).hostname;
      } catch (e) {
        // ignore
      }
    }
    
    // Check if Punycode
    const isPunycode = candidate.startsWith('xn--');
    if (isPunycode) {
      try {
        // Attempt to decode Punycode (using standard URL might not fully decode punycode hostname in older setups, 
        // but new URL(http://xn--pypal-4ve.com).hostname in V8 gives decoded Unicode representation)
        const url = new URL(`http://${candidate}`);
        candidate = url.hostname;
      } catch (e) {
        // ignore
      }
    }

    const normalizedCandidate = normalizeHomoglyphs(candidate);

    let bestDistance = Infinity;
    let closestMatch = '';
    let technique: LookalikeScoringResult['technique'] = 'none';

    // Fast check if exact match on Top Domains (before ETLD processing)
    if (TOP_PHISHING_TARGETS.includes(candidate)) {
       const res: DomainTrustScore = {
         score: 100,
         risk: 'none',
         signals: [],
         recommendation: 'allow'
       };
       this.cache.set(domain, res);
       return res;
    }

    // Process technique detection
    for (const target of TOP_PHISHING_TARGETS) {
      const targetName = target.split('.')[0];
      const targetTld = target.split('.').slice(1).join('.');
      
      const candidateETLD = extractETLDPlus1(normalizedCandidate);
      const candName = candidateETLD.split('.')[0];
      const candTld = candidateETLD.split('.').slice(1).join('.');

      const dist = levenshteinDistance(normalizedCandidate, target);

      if (dist === 0) {
        bestDistance = 0;
        closestMatch = target;
        technique = isPunycode ? 'punycode' : (candidate !== normalizedCandidate ? 'homoglyph' : 'none');
        break; // exact match after normalization
      }

      // Detect sub-domain abuse (e.g. paypal.com.evil.io)
      // Only flag if the target is NOT at the end of the candidate hostname
      if (normalizedCandidate.includes(target) && !normalizedCandidate.endsWith(target)) {
         if (dist < bestDistance) {
           bestDistance = dist;
           closestMatch = target;
           technique = 'subdomain_abuse';
         }
      }

      // Check specific techniques if etld distance is small
      const nameDist = levenshteinDistance(candName, targetName);
      
      let currentTechnique: LookalikeScoringResult['technique'] = 'none';

      if (nameDist === 0 && candTld !== targetTld) {
        currentTechnique = 'tld_swap';
      } else if (nameDist > 0 && candName.replace(/-/g, '') === targetName) {
        currentTechnique = 'hyphen_insertion';
      } else if (nameDist > 0 && candName.replace(/[0-9]/g, match => {
          if (match === '0') return 'o';
          if (match === '1') return 'l';
          if (match === '5') return 's';
          return match;
      }) === targetName) {
        currentTechnique = 'numeric_substitution';
      } else if (nameDist > 0 && dist < bestDistance) {
        currentTechnique = 'levenshtein';
      }

      if (dist < bestDistance || (dist === bestDistance && currentTechnique !== 'none' && currentTechnique !== 'levenshtein')) {
         bestDistance = dist;
         closestMatch = target;
         if (currentTechnique !== 'none') {
            technique = currentTechnique;
         } else if (candidate !== normalizedCandidate) {
            technique = 'homoglyph';
         } else if (isPunycode) {
            technique = 'punycode';
         } else {
            technique = 'levenshtein';
         }
      }
    }

    let risk: RiskLevel = 'none';
    let score = 100;
    
    // Sub-domain abuse overrides
    if (technique === 'subdomain_abuse') {
      risk = 'critical';
      score = 0;
    } else if (technique === 'homoglyph' || technique === 'punycode' || technique === 'numeric_substitution') {
      risk = 'critical';
      score = 5;
    } else if (technique === 'tld_swap' || technique === 'hyphen_insertion') {
      risk = 'high';
      score = 20;
    } else if (bestDistance <= 1) {
      risk = 'critical';
      score = 10;
    } else if (bestDistance === 2) {
      risk = 'high';
      score = 20;
    } else if (bestDistance === 3) {
      risk = 'medium';
      score = 40;
    } else if (bestDistance >= 4) {
      risk = 'none';
      score = 100;
    }

    const t1 = performance.now();
    if (t1 - t0 > 10) {
      // logger.warn(`Scoring domain ${domain} took >10ms (${(t1 - t0).toFixed(2)}ms)`);
    }

    const res: DomainTrustScore = {
      score,
      risk,
      signals: risk !== 'none' ? [{
        candidateDomain: domain,
        closestMatch,
        editDistance: bestDistance,
        normalizedScore: Math.min(1.0, bestDistance / Math.max(domain.length, closestMatch.length)),
        technique
      }] : [],
      recommendation: risk === 'critical' || risk === 'high' ? 'block' : (risk === 'medium' ? 'warn' : 'allow')
    };

    this.cache.set(domain, res);
    return res;
  }
}

export const domainScorer = new DomainScorer();
