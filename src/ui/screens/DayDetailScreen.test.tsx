// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture, deletedObservationFixture, doseFixture, mealFixture, observationFixture, seizureFixture, stoolFixture } from '../../domain/fixtures';
import { AppState, KnownTerm, TrackerEvent } from '../../domain/types';
import { CaptureScreens } from './CaptureScreens';
import { DayDetailScreen } from './DayDetailScreen';

afterEach(() => {
  cleanup();
});

describe('DayDetailScreen', () => {
  it('shows active events in chronological order and hides deleted events', () => {
    renderDayDetail({
      events: [
        observationFixture,
        { ...deletedObservationFixture, note: 'Deleted observation should stay hidden.' },
        stoolFixture,
        seizureFixture,
        doseFixture,
        mealFixture
      ]
    });

    const cards = within(screen.getByRole('region', { name: 'Chronologische Eintraege' })).getAllByRole('article');

    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Anfall',
      'Mahlzeit',
      'Gabe',
      'Kot',
      'Beobachtung'
    ]);
    expect(screen.queryByText('Deleted observation should stay hidden.')).not.toBeInTheDocument();
  });

  it('sorts mixed-offset ISO event times by instant instead of lexicographic text', () => {
    renderDayDetail({
      events: [
        {
          ...observationFixture,
          id: 'event-later-offset',
          eventTime: '2026-06-03T08:45:00.000Z',
          note: 'Later instant'
        },
        {
          ...seizureFixture,
          id: 'event-earlier-offset',
          eventTime: '2026-06-03T09:30:00.000+02:00',
          note: 'Earlier instant'
        }
      ]
    });

    const cards = within(screen.getByRole('region', { name: 'Chronologische Eintraege' })).getAllByRole('article');

    expect(cards.map((card) => within(card).getByText(/instant$/).textContent)).toEqual([
      'Earlier instant',
      'Later instant'
    ]);
  });

  it('shows compact summary counts for the selected day', () => {
    renderDayDetail();

    const summary = screen.getByRole('region', { name: 'Tageszusammenfassung' });

    expect(within(summary).getByText('Anfaelle')).toBeInTheDocument();
    expect(metricValue(summary, 'Anfaelle')).toHaveTextContent('1');
    expect(metricValue(summary, 'Mahlzeiten')).toHaveTextContent('1');
    expect(metricValue(summary, 'Kot')).toHaveTextContent('1');
    expect(metricValue(summary, 'Gaben')).toHaveTextContent('1');
    expect(metricValue(summary, 'Beobachtungen')).toHaveTextContent('1');
  });

  it('calls edit with the selected event', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderDayDetail({ onEdit });

    await user.click(screen.getByRole('button', { name: 'Mahlzeit um 11:00 bearbeiten' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: mealFixture.id }));
  });

  it('soft deletes an event and refreshes the day detail', async () => {
    const user = userEvent.setup();
    const repository = createDayDetailRepository();
    const onChanged = vi.fn();

    renderDayDetail({ repository, onChanged });

    await user.click(screen.getByRole('button', { name: 'Kot um 12:15 loeschen' }));

    await waitFor(() => expect(repository.markEventDeleted).toHaveBeenCalledTimes(1));
    expect(repository.markEventDeleted).toHaveBeenCalledWith(stoolFixture.id, '2026-06-03T18:30:00.000Z');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('edits an existing event by preserving identity and capture time while updating change time', async () => {
    const user = userEvent.setup();
    const repository = createEditingRepository();

    render(
      <EditingHarness repository={repository}>
        <DayDetailScreen
          appState={appStateFixture}
          date="2026-06-03"
          repository={createDayDetailRepository()}
          onBack={vi.fn()}
          onChanged={vi.fn()}
          onEdit={vi.fn()}
          now={() => new Date('2026-06-03T20:30:00+02:00')}
        />
      </EditingHarness>
    );

    await user.click(screen.getByRole('button', { name: 'Gabe um 11:05 bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Zeitpunkt'), { target: { value: '2026-06-03T07:45' } });
    await user.clear(screen.getByLabelText('Menge'));
    await user.type(screen.getByLabelText('Menge'), '3');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: doseFixture.id,
        type: 'dose',
        eventTime: '2026-06-03T05:45:00.000Z',
        captureTime: doseFixture.captureTime,
        changeTime: '2026-06-03T18:30:00.000Z',
        administeredAmount: 3
      })
    );
  });
});

function renderDayDetail({
  events = appStateFixture.events,
  repository = createDayDetailRepository(),
  onEdit = vi.fn(),
  onChanged = vi.fn()
}: {
  events?: TrackerEvent[];
  repository?: ReturnType<typeof createDayDetailRepository>;
  onEdit?: (event: TrackerEvent) => void;
  onChanged?: () => void | Promise<void>;
} = {}) {
  render(
    <DayDetailScreen
      appState={{ ...appStateFixture, events }}
      date="2026-06-03"
      repository={repository}
      onBack={vi.fn()}
      onEdit={onEdit}
      onChanged={onChanged}
      now={() => new Date('2026-06-03T20:30:00+02:00')}
    />
  );
}

function EditingHarness({
  repository
}: {
  repository: ReturnType<typeof createEditingRepository>;
  children: ReactNode;
}) {
  const [editingEvent, setEditingEvent] = useState<TrackerEvent | null>(null);

  if (editingEvent) {
    return (
      <CaptureScreens
        type={editingEvent.type}
        appState={appStateFixture}
        repository={repository}
        eventToEdit={editingEvent}
        onDone={vi.fn()}
        onCancel={() => setEditingEvent(null)}
        now={() => new Date('2026-06-03T20:30:00+02:00')}
      />
    );
  }

  return (
    <DayDetailScreen
      appState={appStateFixture}
      date="2026-06-03"
      repository={createDayDetailRepository()}
      onBack={vi.fn()}
      onChanged={vi.fn()}
      onEdit={setEditingEvent}
      now={() => new Date('2026-06-03T20:30:00+02:00')}
    />
  );
}

function metricValue(summary: HTMLElement, label: string) {
  return within(summary).getByText(label).previousSibling as HTMLElement;
}

function createDayDetailRepository() {
  return {
    markEventDeleted: vi.fn<(eventId: string, deletedTime: string) => Promise<void>>().mockResolvedValue(undefined)
  };
}

function createEditingRepository() {
  return {
    upsertEvent: vi.fn<(event: TrackerEvent) => Promise<void>>().mockResolvedValue(undefined),
    saveKnownTerm: vi.fn<(knownTerm: KnownTerm) => Promise<void>>().mockResolvedValue(undefined)
  };
}
