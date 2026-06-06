// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appStateFixture,
  deletedObservationFixture,
  observationFixture,
  seizureFixture,
  therapyDogFixture
} from '../../domain/fixtures';
import { TrackerEvent } from '../../domain/types';
import { DayEventList } from './DayEventList';

afterEach(() => {
  cleanup();
});

describe('DayEventList', () => {
  it('renders active events in chronological order and hides deleted ones', () => {
    renderList({
      events: [
        observationFixture,
        { ...deletedObservationFixture, note: 'Deleted observation should stay hidden.' },
        therapyDogFixture,
        seizureFixture
      ]
    });

    const cards = within(screen.getByRole('region', { name: 'Chronologische Eintraege' })).getAllByRole('article');

    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Anfall',
      'Beobachtung',
      'Therapiehund'
    ]);
    expect(screen.queryByText('Deleted observation should stay hidden.')).not.toBeInTheDocument();
  });

  it('sorts mixed-offset ISO event times by instant', () => {
    renderList({
      events: [
        { ...observationFixture, id: 'later', eventTime: '2026-06-03T08:45:00.000Z', note: 'Later instant' },
        { ...seizureFixture, id: 'earlier', eventTime: '2026-06-03T09:30:00.000+02:00', note: 'Earlier instant' }
      ]
    });

    const cards = within(screen.getByRole('region', { name: 'Chronologische Eintraege' })).getAllByRole('article');

    expect(cards.map((card) => within(card).getByText(/instant$/).textContent)).toEqual([
      'Earlier instant',
      'Later instant'
    ]);
  });

  it('shows an empty hint when no events match the day', () => {
    renderList({ events: [], date: '2026-06-02' });

    expect(screen.getByText(/Keine Eintraege/i)).toBeInTheDocument();
  });

  it('forwards edit clicks to the parent', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderList({ onEdit });

    await user.click(screen.getByRole('button', { name: 'Therapiehund um 16:00 bearbeiten' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: therapyDogFixture.id }));
  });

  it('soft-deletes via the repository and notifies the parent', async () => {
    const user = userEvent.setup();
    const repository = {
      markEventDeleted: vi.fn<(eventId: string, deletedTime: string) => Promise<void>>().mockResolvedValue(undefined)
    };
    const onChanged = vi.fn();

    renderList({ repository, onChanged });

    await user.click(screen.getByRole('button', { name: 'Beobachtung um 14:00 loeschen' }));

    await waitFor(() => expect(repository.markEventDeleted).toHaveBeenCalledTimes(1));
    expect(repository.markEventDeleted).toHaveBeenCalledWith(observationFixture.id, '2026-06-03T18:30:00.000Z');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

type ListRepository = {
  markEventDeleted: (eventId: string, deletedTime: string) => Promise<void>;
};

function renderList({
  events = appStateFixture.events,
  date = '2026-06-03',
  repository = {
    markEventDeleted: vi.fn<(eventId: string, deletedTime: string) => Promise<void>>().mockResolvedValue(undefined)
  },
  onEdit = vi.fn<(event: TrackerEvent) => void>(),
  onChanged = vi.fn()
}: {
  events?: TrackerEvent[];
  date?: string;
  repository?: ListRepository;
  onEdit?: (event: TrackerEvent) => void;
  onChanged?: () => void | Promise<void>;
} = {}) {
  render(
    <DayEventList
      events={events}
      date={date}
      repository={repository}
      onEdit={onEdit}
      onChanged={onChanged}
      now={() => new Date('2026-06-03T20:30:00+02:00')}
    />
  );
}
