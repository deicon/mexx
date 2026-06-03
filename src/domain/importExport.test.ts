import { describe, expect, it } from 'vitest';
import {
  appStateFixture,
  backupExportFixture,
  deletedObservationFixture,
  doseFixture,
  mealFixture,
  mealTemplateFixture,
  observationFixture,
  seizureFixture,
  stoolFixture
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
        events: [{ ...mealFixture, foodComponents: [] }]
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
            ...mealFixture,
            id: 'event-meal-wrong-day',
            eventTime: '2026-06-04T09:00:00.000Z'
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
        events: [seizureFixture, { ...stoolFixture, id: seizureFixture.id }]
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
          term('term-duplicate', 'food-name', 'Chicken')
        ]
      })
    ).toThrow(/duplicate known-term id/i);
  });

  it('excludes unrelated meal templates and unrelated known terms', () => {
    const localState: AppState = {
      ...appStateFixture,
      events: [
        seizureFixture,
        mealFixture,
        stoolFixture,
        doseFixture,
        observationFixture,
        {
          ...mealFixture,
          id: 'event-meal-other-day',
          eventTime: '2026-06-04T09:00:00.000Z',
          foodComponents: [{ name: 'Turkey', consumedAmount: 80, unit: 'g' }]
        }
      ],
      mealTemplates: [
        mealTemplateFixture,
        {
          id: 'meal-template-unrelated',
          name: 'Unrelated',
          foodComponents: [{ name: 'Turkey', consumedAmount: 80, unit: 'g' }]
        }
      ],
      knownTerms: [
        ...appStateFixture.knownTerms,
        term('term-food-broth', 'food-name', 'Broth'),
        term('term-food-turkey', 'food-name', 'Turkey'),
        term('term-trigger-fireworks', 'trigger-tag', 'fireworks')
      ]
    };

    const dayExport = createDayExport(localState, '2026-06-03', '2026-06-03T18:05:00.000Z');

    expect(dayExport).not.toHaveProperty('mealTemplates');
    expect(dayExport.events.map((event) => event.id)).toEqual([
      seizureFixture.id,
      mealFixture.id,
      stoolFixture.id,
      doseFixture.id,
      observationFixture.id
    ]);
    expect(dayExport.knownTerms.map((knownTerm) => knownTerm.id).sort()).toEqual([
      'term-dose-omega-oil',
      'term-food-broth',
      'term-food-chicken',
      'term-observation-restless',
      'term-stool-mucus',
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
      { ...appStateFixture, events: [stoolFixture], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport(localState, dayExport);

    expect(merged.events.map((event) => event.id)).toEqual([seizureFixture.id, stoolFixture.id]);
  });

  it('preserves local events that are not present in the day export', () => {
    const dayExport = createDayExport(
      { ...appStateFixture, events: [stoolFixture], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [mealFixture] }, dayExport);

    expect(merged.events).toContainEqual(mealFixture);
  });

  it('keeps the imported version when it has the newer changeTime for the same event identity', () => {
    const localEvent: TrackerEvent = {
      ...mealFixture,
      note: 'Local old note.',
      changeTime: '2026-06-03T09:10:00.000Z'
    };
    const importedEvent: TrackerEvent = {
      ...mealFixture,
      note: 'Imported new note.',
      changeTime: '2026-06-03T09:11:00.000Z'
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
      ...mealFixture,
      note: 'Local new note.',
      changeTime: '2026-06-03T09:12:00.000Z'
    };
    const importedEvent: TrackerEvent = {
      ...mealFixture,
      note: 'Imported old note.',
      changeTime: '2026-06-03T09:11:00.000Z'
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
      ...mealFixture,
      note: 'Local later instant.',
      changeTime: '2026-06-03T09:00:00Z'
    };
    const importedEvent: TrackerEvent = {
      ...mealFixture,
      note: 'Imported earlier instant.',
      changeTime: '2026-06-03T10:30:00+02:00'
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
      ...mealFixture,
      id: 'event-meal-similar-imported',
      captureTime: '2026-06-03T09:03:00.000Z',
      changeTime: '2026-06-03T09:03:00.000Z'
    };
    const dayExport = createDayExport(
      { ...appStateFixture, events: [similarImportedEvent], knownTerms: [] },
      '2026-06-03',
      '2026-06-03T18:05:00.000Z'
    );

    const merged = applyDayImport({ ...appStateFixture, events: [mealFixture] }, dayExport);

    expect(merged.events).toContainEqual(mealFixture);
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
