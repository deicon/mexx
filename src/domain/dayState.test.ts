import { describe, expect, it } from 'vitest';
import { observationFixture, seizureFixture, therapyDogFixture } from './fixtures';
import { calculateDayState } from './dayState';
import { SeizureEvent, TherapyDogEvent, TrackerEvent } from './types';

describe('calculateDayState', () => {
  it('returns green with no active seizures', () => {
    expect(calculateDayState([observationFixture], '2026-06-03').colorScore).toBe('green');
  });

  it('returns yellow with one light seizure', () => {
    const events = [seizure({ severity: 'light' })];

    expect(calculateDayState(events).colorScore).toBe('yellow');
  });

  it('returns orange with multiple light seizures', () => {
    const events = [seizure({ id: 'light-1', severity: 'light' }), seizure({ id: 'light-2', severity: 'light' })];

    expect(calculateDayState(events).colorScore).toBe('orange');
  });

  it('returns orange with one medium seizure', () => {
    expect(calculateDayState([seizure({ severity: 'medium' })]).colorScore).toBe('orange');
  });

  it('returns red with one severe seizure', () => {
    expect(calculateDayState([seizure({ severity: 'severe' })]).colorScore).toBe('red');
  });

  it('returns red with an over-5-minute seizure', () => {
    expect(calculateDayState([seizure({ severity: 'light', durationClass: 'over-5-min' })]).colorScore).toBe('red');
  });

  it('returns red with repeated medium seizures', () => {
    const events = [
      seizure({ id: 'medium-1', severity: 'medium' }),
      seizure({ id: 'medium-2', severity: 'medium' })
    ];

    expect(calculateDayState(events).colorScore).toBe('red');
  });

  it('does not let therapy dog events affect color score', () => {
    const events = [therapyDog({ intensity: 'heavy' })];

    expect(calculateDayState(events).colorScore).toBe('green');
  });

  it('excludes deleted events from score and counts', () => {
    const events: TrackerEvent[] = [
      seizure({ id: 'deleted-severe', severity: 'severe', deleted: true }),
      seizure({ id: 'active-light', severity: 'light' }),
      therapyDog({ id: 'deleted-therapy', intensity: 'heavy', deleted: true })
    ];

    expect(calculateDayState(events)).toMatchObject({
      colorScore: 'yellow',
      seizureCounts: {
        total: 1,
        light: 1,
        medium: 0,
        severe: 0
      },
      eventCounts: {
        total: 1,
        byType: {
          seizure: 1,
          observation: 0,
          therapy_dog: 0
        }
      }
    });
  });

  it('derives date, score, and counts only from active events when deleted events are on another date', () => {
    const events: TrackerEvent[] = [
      seizure({
        id: 'deleted-cross-date-severe',
        severity: 'severe',
        eventTime: '2026-06-05T08:00:00.000Z',
        deleted: true
      }),
      therapyDog({
        id: 'deleted-cross-date-therapy',
        eventTime: '2026-06-05T09:00:00.000Z',
        intensity: 'heavy',
        deleted: true
      }),
      seizure({
        id: 'active-light',
        severity: 'light',
        eventTime: '2026-06-04T08:00:00.000Z'
      })
    ];

    expect(calculateDayState(events)).toMatchObject({
      date: '2026-06-04',
      colorScore: 'yellow',
      seizureCounts: {
        total: 1,
        light: 1,
        severe: 0
      },
      eventCounts: {
        total: 1,
        byType: {
          seizure: 1,
          observation: 0,
          therapy_dog: 0
        }
      }
    });
  });

  it('filters active events to the explicit date before calculating score and summaries', () => {
    const events: TrackerEvent[] = [
      seizure({
        id: 'requested-day-light',
        severity: 'light',
        eventTime: '2026-06-04T08:00:00.000Z'
      }),
      seizure({
        id: 'other-day-severe',
        severity: 'severe',
        eventTime: '2026-06-05T08:00:00.000Z'
      }),
      therapyDog({
        id: 'requested-day-therapy',
        intensity: 'medium',
        eventTime: '2026-06-04T09:00:00.000Z'
      }),
      therapyDog({
        id: 'other-day-therapy',
        intensity: 'heavy',
        eventTime: '2026-06-05T09:00:00.000Z'
      })
    ];

    expect(calculateDayState(events, '2026-06-04')).toMatchObject({
      date: '2026-06-04',
      colorScore: 'yellow',
      seizureCounts: {
        total: 1,
        light: 1,
        severe: 0
      },
      eventCounts: {
        total: 2,
        byType: {
          seizure: 1,
          observation: 0,
          therapy_dog: 1
        }
      }
    });
  });

  it('returns date from eventTime when all provided events are for one day', () => {
    const state = calculateDayState([
      seizure({ eventTime: '2026-06-04T08:55:00.000Z' }),
      therapyDog({ eventTime: '2026-06-04T05:00:00.000Z' })
    ]);

    expect(state.date).toBe('2026-06-04');
  });

  it('uses the local device calendar date for UTC event timestamps', () => {
    expect(calculateDayState([seizure({ eventTime: '2026-06-03T22:30:00.000Z' })]).date).toBe('2026-06-04');
  });

  it('uses an explicit date argument for empty event lists', () => {
    expect(calculateDayState([], '2026-06-05')).toMatchObject({
      date: '2026-06-05',
      colorScore: 'green',
      seizureCounts: {
        total: 0
      },
      eventCounts: {
        total: 0
      }
    });
  });

  it('requires an explicit date for empty event lists instead of guessing from the clock', () => {
    expect(() => calculateDayState([])).toThrow('date is required');
  });

  it('requires an explicit date when no active events remain', () => {
    const events: TrackerEvent[] = [
      seizure({
        id: 'deleted-light',
        eventTime: '2026-06-04T08:00:00.000Z',
        deleted: true
      })
    ];

    expect(calculateDayState(events, '2026-06-04')).toMatchObject({
      date: '2026-06-04',
      colorScore: 'green',
      eventCounts: {
        total: 0
      }
    });
    expect(() => calculateDayState(events)).toThrow('date is required');
  });
});

type SeizureOverrides = Partial<Omit<SeizureEvent, 'deleted' | 'deletedTime'>> &
  ({ deleted: true; deletedTime?: string } | { deleted?: false; deletedTime?: never });

type TherapyDogOverrides = Partial<Omit<TherapyDogEvent, 'deleted' | 'deletedTime'>> &
  ({ deleted: true; deletedTime?: string } | { deleted?: false; deletedTime?: never });

function seizure(overrides: SeizureOverrides = {}): SeizureEvent {
  const { deleted, deletedTime, ...eventOverrides } = overrides;
  const event = {
    ...seizureFixture,
    id: 'seizure-test',
    severity: 'light' as const,
    durationClass: 'under-1-min' as const,
    ...eventOverrides
  };

  if (deleted) {
    return {
      ...event,
      deleted: true,
      deletedTime: deletedTime ?? '2026-06-03T12:30:00.000Z'
    };
  }

  return event;
}

function therapyDog(overrides: TherapyDogOverrides = {}): TherapyDogEvent {
  const { deleted, deletedTime, ...eventOverrides } = overrides;
  const event = {
    ...therapyDogFixture,
    id: 'therapy-dog-test',
    intensity: 'medium' as const,
    tags: [],
    ...eventOverrides
  };

  if (deleted) {
    return {
      ...event,
      deleted: true,
      deletedTime: deletedTime ?? '2026-06-03T12:30:00.000Z'
    };
  }

  return event;
}
