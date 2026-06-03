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

  it('prefills a meal from a template and saves food components with eaten as default status', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('meal', repository);

    await user.selectOptions(screen.getByLabelText('Vorlage'), 'meal-template-breakfast');
    expect(screen.getByLabelText('Futter 1 Name')).toHaveValue('Chicken');
    expect(screen.getByLabelText('Futter 1 Menge')).toHaveValue(120);
    expect(screen.getByLabelText('Futter 2 Name')).toHaveValue('Broth');

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        type: 'meal',
        mealTemplateId: 'meal-template-breakfast',
        consumptionStatus: 'eaten',
        foodComponents: [
          { name: 'Chicken', consumedAmount: 120, unit: 'g' },
          { name: 'Broth', consumedAmount: 30, unit: 'ml' }
        ]
      })
    );
  });

  it('captures stool quality, flags, and an optional note', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('stool', repository);

    await user.selectOptions(screen.getByLabelText('Kotqualitaet'), 'diarrhea');
    await user.click(screen.getByRole('button', { name: 'mucus' }));
    await user.type(screen.getByLabelText('Notiz'), 'Sehr weich am Abend.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        type: 'stool',
        quality: 'diarrhea',
        stoolFlags: ['mucus'],
        note: 'Sehr weich am Abend.'
      })
    );
  });

  it('captures a dose category, amount, unit, associated meal, and note', async () => {
    const user = userEvent.setup();
    const repository = createRepository();

    renderCapture('dose', repository);

    await user.selectOptions(screen.getByLabelText('Kategorie'), 'medication');
    await user.type(screen.getByLabelText('Name'), 'Keppra');
    await user.clear(screen.getByLabelText('Menge'));
    await user.type(screen.getByLabelText('Menge'), '1.5');
    await user.selectOptions(screen.getByLabelText('Einheit'), 'tablet');
    await user.selectOptions(screen.getByLabelText('Zugehoerige Mahlzeit'), 'event-meal-1');
    await user.type(screen.getByLabelText('Notiz'), 'Mit Fruehstueck gegeben.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repository.upsertEvent).toHaveBeenCalledTimes(1));
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        type: 'dose',
        category: 'medication',
        name: 'Keppra',
        administeredAmount: 1.5,
        unit: 'tablet',
        associatedMealId: 'event-meal-1',
        note: 'Mit Fruehstueck gegeben.'
      })
    );
    expect(repository.saveKnownTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'term-1', kind: 'dose-name', value: 'Keppra' })
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
