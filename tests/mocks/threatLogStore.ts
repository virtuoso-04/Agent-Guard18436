import { vi } from 'vitest';
import type { ThreatEvent } from '@agent-guard/storage/lib/security/types';

export const threatLogStoreMock = {
  __events: [] as ThreatEvent[],
  __listeners: new Set<() => void>(),
  getAll: vi.fn(async () => threatLogStoreMock.__events),
  subscribe: vi.fn((callback: () => void) => {
    threatLogStoreMock.__listeners.add(callback);
    return () => {
      threatLogStoreMock.__listeners.delete(callback);
    };
  }),
  __setEvents(events: ThreatEvent[]) {
    threatLogStoreMock.__events = events;
    threatLogStoreMock.__listeners.forEach(listener => listener());
  },
  __reset() {
    threatLogStoreMock.__events = [];
    threatLogStoreMock.__listeners.clear();
    threatLogStoreMock.getAll.mockClear();
    threatLogStoreMock.subscribe.mockClear();
  },
};
