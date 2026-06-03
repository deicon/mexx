import { format, parseISO } from 'date-fns';
import {
  ColorScore,
  EventType,
  ISODate,
  SeizureDurationClass,
  SeizureEvent,
  SeizureSeverity,
  StoolQuality,
  TrackerEvent
} from './types';

export type SeizureCounts = Record<SeizureSeverity, number> & {
  total: number;
  byDurationClass: Record<SeizureDurationClass, number>;
};

export type StoolSummary = {
  total: number;
  byQuality: Record<StoolQuality, number>;
  latestQuality?: StoolQuality;
};

export type EventCounts = {
  total: number;
  byType: Record<EventType, number>;
};

export type DayState = {
  date: ISODate;
  colorScore: ColorScore;
  seizureCounts: SeizureCounts;
  stoolSummary: StoolSummary;
  eventCounts: EventCounts;
};

export function calculateDayState(events: TrackerEvent[], date?: ISODate): DayState {
  const activeEvents: TrackerEvent[] = events.filter((event) => event.deleted !== true);
  const stateDate = date ?? dateFromEvents(activeEvents);
  const dayEvents = activeEvents.filter((event) => getEventCalendarDate(event.eventTime) === stateDate);
  const activeSeizures = dayEvents.filter((event): event is SeizureEvent => event.type === 'seizure');

  return {
    date: stateDate,
    colorScore: calculateColorScore(activeSeizures),
    seizureCounts: countSeizures(activeSeizures),
    stoolSummary: summarizeStool(dayEvents),
    eventCounts: countEvents(dayEvents)
  };
}

function dateFromEvents(events: TrackerEvent[]): ISODate {
  if (events.length === 0) {
    throw new Error('date is required when calculating day state for an empty event list');
  }

  const dates = new Set(events.map((event) => getEventCalendarDate(event.eventTime)));

  if (dates.size !== 1) {
    throw new Error('events must be for a single calendar date or an explicit date must be provided');
  }

  return [...dates][0];
}

export function getEventCalendarDate(eventTime: string): ISODate {
  return format(parseISO(eventTime), 'yyyy-MM-dd');
}

function calculateColorScore(seizures: SeizureEvent[]): ColorScore {
  const mediumCount = seizures.filter((event) => event.severity === 'medium').length;
  const lightCount = seizures.filter((event) => event.severity === 'light').length;

  if (
    seizures.some((event) => event.severity === 'severe') ||
    seizures.some((event) => event.durationClass === 'over-5-min') ||
    mediumCount > 1
  ) {
    return 'red';
  }

  if (mediumCount === 1 || lightCount > 1) {
    return 'orange';
  }

  if (lightCount === 1) {
    return 'yellow';
  }

  return 'green';
}

function countSeizures(seizures: SeizureEvent[]): SeizureCounts {
  const counts: SeizureCounts = {
    total: seizures.length,
    light: 0,
    medium: 0,
    severe: 0,
    byDurationClass: {
      'under-1-min': 0,
      '1-3-min': 0,
      '3-5-min': 0,
      'over-5-min': 0,
      unknown: 0
    }
  };

  for (const seizure of seizures) {
    counts[seizure.severity] += 1;
    counts.byDurationClass[seizure.durationClass] += 1;
  }

  return counts;
}

function summarizeStool(events: TrackerEvent[]): StoolSummary {
  const stoolEvents = events.filter((event) => event.type === 'stool');
  const byQuality: Record<StoolQuality, number> = {
    'firm-formed': 0,
    normal: 0,
    soft: 0,
    mushy: 0,
    diarrhea: 0
  };

  for (const stoolEvent of stoolEvents) {
    byQuality[stoolEvent.quality] += 1;
  }

  const latestStool = stoolEvents
    .slice()
    .sort((left, right) => right.eventTime.localeCompare(left.eventTime))[0];

  return {
    total: stoolEvents.length,
    byQuality,
    latestQuality: latestStool?.quality
  };
}

function countEvents(events: TrackerEvent[]): EventCounts {
  const byType: Record<EventType, number> = {
    seizure: 0,
    meal: 0,
    stool: 0,
    dose: 0,
    observation: 0
  };

  for (const event of events) {
    byType[event.type] += 1;
  }

  return {
    total: events.length,
    byType
  };
}
