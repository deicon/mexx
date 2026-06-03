import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  allEventVariantFixtures,
  appStateFixture,
  backupExportFixture,
  dayExportFixture,
  deletedObservationFixture,
  doseFixture,
  knownTermFixture,
  mealFixture,
  phaseFixture,
  seizureFixture,
  stoolFixture
} from './fixtures';
import {
  BackupExportPayload,
  ColorScore,
  DayExportPayload,
  DoseUnit,
  FoodUnit,
  KnownTermKind,
  TrackerEvent
} from './types';

describe('domain fixtures', () => {
  it('include all event variants with event identity and timestamps', () => {
    const eventTypes = allEventVariantFixtures.map((event) => event.type);

    expect(eventTypes).toEqual(['seizure', 'meal', 'stool', 'dose', 'observation']);
    expect(allEventVariantFixtures.every((event) => event.id.length > 0)).toBe(true);
    expect(allEventVariantFixtures.every((event) => event.eventTime && event.captureTime && event.changeTime)).toBe(true);
  });

  it('represent canonical variant fields', () => {
    expect(seizureFixture.durationClass).toBe('1-3-min');
    expect(seizureFixture.triggerTags).toContain('stress');
    expect(mealFixture.foodComponents[0].unit).toBe('g');
    expect(mealFixture.consumptionStatus).toBe('eaten');
    expect(stoolFixture.quality).toBe('normal');
    expect(stoolFixture.stoolFlags).toContain('mucus');
    expect(doseFixture.category).toBe('supplement');
    expect(doseFixture.associatedMealId).toBe(mealFixture.id);
  });

  it('represents deleted event state without losing event identity', () => {
    expect(deletedObservationFixture.id).toBe('event-observation-deleted-1');
    expect(deletedObservationFixture.deleted).toBe(true);
    expect(deletedObservationFixture.deletedTime).toBe('2026-06-03T12:30:00.000Z');
  });

  it('represents phases and known terms', () => {
    expect(phaseFixture).toMatchObject({
      name: 'Chicken diet trial',
      startDate: '2026-06-01',
      endDate: '2026-06-14'
    });
    expect(knownTermFixture.kind).toBe('trigger-tag');
  });

  it('represents backup and day export payload shapes', () => {
    expectTypeOf(backupExportFixture).toMatchTypeOf<BackupExportPayload>();
    expectTypeOf(dayExportFixture).toMatchTypeOf<DayExportPayload>();

    expect(backupExportFixture.schemaVersion).toBe(1);
    expect(backupExportFixture.state.events).toContain(deletedObservationFixture);
    expect(backupExportFixture.state.mealTemplates).toHaveLength(1);
    expect(dayExportFixture.schemaVersion).toBe(1);
    expect(dayExportFixture.date).toBe('2026-06-03');
    expect(dayExportFixture).not.toHaveProperty('mealTemplates');
  });

  it('keeps app state scoped to Mexx and future storage/import needs', () => {
    expect(appStateFixture.settings.trackedDogName).toBe('Mexx');
    expect(appStateFixture.events).toContain(seizureFixture);
    expect(appStateFixture.phases).toContain(phaseFixture);
    expect(appStateFixture.knownTerms.map((term) => term.kind).sort()).toEqual([
      'dose-name',
      'food-name',
      'observation-tag',
      'stool-flag',
      'trigger-tag'
    ]);
  });
});

describe('domain type constraints', () => {
  it('exposes controlled unit and score unions', () => {
    expectTypeOf<'g'>().toMatchTypeOf<FoodUnit>();
    expectTypeOf<'tablet'>().toMatchTypeOf<DoseUnit>();
    expectTypeOf<'green'>().toMatchTypeOf<ColorScore>();
    expectTypeOf<'food-name'>().toMatchTypeOf<KnownTermKind>();
  });

  it('supports exhaustive event variant switching', () => {
    const labels = allEventVariantFixtures.map((event): string => {
      switch (event.type) {
        case 'seizure':
          return event.severity;
        case 'meal':
          return event.foodComponents[0].name;
        case 'stool':
          return event.quality;
        case 'dose':
          return event.name;
        case 'observation':
          return event.observationTags[0] ?? 'observation';
        default:
          return assertNever(event);
      }
    });

    expect(labels).toEqual(['medium', 'Chicken', 'normal', 'Omega oil', 'restless']);
  });
});

function assertNever(value: never): never {
  throw new Error(`Unhandled event variant: ${JSON.stringify(value)}`);
}

const typeLevelFixtures = () => {
  const event: TrackerEvent = seizureFixture;
  const backup: BackupExportPayload = backupExportFixture;
  const day: DayExportPayload = dayExportFixture;

  // @ts-expect-error ounces are intentionally not a controlled food unit in V1.
  const invalidFoodUnit: FoodUnit = 'oz';

  // @ts-expect-error pills are intentionally not a controlled dose unit in V1.
  const invalidDoseUnit: DoseUnit = 'pill';

  // @ts-expect-error blue is intentionally not a V1 calendar color score.
  const invalidColorScore: ColorScore = 'blue';

  // @ts-expect-error diagnostic labels are intentionally not known term kinds.
  const invalidKnownTermKind: KnownTermKind = 'diagnosis';

  return {
    event,
    backup,
    day,
    invalidFoodUnit,
    invalidDoseUnit,
    invalidColorScore,
    invalidKnownTermKind
  };
};

void typeLevelFixtures;
