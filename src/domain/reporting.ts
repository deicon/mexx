import { addDays, differenceInHours, eachDayOfInterval, format, parseISO } from 'date-fns';
import { calculateDayState, DayState, getEventCalendarDate } from './dayState';
import {
  AppState,
  EventId,
  EventType,
  ISODate,
  ISODateTime,
  Phase,
  SeizureEvent,
  TrackerEvent
} from './types';

export type ReportPeriodKey = 'last-7' | 'last-30' | 'last-90' | 'custom';

export type ReportPeriod = {
  key: ReportPeriodKey;
  from: ISODate;
  to: ISODate;
};

export type ReportPeriodInput =
  | { key: 'last-7' | 'last-30' | 'last-90'; today: ISODate }
  | { key: 'custom'; today: ISODate; from?: ISODate; to?: ISODate };

export function resolveReportPeriod(input: ReportPeriodInput): ReportPeriod {
  if (input.key === 'custom') {
    if (!input.from || !input.to) {
      throw new Error('Custom report period requires both from and to dates.');
    }

    if (input.from > input.to) {
      throw new Error('Custom report period dates are out of order.');
    }

    return { key: 'custom', from: input.from, to: input.to };
  }

  const dayCounts: Record<Exclude<ReportPeriodKey, 'custom'>, number> = {
    'last-7': 7,
    'last-30': 30,
    'last-90': 90
  };
  const todayDate = parseISO(input.today);
  const from = format(addDays(todayDate, -(dayCounts[input.key] - 1)), 'yyyy-MM-dd');

  return { key: input.key, from, to: input.today };
}

export type CorrelationWindowKey = '0-6h' | '6-24h' | '24-72h';

export type CorrelationCandidate = {
  event: TrackerEvent;
  hoursBefore: number;
};

export type SeizureCorrelation = {
  seizureId: EventId;
  seizureTime: ISODateTime;
  precedingByWindow: Record<CorrelationWindowKey, CorrelationCandidate[]>;
};

type PeriodRange = Pick<ReportPeriod, 'from' | 'to'>;

export function calculateCorrelations(events: TrackerEvent[], period: PeriodRange): SeizureCorrelation[] {
  const activeEvents: TrackerEvent[] = events.filter((event) => event.deleted !== true);
  const seizures = activeEvents
    .filter((event): event is SeizureEvent => event.type === 'seizure')
    .filter((seizure) => isInPeriod(seizure.eventTime, period))
    .sort((left, right) => left.eventTime.localeCompare(right.eventTime));

  return seizures.map((seizure) => ({
    seizureId: seizure.id,
    seizureTime: seizure.eventTime,
    precedingByWindow: bucketPrecedingEvents(activeEvents, seizure)
  }));
}

function bucketPrecedingEvents(
  events: TrackerEvent[],
  seizure: SeizureEvent
): Record<CorrelationWindowKey, CorrelationCandidate[]> {
  const buckets: Record<CorrelationWindowKey, CorrelationCandidate[]> = {
    '0-6h': [],
    '6-24h': [],
    '24-72h': []
  };
  const seizureInstant = parseISO(seizure.eventTime);

  for (const event of events) {
    if (event.id === seizure.id) {
      continue;
    }

    const eventInstant = parseISO(event.eventTime);

    if (eventInstant >= seizureInstant) {
      continue;
    }

    const hoursBefore = differenceInHours(seizureInstant, eventInstant);
    const window = classifyWindow(hoursBefore);

    if (window) {
      buckets[window].push({ event, hoursBefore });
    }
  }

  for (const window of Object.values(buckets)) {
    window.sort((left, right) => left.hoursBefore - right.hoursBefore);
  }

  return buckets;
}

function classifyWindow(hoursBefore: number): CorrelationWindowKey | null {
  if (hoursBefore < 0) {
    return null;
  }

  if (hoursBefore < 6) {
    return '0-6h';
  }

  if (hoursBefore < 24) {
    return '6-24h';
  }

  if (hoursBefore < 72) {
    return '24-72h';
  }

  return null;
}

export type EventTotals = Record<EventType, number> & { total: number };

export type ClinicalReport = {
  generatedAt: ISODateTime;
  period: ReportPeriod | PeriodRange;
  dayStates: DayState[];
  totals: {
    seizures: number;
    observations: number;
    therapyDogs: number;
  };
  correlations: SeizureCorrelation[];
  phases: Phase[];
  correlationDisclaimer: string;
};

export type ClinicalReportInput = {
  period: ReportPeriod | PeriodRange;
  generatedAt: ISODateTime;
};

export const CORRELATION_DISCLAIMER =
  'Nur Korrelation. Die folgenden Werte zeigen ausschliesslich die zeitliche Naehe von Ereignissen.';

export function buildClinicalReport(state: AppState, input: ClinicalReportInput): ClinicalReport {
  const activeEvents: TrackerEvent[] = state.events.filter((event) => event.deleted !== true);
  const periodEvents = activeEvents.filter((event) => isInPeriod(event.eventTime, input.period));
  const dayStates = eachDayInPeriod(input.period).map((date) => calculateDayState(activeEvents, date));
  const totals = countByType(periodEvents);

  return {
    generatedAt: input.generatedAt,
    period: input.period,
    dayStates,
    totals: {
      seizures: totals.seizure,
      observations: totals.observation,
      therapyDogs: totals.therapy_dog
    },
    correlations: calculateCorrelations(activeEvents, input.period),
    phases: state.phases.filter((phase) => phaseOverlapsPeriod(phase, input.period)),
    correlationDisclaimer: CORRELATION_DISCLAIMER
  };
}

function countByType(events: TrackerEvent[]): Record<EventType, number> {
  const counts: Record<EventType, number> = {
    seizure: 0,
    observation: 0,
    therapy_dog: 0
  };

  for (const event of events) {
    counts[event.type] += 1;
  }

  return counts;
}

function phaseOverlapsPeriod(phase: Phase, period: PeriodRange): boolean {
  const phaseEnd = phase.endDate ?? '9999-12-31';

  return phase.startDate <= period.to && phaseEnd >= period.from;
}

function isInPeriod(eventTime: ISODateTime, period: PeriodRange): boolean {
  const date = getEventCalendarDate(eventTime);

  return date >= period.from && date <= period.to;
}

function eachDayInPeriod(period: PeriodRange): ISODate[] {
  return eachDayOfInterval({
    start: parseISO(period.from),
    end: parseISO(period.to)
  }).map((day) => format(day, 'yyyy-MM-dd'));
}

export type CsvFile = {
  name: string;
  header: string[];
  rows: string[][];
};

export type CsvPackage = {
  files: CsvFile[];
};

export function buildCsvPackage(state: AppState, period: PeriodRange): CsvPackage {
  const activeEvents: TrackerEvent[] = state.events.filter((event) => event.deleted !== true);
  const periodEvents = activeEvents.filter((event) => isInPeriod(event.eventTime, period));

  return {
    files: [
      buildEventsFile(periodEvents),
      buildEventDetailsFile(periodEvents),
      buildDayStatesFile(activeEvents, period),
      buildPhasesFile(state.phases, period)
    ]
  };
}

function buildEventsFile(events: TrackerEvent[]): CsvFile {
  const header = ['id', 'type', 'eventTime', 'captureTime', 'changeTime', 'note'];
  const rows = events.map((event) => [
    event.id,
    event.type,
    event.eventTime,
    event.captureTime,
    event.changeTime,
    'note' in event && event.note ? event.note : ''
  ]);

  return { name: 'events.csv', header, rows };
}

function buildEventDetailsFile(events: TrackerEvent[]): CsvFile {
  const header = ['eventId', 'detailType', 'name', 'amount', 'unit', 'value', 'extra'];
  const rows: string[][] = [];

  for (const event of events) {
    if (event.type === 'seizure') {
      rows.push([event.id, 'seizure-severity', '', '', '', event.severity, '']);
      rows.push([event.id, 'seizure-duration-class', '', '', '', event.durationClass, '']);

      if (event.exactDuration) {
        rows.push([
          event.id,
          'seizure-exact-duration',
          '',
          String(event.exactDuration.value),
          event.exactDuration.unit,
          '',
          ''
        ]);
      }

      for (const tag of event.triggerTags) {
        rows.push([event.id, 'trigger-tag', '', '', '', tag, '']);
      }
    }

    if (event.type === 'observation') {
      for (const tag of event.observationTags) {
        rows.push([event.id, 'observation-tag', '', '', '', tag, '']);
      }
    }

    if (event.type === 'therapy_dog') {
      rows.push([event.id, 'therapy-dog-intensity', '', '', '', event.intensity, '']);

      if (event.durationMinutes) {
        rows.push([event.id, 'therapy-dog-duration', '', String(event.durationMinutes), 'minutes', '', '']);
      }

      for (const tag of event.tags) {
        rows.push([event.id, 'therapy-tag', '', '', '', tag, '']);
      }
    }
  }

  return { name: 'event-details.csv', header, rows };
}

function buildDayStatesFile(events: TrackerEvent[], period: PeriodRange): CsvFile {
  const header = ['date', 'colorScore', 'seizures', 'observations', 'therapy_dogs'];
  const rows = eachDayInPeriod(period).map((date) => {
    const dayState = calculateDayState(events, date);

    return [
      dayState.date,
      dayState.colorScore,
      String(dayState.seizureCounts.total),
      String(dayState.eventCounts.byType.observation),
      String(dayState.eventCounts.byType.therapy_dog)
    ];
  });

  return { name: 'day-states.csv', header, rows };
}

function buildPhasesFile(phases: Phase[], period: PeriodRange): CsvFile {
  const header = ['id', 'name', 'startDate', 'endDate'];
  const rows = phases
    .filter((phase) => phaseOverlapsPeriod(phase, period))
    .map((phase) => [phase.id, phase.name, phase.startDate, phase.endDate ?? '']);

  return { name: 'phases.csv', header, rows };
}

export function serializeCsvFile(file: CsvFile): string {
  return [file.header, ...file.rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
