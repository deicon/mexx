import {
  AppState,
  BackupExportPayload,
  DayExportPayload,
  DoseEvent,
  KnownTerm,
  MealEvent,
  MealTemplate,
  ObservationEvent,
  Phase,
  SCHEMA_VERSION,
  SeizureEvent,
  StoolEvent,
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

export const mealTemplateFixture: MealTemplate = {
  id: 'meal-template-breakfast',
  name: 'Breakfast',
  foodComponents: [
    {
      name: 'Chicken',
      consumedAmount: 120,
      unit: 'g'
    },
    {
      name: 'Broth',
      consumedAmount: 30,
      unit: 'ml'
    }
  ],
  dosePresets: [
    {
      category: 'supplement',
      name: 'Omega oil',
      administeredAmount: 2,
      unit: 'ml'
    }
  ]
};

export const mealFixture: MealEvent = {
  id: 'event-meal-1',
  type: 'meal',
  eventTime: '2026-06-03T09:00:00.000Z',
  captureTime: '2026-06-03T09:02:00.000Z',
  changeTime: '2026-06-03T09:02:00.000Z',
  foodComponents: mealTemplateFixture.foodComponents,
  consumptionStatus: 'eaten',
  mealTemplateId: mealTemplateFixture.id,
  note: 'Ate normally.'
};

export const stoolFixture: StoolEvent = {
  id: 'event-stool-1',
  type: 'stool',
  eventTime: '2026-06-03T10:15:00.000Z',
  captureTime: '2026-06-03T10:17:00.000Z',
  changeTime: '2026-06-03T10:17:00.000Z',
  quality: 'normal',
  stoolFlags: ['mucus'],
  note: 'Small amount of mucus observed.'
};

export const doseFixture: DoseEvent = {
  id: 'event-dose-1',
  type: 'dose',
  eventTime: '2026-06-03T09:05:00.000Z',
  captureTime: '2026-06-03T09:06:00.000Z',
  changeTime: '2026-06-03T09:06:00.000Z',
  category: 'supplement',
  name: 'Omega oil',
  administeredAmount: 2,
  unit: 'ml',
  associatedMealId: mealFixture.id,
  note: 'Given with breakfast.'
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
  mealFixture,
  stoolFixture,
  doseFixture,
  observationFixture
];

export const appStateFixture: AppState = {
  schemaVersion: SCHEMA_VERSION,
  events: [...allEventVariantFixtures, deletedObservationFixture],
  mealTemplates: [mealTemplateFixture],
  knownTerms: [
    knownTermFixture,
    {
      id: 'term-food-chicken',
      kind: 'food-name',
      value: 'Chicken',
      lastUsedTime: mealFixture.eventTime,
      useCount: 5
    },
    {
      id: 'term-dose-omega-oil',
      kind: 'dose-name',
      value: 'Omega oil',
      lastUsedTime: doseFixture.eventTime,
      useCount: 4
    },
    {
      id: 'term-stool-mucus',
      kind: 'stool-flag',
      value: 'mucus',
      lastUsedTime: stoolFixture.eventTime,
      useCount: 1
    },
    {
      id: 'term-observation-restless',
      kind: 'observation-tag',
      value: 'restless',
      lastUsedTime: observationFixture.eventTime,
      useCount: 2
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
    ['trigger-tag', 'food-name', 'dose-name', 'stool-flag', 'observation-tag'].includes(term.kind)
  )
};
