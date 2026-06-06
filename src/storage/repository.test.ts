import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appStateFixture,
  knownTermFixture,
  observationFixture,
  phaseFixture,
  seizureFixture
} from '../domain/fixtures';
import { AppState, SCHEMA_VERSION } from '../domain/types';
import { TrackerDatabase, createTrackerDatabase } from './db';
import { TrackerRepository, createTrackerRepository } from './repository';

describe('tracker repository', () => {
  let db: TrackerDatabase;
  let repository: TrackerRepository;

  beforeEach(() => {
    db = createTrackerDatabase(`tracker-test-${crypto.randomUUID()}`);
    repository = createTrackerRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('loads an empty app state before anything has been saved', async () => {
    const expectedState: AppState = {
      schemaVersion: SCHEMA_VERSION,
      events: [],
      knownTerms: [],
      phases: [],
      settings: {
        trackedDogName: 'Mexx'
      }
    };

    await expect(repository.loadAppState()).resolves.toEqual(expectedState);
  });

  it('saves and loads the full app state', async () => {
    await repository.replaceAppState(appStateFixture);

    await expect(repository.loadAppState()).resolves.toEqual(appStateFixture);
  });

  it('replaces all stores when importing a backup state', async () => {
    await repository.replaceAppState(appStateFixture);

    const importedState: AppState = {
      ...appStateFixture,
      events: [seizureFixture],
      knownTerms: [],
      phases: [],
      settings: {
        trackedDogName: 'Mexx'
      }
    };

    await repository.replaceAppState(importedState);

    await expect(repository.loadAppState()).resolves.toEqual(importedState);
  });

  it('upserts events by identity', async () => {
    await repository.upsertEvent(seizureFixture);
    await repository.upsertEvent({
      ...seizureFixture,
      note: 'Updated note.',
      changeTime: '2026-06-03T08:10:00.000Z'
    });
    await repository.upsertEvent(observationFixture);

    const state = await repository.loadAppState();

    expect(state.events).toEqual([
      {
        ...seizureFixture,
        note: 'Updated note.',
        changeTime: '2026-06-03T08:10:00.000Z'
      },
      observationFixture
    ]);
  });

  it('soft deletes events without removing them', async () => {
    await repository.upsertEvent(seizureFixture);

    await repository.markEventDeleted(seizureFixture.id, '2026-06-03T08:20:00.000Z');

    await expect(repository.loadAppState()).resolves.toMatchObject({
      events: [
        {
          ...seizureFixture,
          changeTime: '2026-06-03T08:20:00.000Z',
          deleted: true,
          deletedTime: '2026-06-03T08:20:00.000Z'
        }
      ]
    });
  });

  it('persists known terms', async () => {
    await repository.saveKnownTerm(knownTermFixture);

    await expect(repository.loadAppState()).resolves.toMatchObject({
      knownTerms: [knownTermFixture]
    });
  });

  it('persists phases', async () => {
    await repository.savePhase(phaseFixture);

    await expect(repository.loadAppState()).resolves.toMatchObject({
      phases: [phaseFixture]
    });
  });

  it('persists visible backup status separately from settings', async () => {
    await repository.saveBackupStatus({
      lastBackupTime: '2026-06-03T19:00:00.000Z'
    });

    await expect(repository.loadAppState()).resolves.toMatchObject({
      settings: {
        trackedDogName: 'Mexx',
        backupStatus: {
          lastBackupTime: '2026-06-03T19:00:00.000Z'
        }
      }
    });
  });
});
