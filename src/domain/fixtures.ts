import {
  AppState,
  BackupExportPayload,
  DayExportPayload,
  KnownTerm,
  ObservationEvent,
  Phase,
  SCHEMA_VERSION,
  SeizureEvent,
  TherapyDogEvent,
  TrackerEvent
} from './types';

const captureTime = '2026-06-03T08:05:00.000Z';

export const seizureFixture: SeizureEvent = {
  id: 'event-seizure-1',
  type: 'seizure',
  eventTime: '2026-06-03T08:00:00.000Z',
  captureTime,
  changeTime: captureTime,
  severity: 'medium',
  durationClass: '1-3-min',
  exactDuration: {
    value: 90,
    unit: 'seconds'
  },
  triggerTags: ['stress'],
  note: 'Short seizure after morning activity.'
};

export const observationFixture: ObservationEvent = {
  id: 'event-observation-1',
  type: 'observation',
  eventTime: '2026-06-03T12:00:00.000Z',
  captureTime: '2026-06-03T12:03:00.000Z',
  changeTime: '2026-06-03T12:03:00.000Z',
  observationTags: ['restless'],
  note: 'Paced briefly before lunch.'
};

export const deletedObservationFixture: ObservationEvent = {
  ...observationFixture,
  id: 'event-observation-deleted-1',
  changeTime: '2026-06-03T12:30:00.000Z',
  deleted: true,
  deletedTime: '2026-06-03T12:30:00.000Z'
};

export const therapyDogFixture: TherapyDogEvent = {
  id: 'event-therapy-dog-1',
  type: 'therapy_dog',
  eventTime: '2026-06-03T14:00:00.000Z',
  captureTime: '2026-06-03T14:05:00.000Z',
  changeTime: '2026-06-03T14:05:00.000Z',
  intensity: 'medium',
  durationMinutes: 120,
  tags: ['Krankenhaus', 'Station 3A'],
  note: 'Vormittagstermin im Krankenhaus.'
};

export const phaseFixture: Phase = {
  id: 'phase-diet-trial-1',
  name: 'Chicken diet trial',
  startDate: '2026-06-01',
  endDate: '2026-06-14'
};

export const knownTermFixture: KnownTerm = {
  id: 'term-trigger-stress',
  kind: 'trigger-tag',
  value: 'stress',
  lastUsedTime: seizureFixture.eventTime,
  useCount: 3
};

export const allEventVariantFixtures: TrackerEvent[] = [
  seizureFixture,
  observationFixture,
  therapyDogFixture
];

export const appStateFixture: AppState = {
  schemaVersion: SCHEMA_VERSION,
  events: [...allEventVariantFixtures, deletedObservationFixture],
  knownTerms: [
    knownTermFixture,
    {
      id: 'term-observation-restless',
      kind: 'observation-tag',
      value: 'restless',
      lastUsedTime: observationFixture.eventTime,
      useCount: 2
    },
    {
      id: 'term-therapy-krankenhaus',
      kind: 'therapy-tag',
      value: 'Krankenhaus',
      lastUsedTime: therapyDogFixture.eventTime,
      useCount: 5
    },
    {
      id: 'term-therapy-station-3a',
      kind: 'therapy-tag',
      value: 'Station 3A',
      lastUsedTime: therapyDogFixture.eventTime,
      useCount: 3
    }
  ],
  phases: [phaseFixture],
  settings: {
    trackedDogName: 'Mexx',
    backupStatus: {
      lastBackupTime: '2026-06-03T18:00:00.000Z'
    }
  }
};

export const backupExportFixture: BackupExportPayload = {
  schemaVersion: SCHEMA_VERSION,
  exportType: 'backup',
  exportedAt: '2026-06-03T18:00:00.000Z',
  state: appStateFixture
};

export const dayExportFixture: DayExportPayload = {
  schemaVersion: SCHEMA_VERSION,
  exportType: 'day',
  exportedAt: '2026-06-03T18:05:00.000Z',
  date: '2026-06-03',
  events: allEventVariantFixtures,
  knownTerms: appStateFixture.knownTerms.filter((term) =>
    ['trigger-tag', 'observation-tag', 'therapy-tag'].includes(term.kind)
  )
};
