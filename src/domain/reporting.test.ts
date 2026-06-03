import { describe, expect, it } from 'vitest';
import {
  appStateFixture,
  doseFixture,
  mealFixture,
  observationFixture,
  phaseFixture,
  seizureFixture,
  stoolFixture
} from './fixtures';
import {
  buildClinicalReport,
  buildCsvPackage,
  calculateCorrelations,
  resolveReportPeriod
} from './reporting';
import { AppState, SCHEMA_VERSION, SeizureEvent, TrackerEvent } from './types';

const emptyAppState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  events: [],
  mealTemplates: [],
  knownTerms: [],
  phases: [],
  settings: { trackedDogName: 'Mexx' }
};

describe('resolveReportPeriod', () => {
  it('returns the last 7 days inclusive of today', () => {
    expect(resolveReportPeriod({ key: 'last-7', today: '2026-06-03' })).toEqual({
      key: 'last-7',
      from: '2026-05-28',
      to: '2026-06-03'
    });
  });

  it('returns the last 30 days inclusive of today', () => {
    expect(resolveReportPeriod({ key: 'last-30', today: '2026-06-03' })).toEqual({
      key: 'last-30',
      from: '2026-05-05',
      to: '2026-06-03'
    });
  });

  it('returns the last 90 days inclusive of today', () => {
    expect(resolveReportPeriod({ key: 'last-90', today: '2026-06-03' })).toEqual({
      key: 'last-90',
      from: '2026-03-06',
      to: '2026-06-03'
    });
  });

  it('returns the explicit custom range', () => {
    expect(
      resolveReportPeriod({ key: 'custom', today: '2026-06-03', from: '2026-04-01', to: '2026-04-30' })
    ).toEqual({ key: 'custom', from: '2026-04-01', to: '2026-04-30' });
  });

  it('rejects a custom range with missing dates', () => {
    expect(() => resolveReportPeriod({ key: 'custom', today: '2026-06-03' })).toThrow(/from/i);
  });

  it('rejects a custom range where the end is before the start', () => {
    expect(() =>
      resolveReportPeriod({ key: 'custom', today: '2026-06-03', from: '2026-06-10', to: '2026-06-01' })
    ).toThrow(/order/i);
  });
});

describe('calculateCorrelations', () => {
  const seizureTime = '2026-06-03T12:00:00.000Z';
  const baseSeizure: SeizureEvent = {
    ...seizureFixture,
    id: 'seizure-correlation',
    eventTime: seizureTime,
    captureTime: seizureTime,
    changeTime: seizureTime
  };

  it('classifies preceding events into 0-6h, 6-24h, and 24-72h windows', () => {
    const events: TrackerEvent[] = [
      baseSeizure,
      { ...mealFixture, id: 'meal-near', eventTime: '2026-06-03T10:00:00.000Z' },
      { ...doseFixture, id: 'dose-medium', eventTime: '2026-06-02T20:00:00.000Z' },
      { ...observationFixture, id: 'observation-far', eventTime: '2026-06-02T01:00:00.000Z' }
    ];

    const correlations = calculateCorrelations(events, {
      from: '2026-06-01',
      to: '2026-06-03'
    });

    expect(correlations).toHaveLength(1);
    const entry = correlations[0];

    expect(entry.seizureId).toBe(baseSeizure.id);
    expect(entry.precedingByWindow['0-6h'].map((item) => item.event.id)).toEqual(['meal-near']);
    expect(entry.precedingByWindow['6-24h'].map((item) => item.event.id)).toEqual(['dose-medium']);
    expect(entry.precedingByWindow['24-72h'].map((item) => item.event.id)).toEqual(['observation-far']);
  });

  it('ignores events outside any window', () => {
    const events: TrackerEvent[] = [
      baseSeizure,
      { ...observationFixture, id: 'observation-after', eventTime: '2026-06-03T13:00:00.000Z' },
      { ...observationFixture, id: 'observation-too-old', eventTime: '2026-05-30T00:00:00.000Z' }
    ];

    const correlations = calculateCorrelations(events, {
      from: '2026-05-01',
      to: '2026-06-30'
    });

    expect(correlations[0].precedingByWindow['0-6h']).toEqual([]);
    expect(correlations[0].precedingByWindow['6-24h']).toEqual([]);
    expect(correlations[0].precedingByWindow['24-72h']).toEqual([]);
  });

  it('excludes deleted events from correlations', () => {
    const events: TrackerEvent[] = [
      baseSeizure,
      {
        ...mealFixture,
        id: 'meal-deleted',
        eventTime: '2026-06-03T10:00:00.000Z',
        deleted: true,
        deletedTime: '2026-06-03T11:00:00.000Z'
      }
    ];

    const correlations = calculateCorrelations(events, { from: '2026-06-01', to: '2026-06-03' });

    expect(correlations[0].precedingByWindow['0-6h']).toEqual([]);
  });

  it('only emits correlations for seizures inside the period', () => {
    const events: TrackerEvent[] = [
      baseSeizure,
      { ...baseSeizure, id: 'seizure-outside', eventTime: '2026-05-01T12:00:00.000Z' }
    ];

    const correlations = calculateCorrelations(events, { from: '2026-06-01', to: '2026-06-30' });

    expect(correlations.map((entry) => entry.seizureId)).toEqual([baseSeizure.id]);
  });
});

describe('buildClinicalReport', () => {
  const period = { from: '2026-06-01', to: '2026-06-03' };

  it('summarizes events and day states across the period', () => {
    const report = buildClinicalReport(appStateFixture, {
      period,
      generatedAt: '2026-06-03T20:00:00.000Z'
    });

    expect(report.period).toEqual(period);
    expect(report.generatedAt).toBe('2026-06-03T20:00:00.000Z');
    expect(report.dayStates.map((dayState) => dayState.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(report.totals.seizures).toBe(1);
    expect(report.totals.meals).toBe(1);
    expect(report.totals.stools).toBe(1);
    expect(report.totals.doses).toBe(1);
    expect(report.totals.observations).toBe(1);
  });

  it('includes phases overlapping with the period only', () => {
    const stateWithPhases: AppState = {
      ...appStateFixture,
      phases: [
        phaseFixture,
        { id: 'phase-past', name: 'Old phase', startDate: '2024-01-01', endDate: '2024-12-31' }
      ]
    };

    const report = buildClinicalReport(stateWithPhases, {
      period,
      generatedAt: '2026-06-03T20:00:00.000Z'
    });

    expect(report.phases.map((phase) => phase.id)).toEqual([phaseFixture.id]);
  });

  it('uses non-diagnostic language for correlations', () => {
    const report = buildClinicalReport(appStateFixture, {
      period,
      generatedAt: '2026-06-03T20:00:00.000Z'
    });

    expect(report.correlationDisclaimer).toMatch(/korrelation/i);
    expect(report.correlationDisclaimer).not.toMatch(/ursache|diagnos|behandl/i);
    expect(report.correlationDisclaimer).not.toMatch(/ausgelöst|ausgeloest/i);
  });

  it('excludes deleted events from the totals and correlations', () => {
    const stateWithDeleted: AppState = {
      ...emptyAppState,
      events: [
        seizureFixture,
        { ...mealFixture, deleted: true, deletedTime: '2026-06-03T10:30:00.000Z' }
      ]
    };

    const report = buildClinicalReport(stateWithDeleted, {
      period,
      generatedAt: '2026-06-03T20:00:00.000Z'
    });

    expect(report.totals.meals).toBe(0);
    expect(report.correlations[0]?.precedingByWindow['0-6h']).toEqual([]);
  });
});

describe('buildCsvPackage', () => {
  const period = { from: '2026-06-01', to: '2026-06-03' };
  const csvPackage = buildCsvPackage(appStateFixture, period);

  it('produces files for events, event details, day states, and phases', () => {
    expect(csvPackage.files.map((file) => file.name).sort()).toEqual(
      ['day-states.csv', 'event-details.csv', 'events.csv', 'phases.csv'].sort()
    );
  });

  it('writes one event row per active event', () => {
    const events = csvPackage.files.find((file) => file.name === 'events.csv')!;

    expect(events.header).toEqual(['id', 'type', 'eventTime', 'captureTime', 'changeTime', 'note']);
    const idColumn = events.rows.map((row) => row[0]);

    expect(idColumn).toEqual(
      expect.arrayContaining([seizureFixture.id, mealFixture.id, stoolFixture.id, doseFixture.id, observationFixture.id])
    );
    expect(idColumn).not.toContain('event-observation-deleted-1');
  });

  it('writes detail rows including food components for meals', () => {
    const details = csvPackage.files.find((file) => file.name === 'event-details.csv')!;

    expect(details.header).toContain('eventId');
    expect(details.header).toContain('detailType');
    const mealDetailRows = details.rows.filter((row) => row[details.header.indexOf('eventId')] === mealFixture.id);

    expect(mealDetailRows.length).toBe(mealFixture.foodComponents.length);
  });

  it('writes one day-state row per calendar day in the period', () => {
    const dayStates = csvPackage.files.find((file) => file.name === 'day-states.csv')!;

    expect(dayStates.rows.map((row) => row[0])).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('writes one row per phase overlapping the period', () => {
    const phases = csvPackage.files.find((file) => file.name === 'phases.csv')!;

    expect(phases.rows.map((row) => row[0])).toEqual([phaseFixture.id]);
  });
});
