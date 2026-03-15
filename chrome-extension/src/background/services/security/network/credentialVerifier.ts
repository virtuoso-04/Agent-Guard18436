import { domainScorer } from './domainScorer';

export interface CredentialContext {
  taskId: string;
  expectedDomains: string[];
  credentialType: 'password' | 'api_key' | 'pin' | 'mfa_code' | 'general';
  extractedFrom: 'task_text' | 'user_explicit';
}

export interface CredentialVerificationResult {
  allowed: boolean;
  reason: string;
  isLookalike: boolean;
}

export class CredentialVerifier {
  public verifyDomain(
    currentUrl: string,
    context: CredentialContext | null,
    fieldType: string,
  ): CredentialVerificationResult {
    let url: URL;
    try {
      url = new URL(currentUrl);
    } catch {
      // Non-parseable URL — allow input but don't verify
      return { allowed: true, reason: 'URL could not be parsed for credential verification.', isLookalike: false };
    }
    const hostname = url.hostname;

    // HTTPS enforcement
    if (url.protocol !== 'https:' && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      if (fieldType === 'password' || fieldType === 'token') {
        return {
          allowed: false,
          reason: `CREDENTIAL_INPUT_ON_HTTP: Insecure connection detected for sensitive field (${fieldType}).`,
          isLookalike: false,
        };
      }
    }

    if (!context) {
      return {
        allowed: true,
        reason: 'No credential context provided for this task. Proceeding with caution.',
        isLookalike: false,
      };
    }

    // Exact match or subdomain match
    const isExactMatch = context.expectedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
    if (isExactMatch) {
      return {
        allowed: true,
        reason: 'Domain matches expected credential context.',
        isLookalike: false,
      };
    }

    // Check for lookalikes against expected domains
    for (const _expected of context.expectedDomains) {
      const score = domainScorer.scoreDomain(hostname);
      // If hostname is a lookalike of ANY top domain or specifically our expected domain
      if (score.risk === 'critical' || score.risk === 'high') {
        return {
          allowed: false,
          reason: `LOOKALIKE_DOMAIN_DETECTED: Domain "${hostname}" appears to be a lookalike attack.`,
          isLookalike: true,
        };
      }
    }

    // Unrelated domain
    return {
      allowed: false,
      reason: `UNRELATED_DOMAIN: Current domain "${hostname}" does not match expected domains [${context.expectedDomains.join(', ')}].`,
      isLookalike: false,
    };
  }
}

export const credentialVerifier = new CredentialVerifier();
