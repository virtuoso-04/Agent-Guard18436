import React from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SecurityEventStream, {
  type SecurityStreamEntry,
} from '../../pages/side-panel/src/components/SecurityEventStream';
import { ExecutionState } from '../../pages/side-panel/src/types/event';

describe('SecurityEventStream', () => {
  const makeEvent = (id: string, message: string, timestamp: number, level = 1): SecurityStreamEntry => ({
    id,
    message,
    timestamp,
    level,
    state: ExecutionState.SECURITY_LEVEL_CHANGE,
  });

  it('announces events in an aria-live region and limits to three entries', () => {
    const events: SecurityStreamEntry[] = [
      makeEvent('one', 'Old event', 1),
      makeEvent('two', 'Mid event', 2),
      makeEvent('three', 'Recent event', 3),
      makeEvent('four', 'Newest event', 4),
    ];

    render(<SecurityEventStream events={events} onClear={vi.fn()} />);

    const liveRegion = screen.getByRole('log');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.getByText('Newest event')).toBeInTheDocument();
    expect(screen.queryByText('Old event')).not.toBeInTheDocument();
  });

  it('allows keyboard dismissal of a toast', async () => {
    const user = userEvent.setup();
    const dismissSpy = vi.fn();
    const events: SecurityStreamEntry[] = [makeEvent('toast-1', 'Dismiss me', 1)];

    render(<SecurityEventStream events={events} onClear={dismissSpy} />);

    await user.click(screen.getByLabelText('Dismiss security event'));
    expect(dismissSpy).toHaveBeenCalledWith('toast-1');
  });
});
