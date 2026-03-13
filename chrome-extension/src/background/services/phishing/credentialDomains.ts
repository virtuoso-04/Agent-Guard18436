export const SERVICE_DOMAIN_MAP: Record<string, string[]> = {
  'google': ['google.com', 'accounts.google.com', 'myaccount.google.com', 'gmail.com'],
  'paypal': ['paypal.com', 'www.paypal.com'],
  'github': ['github.com'],
  'microsoft': ['microsoft.com', 'login.microsoftonline.com', 'live.com', 'outlook.com'],
  'apple': ['apple.com', 'appleid.apple.com', 'icloud.com'],
  'amazon': ['amazon.com', 'www.amazon.com', 'smile.amazon.com'],
  'facebook': ['facebook.com', 'www.facebook.com'],
  'instagram': ['instagram.com', 'www.instagram.com'],
  'twitter': ['twitter.com', 'x.com'],
  'linkedin': ['linkedin.com', 'www.linkedin.com'],
  'netflix': ['netflix.com', 'www.netflix.com'],
  'ebay': ['ebay.com', 'www.ebay.com'],
  'adobe': ['adobe.com'],
  'salesforce': ['salesforce.com'],
  'slack': ['slack.com'],
  'zoom': ['zoom.us'],
  'dropbox': ['dropbox.com'],
  'coinbase': ['coinbase.com'],
  'binance': ['binance.com'],
  'kraken': ['kraken.com'],
  'fidelity': ['fidelity.com'],
  'schwab': ['schwab.com'],
  'vanguard': ['vanguard.com'],
  'chase': ['chase.com'],
  'wellsfargo': ['wellsfargo.com'],
  'bankofamerica.com': ['bankofamerica.com'],
  'citibank': ['citi.com', 'citibank.com'],
};

export function getExpectedDomainsForService(serviceName: string): string[] {
  const normalized = serviceName.toLowerCase();
  for (const [key, domains] of Object.entries(SERVICE_DOMAIN_MAP)) {
    if (normalized.includes(key)) {
      return domains;
    }
  }
  return [];
}

export function extractServiceFromTask(task: string): string | null {
  const patterns = [
    /log in to ([a-zA-Z0-9.]+)/i,
    /sign in to ([a-zA-Z0-9.]+)/i,
    /login to ([a-zA-Z0-9.]+)/i,
    /access my ([a-zA-Z0-9.]+) account/i,
    /enter my password for ([a-zA-Z0-9.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = task.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}
