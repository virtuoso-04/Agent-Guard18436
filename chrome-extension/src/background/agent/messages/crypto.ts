/**
 * HMAC-SHA256 helpers for message provenance signing (Issue 1.3).
 *
 * A per-session CryptoKey is generated at Executor construction time and kept
 * in memory only — it is never persisted to storage or transmitted anywhere.
 * This prevents offline forgery: any message injected by a web page cannot
 * produce a valid HMAC because the key is unknown to the page.
 *
 * Uses the Web Crypto API (available in both service workers and content scripts
 * under Manifest V3).
 */

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;

/**
 * Generate a fresh, non-extractable HMAC-SHA256 session key.
 * Call once per Executor instance.
 */
export async function generateSessionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALGORITHM, false /* non-extractable */, ['sign', 'verify']) as Promise<CryptoKey>;
}

/**
 * Sign `payload` with `key` and return the hex-encoded HMAC digest.
 * @param key     - The session signing key
 * @param payload - Arbitrary string (message content + metadata JSON)
 */
export async function signPayload(key: CryptoKey, payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const signatureBuffer = await crypto.subtle.sign(ALGORITHM.name, key, encoded);
  return bufferToHex(signatureBuffer);
}

/**
 * Verify that `expectedHmac` matches the HMAC of `payload` under `key`.
 * Returns false (rather than throwing) for any failure.
 */
export async function verifyPayload(key: CryptoKey, payload: string, expectedHmac: string): Promise<boolean> {
  try {
    const encoded = new TextEncoder().encode(payload);
    const expectedBuffer = hexToBuffer(expectedHmac);
    return crypto.subtle.verify(ALGORITHM.name, key, expectedBuffer, encoded);
  } catch {
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}
