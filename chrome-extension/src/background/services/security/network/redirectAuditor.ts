import { type NavigationChain, type NavigationHop } from '../../../browser/views';
import { domainScorer } from './domainScorer';
import { isUrlAllowed } from '../../../browser/util';

export interface AuditResult {
  crossedTrustBoundary: boolean;
  violatedHop: NavigationHop | null;
  reason: string;
}

export class RedirectAuditor {
  public async auditChain(chain: NavigationChain, allowList: string[]): Promise<AuditResult> {
    if (chain.hops.length <= 1) {
      return { crossedTrustBoundary: false, violatedHop: null, reason: 'Single hop navigation' };
    }

    // A trust boundary crossing occurs when:
    // Hop N is on the firewall allow list (or scored safe) AND
    // Hop N+1 is not on the allow list AND scored risky

    for (let i = 0; i < chain.hops.length - 1; i++) {
      const currentHop = chain.hops[i];
      const nextHop = chain.hops[i + 1];

      const currentAllowed = isUrlAllowed(currentHop.url, allowList, []);
      const currentTrust = domainScorer.scoreDomain(currentHop.url);

      const nextAllowed = isUrlAllowed(nextHop.url, allowList, []);
      const nextTrust = domainScorer.scoreDomain(nextHop.url);

      const currentIsSafe = currentAllowed || currentTrust.risk === 'none';
      const nextIsRisky = !nextAllowed && (nextTrust.risk === 'critical' || nextTrust.risk === 'high');

      if (currentIsSafe && nextIsRisky) {
        return {
          crossedTrustBoundary: true,
          violatedHop: nextHop,
          reason: `Trust boundary crossed from ${currentHop.domain} (Safe) to ${nextHop.domain} (${nextTrust.risk} Risk)`,
        };
      }
    }

    return { crossedTrustBoundary: false, violatedHop: null, reason: 'No boundary crossing detected' };
  }
}

export const redirectAuditor = new RedirectAuditor();
