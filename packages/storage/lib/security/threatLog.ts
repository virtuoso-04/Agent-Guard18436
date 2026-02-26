/**
 * Immutable threat audit log — append-only, persisted to chrome.storage.local.
 *
 * Design constraints:
 *  - No delete method on the public interface (log is append-only)
 *  - Maximum 500 entries; oldest evicted when limit is hit (FIFO)
 *  - Each entry is capped at ~600 bytes serialized → total ~300 KB max
 *  - Survives service-worker restarts because it uses StorageEnum.Local
 */

import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { ThreatEvent } from './types';

const MAX_ENTRIES = 500;
const STORAGE_KEY = 'threat-audit-log-v1';

const _storage = createStorage<ThreatEvent[]>(STORAGE_KEY, [], {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

/**
 * Append a single threat event to the log.
 * If the log already holds MAX_ENTRIES, the oldest entry is removed first.
 */
async function append(event: ThreatEvent): Promise<void> {
  await _storage.set(prev => {
    const current = Array.isArray(prev) ? prev : [];
    const trimmed = current.length >= MAX_ENTRIES ? current.slice(current.length - MAX_ENTRIES + 1) : current;
    return [...trimmed, event];
  });
}

/** Return all logged events (oldest first). */
async function getAll(): Promise<ThreatEvent[]> {
  return _storage.get();
}

/** Return all events for a specific session. */
async function getBySession(sessionId: string): Promise<ThreatEvent[]> {
  const all = await _storage.get();
  return all.filter(e => e.sessionId === sessionId);
}

/** Return all events originating from a given domain (hostname). */
async function getByDomain(domain: string): Promise<ThreatEvent[]> {
  const all = await _storage.get();
  return all.filter(e => {
    try {
      return new URL(e.sourceUrl).hostname === domain;
    } catch {
      return e.sourceUrl.includes(domain);
    }
  });
}

/** Return the N most recent events (newest first). */
async function getRecent(limit: number): Promise<ThreatEvent[]> {
  const all = await _storage.get();
  return all.slice(-Math.abs(limit)).reverse();
}

/** Summary stats — useful for the options page security tab. */
async function getStats(): Promise<{ total: number; lastEventAt: number | null }> {
  const all = await _storage.get();
  return {
    total: all.length,
    lastEventAt: all.length > 0 ? all[all.length - 1].timestamp : null,
  };
}

/** Subscribe to log changes (e.g. to update the options page in real time). */
function subscribe(listener: () => void): () => void {
  return _storage.subscribe(listener);
}

/** Get the current snapshot without an async call (may be null before first load). */
function getSnapshot(): ThreatEvent[] | null {
  return _storage.getSnapshot();
}

export const threatLogStore = {
  append,
  getAll,
  getBySession,
  getByDomain,
  getRecent,
  getStats,
  subscribe,
  getSnapshot,
} as const;
