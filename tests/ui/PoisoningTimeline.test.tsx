import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ThreatEvent } from '../../packages/storage/lib/security/types';
import { describe, beforeEach, it, expect } from 'vitest';
import { PoisoningTimeline } from '../../pages/options/src/components/PoisoningTimeline';
import { threatLogStoreMock } from '../mocks/threatLogStore';

const baseEvent: ThreatEvent = {
  id: 'evt-1',
  timestamp: Date.now(),
  sessionId: 'session-1',
  taskId: 'TASK-ALPHA',
  stepNumber: 1,
  sourceUrl: 'https://example.com',
  threatType: 'prompt_injection',
  severity: 'critical',
  rawFragment: 'payload',
  sanitizedFragment: 'sanitized',
  wasBlocked: true,
  detectionLayer: 'sanitizer',
  previousHash: null,
};

describe('PoisoningTimeline', () => {
  beforeEach(() => {
    threatLogStoreMock.__reset();
    threatLogStoreMock.__setEvents([
      baseEvent,
      {
        ...baseEvent,
        id: 'evt-2',
        taskId: 'TASK-BETA',
        severity: 'high',
        timestamp: baseEvent.timestamp + 1000,
        sourceUrl: 'https://beta.invalid',
      },
    ]);
  });

  it('renders severity counts and timeline results', async () => {
    render(<PoisoningTimeline store={threatLogStoreMock} />);

    await waitFor(() => expect(threatLogStoreMock.getAll).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('severity-count-critical')).toHaveTextContent('1'));
    expect(screen.getByTestId('severity-count-high')).toHaveTextContent('1');
    expect(screen.getByTestId('timeline-results')).toBeInTheDocument();
  });

  it('applies task search filters', async () => {
    const user = userEvent.setup();
    render(<PoisoningTimeline store={threatLogStoreMock} />);

    await waitFor(() => expect(threatLogStoreMock.getAll).toHaveBeenCalled());
    const searchInput = await screen.findByPlaceholderText('Search by task ID or URL');
    await user.type(searchInput, 'TASK-BETA');

    await waitFor(() => {
      expect(screen.queryByText(/No poisoning attempts recorded yet/)).not.toBeInTheDocument();
      expect(screen.getByText(/Task TASK-BETA/)).toBeInTheDocument();
    });

    await user.clear(searchInput);
    await user.type(searchInput, 'unknown-task');
    await waitFor(() => expect(screen.getByText(/No poisoning attempts recorded yet/)).toBeInTheDocument());
  });
});
