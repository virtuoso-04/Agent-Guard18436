import { PhishingSignalType, type PhishingSignal, URGENCY_PATTERNS, BRAND_DOMAINS } from './signals';
import { type BrowserState, type DOMElementNode } from '@src/background/browser/views';

export interface PhishingPageScore {
  score: number;
  risk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  signals: PhishingSignal[];
  recommendation: 'allow' | 'warn' | 'block';
}

export class PageAnalyzer {
  public async analyze(state: BrowserState, url: string): Promise<PhishingPageScore> {
    // Skip analysis for non-http URLs (chrome://, about:blank, extension pages, etc.)
    let hostname: string;
    try {
      const parsed = new URL(url);
      if (!parsed.protocol.startsWith('http')) {
        return { score: 100, risk: 'none', signals: [], recommendation: 'allow' };
      }
      hostname = parsed.hostname;
    } catch {
      return { score: 100, risk: 'none', signals: [], recommendation: 'allow' };
    }

    const signals: PhishingSignal[] = [];

    // Detect Credential Form on HTTP
    if (url.startsWith('http://') && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
      const hasPasswordField = Array.from(state.selectorMap.values()).some(
        (el: DOMElementNode) => el.tagName === 'input' && el.attributes?.type === 'password',
      );
      if (hasPasswordField) {
        signals.push({
          type: PhishingSignalType.CREDENTIAL_FORM_ON_HTTP,
          weight: 1.0,
          evidence: 'Credential form detected on insecure HTTP connection',
        });
      }
    }

    // Domain-Title mismatch
    const title = state.title || '';
    for (const [brand, domains] of Object.entries(BRAND_DOMAINS)) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        const isMatch = domains.some(d => hostname.endsWith(d));
        if (!isMatch) {
          signals.push({
            type: PhishingSignalType.DOMAIN_TITLE_MISMATCH,
            weight: 0.7,
            evidence: `Page title mentions "${brand}" but domain "${hostname}" is not associated with it.`,
          });
        }
      }
    }

    // Urgency language scan
    const allText = Array.from(state.selectorMap.values())
      .map(el => (el as any).text || '')
      .join(' ');
    for (const pattern of URGENCY_PATTERNS) {
      if (pattern.test(allText)) {
        signals.push({
          type: PhishingSignalType.URGENCY_LANGUAGE,
          weight: 0.4,
          evidence: `Suspicious urgency language detected: "${pattern.source}"`,
        });
      }
    }

    // Excessive hidden fields
    let hiddenCount = 0;
    state.selectorMap.forEach((el: DOMElementNode) => {
      if (el.tagName === 'input' && el.attributes?.type === 'hidden') {
        hiddenCount++;
      }
    });

    if (hiddenCount > 20) {
      signals.push({
        type: PhishingSignalType.EXCESSIVE_HIDDEN_FIELDS,
        weight: 0.7,
        evidence: `Excessive hidden input fields detected (${hiddenCount})`,
      });
    } else if (hiddenCount > 10) {
      signals.push({
        type: PhishingSignalType.EXCESSIVE_HIDDEN_FIELDS,
        weight: 0.3,
        evidence: `Suspicious number of hidden input fields detected (${hiddenCount})`,
      });
    }

    // Suspicious form target
    state.selectorMap.forEach((el: DOMElementNode) => {
      if (el.tagName === 'form') {
        const action = el.attributes?.action;
        if (action && action.startsWith('http')) {
          try {
            const actionHostname = new URL(action).hostname;
            if (actionHostname !== hostname && !actionHostname.endsWith(hostname)) {
              signals.push({
                type: PhishingSignalType.SUSPICIOUS_FORM_TARGET,
                weight: 0.6,
                evidence: `Form action points to an external domain: ${actionHostname}`,
              });
            }
          } catch (e) {
            // ignore
          }
        }
      }
    });

    return this.computeScore(signals);
  }

  private computeScore(signals: PhishingSignal[]): PhishingPageScore {
    const weightedSum = signals.reduce((sum, s) => sum + s.weight, 0);
    const score = Math.max(0, 100 - weightedSum * 100);

    let risk: PhishingPageScore['risk'] = 'none';
    if (weightedSum >= 0.8) risk = 'critical';
    else if (weightedSum >= 0.5) risk = 'high';
    else if (weightedSum >= 0.25) risk = 'medium';
    else if (weightedSum > 0) risk = 'low';

    return {
      score,
      risk,
      signals,
      recommendation: risk === 'critical' || risk === 'high' ? 'block' : risk === 'medium' ? 'warn' : 'allow',
    };
  }
}

export const pageAnalyzer = new PageAnalyzer();
