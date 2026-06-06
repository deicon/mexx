// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture } from '../../domain/fixtures';
import { AppState, EventType, KnownTerm, TrackerEvent } from '../../domain/types';
import { CaptureScreens } from './CaptureScreens';

afterEach(() => {
  cleanup();
});

describe('CaptureScreens', () => {
  it('captures a seizure with default time, edited event time, selected and new triggers, and a note', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('seizure', repository);

    expect(screen.getByLabelText('Zeitpunkt')).toHaveValue('2026-06-03T10:05');

    fireEvent.change(screen.getByLabelText('Zeitpunkt'), { target: { value: '2026-06-02T22:30' } });
    await user.selectOptions(screen.getByLabelText('Schwere'), 'severe');
    await user.selectOptions(screen.getByLabelText('Dauerklasse'), '1-3-min');
    await user.click(screen.getByRole('button', { name: 'stress' }));
    await user.type(screen.getByLabelText('Neuer Ausloeser'), 'Besuch');
    await user.click(screen.getByRole('button', { name: 'Hinzufuegen' }));
    await user.type(screen.getByLabelText('Notiz'), 'Kurz nach dem Klingeln.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith({
      id: 'event-1',
      type: 'seizure',
      eventTime: '2026-06-02T20:30:00.000Z',
      captureTime: '2026-06-03T08:05:00.000Z',
      changeTime: '2026-06-03T08:05:00.000Z',
      severity: 'severe',
      durationClass: '1-3-min',
      triggerTags: ['stress', 'Besuch'],
      note: 'Kurz nach dem Klingeln.'
    });
    expect(repository.saveKnownTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'term-trigger-stress', kind: 'trigger-tag', value: 'stress', useCount: 4 })
    );
    expect(repository.saveKnownTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'term-1', kind: 'trigger-tag', value: 'Besuch', useCount: 1 })
    );
  });

  it('captures a therapy dog appointment with intensity, duration, tags, and note', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('therapy_dog', repository);

    await user.selectOptions(screen.getByLabelText('Intensitaet'), 'heavy');
    await user.clear(screen.getByLabelText('Dauer in Minuten'));
    await user.type(screen.getByLabelText('Dauer in Minuten'), '90');
    await user.type(screen.getByLabelText('Neue Kategorie'), 'Pflegeheim');
    await user.click(screen.getByRole('button', { name: 'Hinzufuegen' }));
    await user.type(screen.getByLabelText('Notiz'), 'Sehr anstrengender Tag.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        type: 'therapy_dog',
        intensity: 'heavy',
        durationMinutes: 90,
        tags: ['Pflegeheim'],
        note: 'Sehr anstrengender Tag.'
      })
    );
    expect(repository.saveKnownTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'term-1', kind: 'therapy-tag', value: 'Pflegeheim', useCount: 1 })
    );
  });

  it('captures observation tags without requiring a note', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('observation', repository);

    await user.click(screen.getByRole('button', { name: 'restless' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        type: 'observation',
        observationTags: ['restless']
      })
    );
    expect(repository.upsertEvent.mock.calls[0][0]).not.toHaveProperty('note');
  });

  it('does not save when the event time is empty', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('seizure', repository);

    fireEvent.change(screen.getByLabelText('Zeitpunkt'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByLabelText('Zeitpunkt')).toBeInvalid();
    expect(repository.upsertEvent).not.toHaveBeenCalled();
  });
});

function renderCapture(type: EventType, repository: ReturnType<typeof createRepository>, state: AppState = appStateFixture) {
  const ids = ['event-1', 'term-1', 'term-2'];

  render(
    <CaptureScreens
      type={type}
      appState={state}
      repository={repository}
      onDone={vi.fn()}
      onCancel={vi.fn()}
      now={() => new Date('2026-06-03T10:05:00+02:00')}
      createId={() => ids.shift() ?? 'fallback-id'}
    />
  );
}

function createRepository() {
  return {
    upsertEvent: vi.fn<(event: TrackerEvent) => Promise<void>>().mockResolvedValue(undefined),
    saveKnownTerm: vi.fn<(knownTerm: KnownTerm) => Promise<void>>().mockResolvedValue(undefined)
  };
}
