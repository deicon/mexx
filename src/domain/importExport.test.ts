import { describe, expect, it } from 'vitest';
import {
  appStateFixture,
  backupExportFixture,
  deletedObservationFixture,
  observationFixture,
  seizureFixture,
  therapyDogFixture
} from './fixtures';
import {
  applyBackupImport,
  applyDayImport,
  createBackupExport,
  createDayExport,
  parseBackupExport,
  parseDayExport
} from './importExport';
import { AppState, KnownTerm, SCHEMA_VERSION, TrackerEvent } from './types';

describe('backup export schema', () => {
  it('parses a valid backup export', () => {
    expect(parseBackupExport(backupExportFixture)).toEqual(backupExportFixture);
  });

  it('rejects an unknown newer backup schema version', () => {
    expect(() =>
      parseBackupExport({
        ...backupExportFixture,
        schemaVersion: SCHEMA_VERSION + 1
      })
    ).toThrow(/unsupported schema version/i);
  });

  it('rejects malformed backup payloads', () => {
    expect(() =>
      parseBackupExport({
        ...backupExportFixture,
        state: {
          ...backupExportFixture.state,
          events: [{ ...seizureFixture, severity: 'critical' }]
        }
      })
    ).toThrow(/invalid backup export/i);
  });
});

describe('day export schema', () => {
  it('parses a valid day export', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(parseDayExport(dayExport)).toEqual(dayExport);
  });

  it('rejects an unknown newer day schema version', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        schemaVersion: SCHEMA_VERSION + 1
      })
    ).toThrow(/unsupported schema version/i);
  });

  it('rejects malformed day payloads', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        events: [{ ...seizureFixture, severity: 'critical' }]
      })
    ).toThrow(/invalid day export/i);
  });

  it('rejects day exports containing events from another local calendar day', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        events: [
          ...dayExport.events,
          {
            ...observationFixture,
            id: 'event-observation-wrong-day',
            eventTime: '2026-06-04T12:00:00.000Z'
          }
        ]
      })
    ).toThrow(/declared day/i);
  });

  it('rejects invalid event times', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        events: [{ ...seizureFixture, eventTime: 'not-a-date' }]
      })
    ).toThrow(/invalid day export/i);
  });

  it('rejects invalid change times', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        events: [{ ...seizureFixture, changeTime: '2026-06-03 08:05' }]
      })
    ).toThrow(/invalid day export/i);
  });

  it('rejects invalid day dates', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        date: '2026-06-32',
        events: []
      })
    ).toThrow(/invalid day export/i);
  });

  it('rejects duplicate imported event IDs', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        events: [seizureFixture, { ...therapyDogFixture, id: seizureFixture.id }]
      })
    ).toThrow(/duplicate event id/i);
  });

  it('rejects duplicate known-term IDs', () => {
    const dayExport = createDayExport(appStateFixture, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(() =>
      parseDayExport({
        ...dayExport,
        knownTerms: [
          term('term-duplicate', 'trigger-tag', 'stress'),
          term('term-duplicate', 'observation-tag', 'restless')
        ]
      })
    ).toThrow(/duplicate known-term id/i);
  });

  it('excludes unrelated known terms', () => {
    const localState: AppState = {
      ...appStateFixture,
      events: [
        seizureFixture,
        observationFixture,
        therapyDogFixture,
        {
          ...observationFixture,
          id: 'event-observation-other-day',
          eventTime: '2026-06-04T12:00:00.000Z',
          observationTags: ['tired']
        }
      ],
      knownTerms: [
        ...appStateFixture.knownTerms,
        term('term-therapy-pflegeheim', 'therapy-tag', 'Pflegeheim'),
        term('term-observation-tired', 'observation-tag', 'tired'),
        term('term-trigger-fireworks', 'trigger-tag', 'fireworks')
      ]
    };

    const dayExport = createDayExport(localState, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(dayExport).not.toHaveProperty('mealTemplates');
    expect(dayExport.events.map((event) => event.id)).toEqual([
      seizureFixture.id,
      observationFixture.id,
      therapyDogFixture.id
    ]);
    expect(dayExport.knownTerms.map((knownTerm) => knownTerm.id).sort()).toEqual([
      'term-observation-restless',
      'term-therapy-krankenhaus',
      'term-therapy-station-3a',
      'term-trigger-stress'
    ]);
  });

  it('includes deleted events in backup exports', () => {
    const backupExport = createBackupExport(appStateFixture, '2026-06-03T18:05:00.000Z');

    expect(backupExport.state.events).toContainEqual(deletedObservationFixture);
  });
});

describe('backup import', () => {
  it('replaces the local state completely', () => {
    const localState: AppState = {
      ...appStateFixture,
      events: [{ ...seizureFixture, id: 'local-only-event' }],
      knownTerms: [term('local-only-term', 'trigger-tag', 'local')]
    };

    expect(applyBackupImport(localState, backupExportFixture)).toEqual(backupExportFixture.state);
  });
});

describe('day import merge', () => {
  it('appends new events', () => {
    const localState: AppState = {
      ...appStateFixture,
      events: [seizureFixture]
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [therapyDogFixture], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport(localState, dayExport);

    expect(merged.events.map((event) => event.id)).toEqual([seizureFixture.id, therapyDogFixture.id]);
  });

  it('preserves local events that are not present in the day export', () => {
    const dayExport = createDayExport(
      { ...appStateFixture, events: [therapyDogFixture], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [observationFixture] }, dayExport);

    expect(merged.events).toContainEqual(observationFixture);
  });

  it('keeps the imported version when it has the newer changeTime for the same event identity', () => {
    const localEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Local old note.',
      changeTime: '2026-06-03T12:10:00.000Z'
    };
    const importedEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Imported new note.',
      changeTime: '2026-06-03T12:11:00.000Z'
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [importedEvent], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [localEvent] }, dayExport);

    expect(merged.events).toContainEqual(importedEvent);
    expect(merged.events).not.toContainEqual(localEvent);
  });

  it('keeps the local version when an imported same-id event is older', () => {
    const localEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Local new note.',
      changeTime: '2026-06-03T12:12:00.000Z'
    };
    const importedEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Imported old note.',
      changeTime: '2026-06-03T12:11:00.000Z'
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [importedEvent], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [localEvent] }, dayExport);

    expect(merged.events).toContainEqual(localEvent);
    expect(merged.events).not.toContainEqual(importedEvent);
  });

  it('compares event changeTime by instant when offsets differ', () => {
    const localEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Local later instant.',
      changeTime: '2026-06-03T12:00:00Z'
    };
    const importedEvent: TrackerEvent = {
      ...observationFixture,
      note: 'Imported earlier instant.',
      changeTime: '2026-06-03T13:30:00+02:00'
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [importedEvent], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [localEvent] }, dayExport);

    expect(merged.events).toContainEqual(localEvent);
    expect(merged.events).not.toContainEqual(importedEvent);
  });

  it('keeps similar events with different identities separate', () => {
    const similarImportedEvent: TrackerEvent = {
      ...observationFixture,
      id: 'event-observation-similar-imported',
      captureTime: '2026-06-03T12:03:00.000Z',
      changeTime: '2026-06-03T12:03:00.000Z'
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [similarImportedEvent], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [observationFixture] }, dayExport);

    expect(merged.events).toContainEqual(observationFixture);
    expect(merged.events).toContainEqual(similarImportedEvent);
  });

  it('transfers deleted events as deleted', () => {
    const dayExport = createDayExport(
      { ...appStateFixture, events: [deletedObservationFixture], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [] }, dayExport);

    expect(merged.events).toContainEqual(deletedObservationFixture);
  });

  it('compares known-term lastUsedTime by instant when offsets differ', () => {
    const localTerm = term('term-trigger-stress', 'trigger-tag', 'stress', '2026-06-03T09:00:00Z');
    const importedTerm = term('term-trigger-stress', 'trigger-tag', 'stress', '2026-06-03T10:30:00+02:00');
    const dayExport = createDayExport(
      { ...appStateFixture, events: [seizureFixture], knownTerms: [importedTerm] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, knownTerms: [localTerm] }, dayExport);

    expect(merged.knownTerms).toContainEqual(localTerm);
    expect(merged.knownTerms).not.toContainEqual(importedTerm);
  });
});

function term(
  id: string,
  kind: KnownTerm['kind'],
  value: string,
  lastUsedTime = '2026-06-03T18:05:00.000Z'
): KnownTerm {
  return {
    id,
    kind,
    value,
    lastUsedTime,
    useCount: 1
  };
}
