// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture, mealFixture, seizureFixture, stoolFixture } from '../../domain/fixtures';
import { createBackupExport, createDayExport } from '../../domain/importExport';
import { createTrackerDatabase, TrackerDatabase } from '../../storage/db';
import { createTrackerRepository, TrackerRepository } from '../../storage/repository';
import { AppState, BackupExportPayload, DayExportPayload, SCHEMA_VERSION, TrackerEvent } from '../../domain/types';
import { ExportsScreen } from './ExportsScreen';

let db: TrackerDatabase;
let repository: TrackerRepository;

beforeEach(() => {
  db = createTrackerDatabase(`tracker-test-${crypto.randomUUID()}`);
  repository = createTrackerRepository(db);
});

afterEach(async () => {
  cleanup();
  await db.delete();
});

function jsonFile(name: string, payload: unknown): File {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' });
}

async function renderExports(
  appState: AppState,
  downloadFile: (filename: string, content: string, mimeType: string) => void
) {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const onBack = vi.fn();

  const utils = render(
    <ExportsScreen
      appState={appState}
      repository={repository}
      onBack={onBack}
      onChanged={onChanged}
      now={() => new Date('2026-06-04T08:00:00.000Z')}
      downloadFile={downloadFile}
    />
  );

  return { utils, onChanged, onBack };
}

describe('Backup export', () => {
  it('writes a JSON payload that re-parses into the same AppState', async () => {
    await repository.replaceAppState(appStateFixture);
    const downloadFile = vi.fn();
    const user = userEvent.setup();

    await renderExports(appStateFixture, downloadFile);

    await user.click(screen.getByRole('button', { name: /Backup teilen/i }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = downloadFile.mock.calls[0];

    expect(filename).toMatch(/^mexx-backup-.+\.json$/);
    expect(mime).toBe('application/json');

    const parsed: BackupExportPayload = JSON.parse(content);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.exportType).toBe('backup');
    expect(parsed.state).toEqual(appStateFixture);
  });

  it('updates the persisted backup status timestamp after export', async () => {
    await repository.replaceAppState({ ...appStateFixture, settings: { trackedDogName: 'Mexx' } });
    const downloadFile = vi.fn();
    const user = userEvent.setup();

    const { onChanged } = await renderExports(appStateFixture, downloadFile);

    await user.click(screen.getByRole('button', { name: /Backup teilen/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const reloaded = await repository.loadAppState();
    expect(reloaded.settings.backupStatus?.lastBackupTime).toBe('2026-06-04T08:00:00.000Z');
  });
});

describe('Backup import', () => {
  it('replaces an existing state with the imported backup', async () => {
    const initial: AppState = {
      schemaVersion: SCHEMA_VERSION,
      events: [{ ...seizureFixture, id: 'leftover-event' }],
      mealTemplates: [],
      knownTerms: [],
      phases: [],
      settings: { trackedDogName: 'Mexx' }
    };
    await repository.replaceAppState(initial);
    const user = userEvent.setup();
    const downloadFile = vi.fn();

    const { onChanged } = await renderExports(initial, downloadFile);

    await user.upload(
      screen.getByLabelText(/Backup-Datei waehlen/i),
      jsonFile('backup.json', createBackupExport(appStateFixture, '2026-06-04T07:00:00.000Z'))
    );

    expect(await screen.findByText(/Vorschau/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Backup-Import bestaetigen/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const reloaded = await repository.loadAppState();
    expect(reloaded.events.map((event) => event.id)).not.toContain('leftover-event');
    expect(reloaded).toEqual(appStateFixture);

    const expectedActive = appStateFixture.events.filter((event) => event.deleted !== true).length;
    const successMessage = await screen.findByRole('status');
    expect(successMessage).toHaveTextContent(new RegExp(`Backup importiert: ${expectedActive} Ereignisse`));
  });

  it('shows the schema-rejection alert and leaves persisted state intact', async () => {
    await repository.replaceAppState(appStateFixture);
    const user = userEvent.setup();
    const downloadFile = vi.fn();

    await renderExports(appStateFixture, downloadFile);

    await user.upload(
      screen.getByLabelText(/Backup-Datei waehlen/i),
      jsonFile('backup.json', { ...createBackupExport(appStateFixture, '2026-06-04T07:00:00.000Z'), schemaVersion: 99 })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported schema version/i);

    const reloaded = await repository.loadAppState();
    expect(reloaded).toEqual(appStateFixture);
  });

  it('roundtrips: state → backup export → fresh repository → backup import → equal state', async () => {
    const downloadFile = vi.fn();
    const user = userEvent.setup();
    await repository.replaceAppState(appStateFixture);

    await renderExports(appStateFixture, downloadFile);

    await user.click(screen.getByRole('button', { name: /Backup teilen/i }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    const [, exportedContent] = downloadFile.mock.calls[0];

    cleanup();
    await db.delete();
    db = createTrackerDatabase(`tracker-restore-${crypto.randomUUID()}`);
    repository = createTrackerRepository(db);
    const freshState: AppState = {
      schemaVersion: SCHEMA_VERSION,
      events: [],
      mealTemplates: [],
      knownTerms: [],
      phases: [],
      settings: { trackedDogName: 'Mexx' }
    };

    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ExportsScreen
        appState={freshState}
        repository={repository}
        onBack={vi.fn()}
        onChanged={onChanged}
        now={() => new Date('2026-06-04T09:00:00.000Z')}
        downloadFile={vi.fn()}
      />
    );

    await user.upload(
      screen.getByLabelText(/Backup-Datei waehlen/i),
      new File([exportedContent], 'backup.json', { type: 'application/json' })
    );
    await screen.findByText(/Vorschau/i);
    await user.click(screen.getByRole('button', { name: /Backup-Import bestaetigen/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const restored = await repository.loadAppState();
    expect(restored).toEqual(appStateFixture);
  });
});

describe('Day export', () => {
  it('writes only events that belong to the chosen day plus the used known terms', async () => {
    const stateWithMultipleDays: AppState = {
      ...appStateFixture,
      events: [
        { ...seizureFixture, eventTime: '2026-06-03T08:00:00.000Z' },
        { ...mealFixture, id: 'meal-other-day', eventTime: '2026-06-05T09:00:00.000Z' }
      ]
    };
    await repository.replaceAppState(stateWithMultipleDays);
    const user = userEvent.setup();
    const downloadFile = vi.fn();

    await renderExports(stateWithMultipleDays, downloadFile);

    await user.type(screen.getByLabelText(/Tag fuer Tagesexport/i), '2026-06-03');
    await user.click(screen.getByRole('button', { name: /Tag teilen/i }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, content] = downloadFile.mock.calls[0];
    expect(filename).toBe('mexx-day-2026-06-03.json');
    const parsed: DayExportPayload = JSON.parse(content);
    expect(parsed.exportType).toBe('day');
    expect(parsed.date).toBe('2026-06-03');
    expect(parsed.events.map((event) => event.id)).toEqual([seizureFixture.id]);
    expect(parsed.knownTerms.some((term) => term.value === 'stress')).toBe(true);
  });
});

describe('Day import', () => {
  it('adds new events and reports the added/updated counts', async () => {
    await repository.replaceAppState(appStateFixture);
    const dayPayload = createDayExport(
      {
        ...appStateFixture,
        events: [
          {
            ...seizureFixture,
            note: 'Updated note',
            changeTime: '2026-06-03T09:00:00.000Z'
          },
          {
            ...mealFixture,
            id: 'new-meal-from-secondary',
            eventTime: '2026-06-03T14:00:00.000Z',
            changeTime: '2026-06-03T14:01:00.000Z'
          }
        ]
      },
      '2026-06-03',
      '2026-06-03T20:00:00.000Z'
    );
    const user = userEvent.setup();
    const downloadFile = vi.fn();

    const { onChanged } = await renderExports(appStateFixture, downloadFile);

    await user.upload(screen.getByLabelText(/Tagesexport-Datei waehlen/i), jsonFile('day.json', dayPayload));

    expect(await screen.findByText(/Vorschau/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tag importieren/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const reloaded = await repository.loadAppState();
    const newMeal = reloaded.events.find((event) => event.id === 'new-meal-from-secondary');
    const updatedSeizure = reloaded.events.find((event) => event.id === seizureFixture.id);

    expect(newMeal).toBeDefined();
    expect(updatedSeizure).toMatchObject({ note: 'Updated note' });
    expect(screen.getByText(/Neu: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Aktualisiert: 1/)).toBeInTheDocument();
  });

  it('keeps local events that are not present in the import', async () => {
    const localOnly: TrackerEvent = { ...stoolFixture, id: 'local-only', eventTime: '2026-06-03T18:00:00.000Z' };
    const local: AppState = {
      ...appStateFixture,
      events: [seizureFixture, localOnly]
    };
    await repository.replaceAppState(local);
    const dayPayload = createDayExport(
      {
        ...local,
        events: [
          {
            ...mealFixture,
            id: 'added-from-other',
            eventTime: '2026-06-03T12:30:00.000Z',
            changeTime: '2026-06-03T12:30:00.000Z'
          }
        ]
      },
      '2026-06-03',
      '2026-06-03T20:00:00.000Z'
    );
    const user = userEvent.setup();

    const { onChanged } = await renderExports(local, vi.fn());

    await user.upload(screen.getByLabelText(/Tagesexport-Datei waehlen/i), jsonFile('day.json', dayPayload));
    await screen.findByText(/Vorschau/i);
    await user.click(screen.getByRole('button', { name: /Tag importieren/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const reloaded = await repository.loadAppState();
    const ids = reloaded.events.map((event) => event.id);
    expect(ids).toEqual(expect.arrayContaining([seizureFixture.id, localOnly.id, 'added-from-other']));
  });

  it('prefers the import event when its changeTime is newer than the local one', async () => {
    const localSeizure: TrackerEvent = {
      ...seizureFixture,
      note: 'old',
      changeTime: '2026-06-03T08:00:00.000Z'
    };
    const local: AppState = {
      ...appStateFixture,
      events: [localSeizure]
    };
    await repository.replaceAppState(local);
    const dayPayload = createDayExport(
      {
        ...local,
        events: [
          {
            ...seizureFixture,
            note: 'newer from secondary device',
            changeTime: '2026-06-03T18:00:00.000Z'
          }
        ]
      },
      '2026-06-03',
      '2026-06-03T20:00:00.000Z'
    );
    const user = userEvent.setup();

    const { onChanged } = await renderExports(local, vi.fn());

    await user.upload(screen.getByLabelText(/Tagesexport-Datei waehlen/i), jsonFile('day.json', dayPayload));
    await screen.findByText(/Vorschau/i);
    await user.click(screen.getByRole('button', { name: /Tag importieren/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const reloaded = await repository.loadAppState();
    const restored = reloaded.events.find((event) => event.id === seizureFixture.id);
    expect(restored).toMatchObject({ note: 'newer from secondary device' });
  });

  it('shows the schema-rejection alert and leaves persisted state intact', async () => {
    await repository.replaceAppState(appStateFixture);
    const user = userEvent.setup();

    await renderExports(appStateFixture, vi.fn());

    await user.upload(
      screen.getByLabelText(/Tagesexport-Datei waehlen/i),
      jsonFile('day.json', {
        ...createDayExport(appStateFixture, '2026-06-03', '2026-06-03T20:00:00.000Z'),
        schemaVersion: 99
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported schema version/i);

    const reloaded = await repository.loadAppState();
    expect(reloaded).toEqual(appStateFixture);
  });

  it('roundtrips: secondary device export → primary device import → both devices see all events', async () => {
    const secondaryEvent: TrackerEvent = {
      ...mealFixture,
      id: 'secondary-meal',
      eventTime: '2026-06-04T07:30:00.000Z',
      captureTime: '2026-06-04T07:30:00.000Z',
      changeTime: '2026-06-04T07:30:00.000Z'
    };

    const dayPayload = createDayExport(
      {
        ...appStateFixture,
        events: [secondaryEvent]
      },
      '2026-06-04',
      '2026-06-04T07:35:00.000Z'
    );

    const primaryState: AppState = {
      ...appStateFixture,
      events: [seizureFixture]
    };
    await repository.replaceAppState(primaryState);
    const user = userEvent.setup();

    const { onChanged } = await renderExports(primaryState, vi.fn());

    await user.upload(screen.getByLabelText(/Tagesexport-Datei waehlen/i), jsonFile('day.json', dayPayload));
    await screen.findByText(/Vorschau/i);
    await user.click(screen.getByRole('button', { name: /Tag importieren/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const reloaded = await repository.loadAppState();
    expect(reloaded.events.map((event) => event.id)).toEqual(
      expect.arrayContaining([seizureFixture.id, secondaryEvent.id])
    );
  });
});

describe('Backup recommendation before day import', () => {
  it('warns when the last backup is stale', async () => {
    const staleBackupState: AppState = {
      ...appStateFixture,
      settings: {
        trackedDogName: 'Mexx',
        backupStatus: { lastBackupTime: '2026-05-01T10:00:00.000Z' }
      }
    };
    await repository.replaceAppState(staleBackupState);
    const user = userEvent.setup();

    await renderExports(staleBackupState, vi.fn());

    await user.upload(
      screen.getByLabelText(/Tagesexport-Datei waehlen/i),
      jsonFile('day.json', createDayExport(staleBackupState, '2026-06-03', '2026-06-04T07:30:00.000Z'))
    );

    expect(await screen.findByText(/Vor dem Tagesimport empfohlen/i)).toBeInTheDocument();

    const importPanel = screen.getByRole('article', { name: /Vorschau Tagesimport/i });
    expect(within(importPanel).getByRole('button', { name: /Tag importieren/i })).toBeInTheDocument();
  });
});
