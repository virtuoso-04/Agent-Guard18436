export enum PhishingSignalType {
  DOMAIN_TITLE_MISMATCH = 'DOMAIN_TITLE_MISMATCH', // Page title claims to be Google but domain isn't google.com
  FAKE_LOGIN_OVERLAY = 'FAKE_LOGIN_OVERLAY', // Login form appears over an iframe showing real site
  URGENCY_LANGUAGE = 'URGENCY_LANGUAGE', // "Your account will be locked", "Act now", "Verify immediately"
  BRAND_LOGO_MISMATCH = 'BRAND_LOGO_MISMATCH', // Logo image filename references well-known brand, domain doesn't match
  MISSING_PRIVACY_POLICY = 'MISSING_PRIVACY_POLICY', // Form collects credentials but no privacy link visible
  SUSPICIOUS_FORM_TARGET = 'SUSPICIOUS_FORM_TARGET', // Form action points to different domain than page
  EXCESSIVE_HIDDEN_FIELDS = 'EXCESSIVE_HIDDEN_FIELDS', // More than N hidden inputs (data harvesting indicator)
  CREDENTIAL_FORM_ON_HTTP = 'CREDENTIAL_FORM_ON_HTTP', // Password field present but page is HTTP not HTTPS
  IFRAME_CREDENTIAL_FORM = 'IFRAME_CREDENTIAL_FORM', // Login form is inside an iframe
  COPYCAT_PAGE_STRUCTURE = 'COPYCAT_PAGE_STRUCTURE', // Page structure matches known login page template
}

export interface PhishingSignal {
  type: PhishingSignalType;
  weight: number; // 0.0–1.0 contribution to overall score
  evidence: string; // human-readable description
}

export const URGENCY_PATTERNS = [
  /your account (will be|is) (suspended|locked|compromised)/i,
  /verify (your|account|identity) (now|immediately|urgently)/i,
  /unauthorized (access|activity|login) detected/i,
  /action required/i,
  /account (verification|confirmation) needed/i,
  /security (alert|warning|update)/i,
];

export const BRAND_DOMAINS: Record<string, string[]> = {
  google: ['google.com', 'gmail.com'],
  microsoft: ['microsoft.com', 'outlook.com', 'live.com'],
  apple: ['apple.com', 'icloud.com'],
  paypal: ['paypal.com'],
  amazon: ['amazon.com'],
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  twitter: ['twitter.com', 'x.com'],
  github: ['github.com'],
};
