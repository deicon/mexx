import { format, parseISO } from 'date-fns';
import { getEventCalendarDate } from '../../domain/dayState';
import { EventId, ISODate, SeizureDurationClass, SeizureSeverity, StoolQuality, TrackerEvent } from '../../domain/types';

type DayEventListRepository = {
  markEventDeleted: (eventId: EventId, deletedTime: string) => Promise<void>;
};

type DayEventListProps = {
  events: TrackerEvent[];
  date: ISODate;
  repository: DayEventListRepository;
  onEdit: (event: TrackerEvent) => void;
  onChanged: () => void | Promise<void>;
  now?: () => Date;
};

export function DayEventList({
  events,
  date,
  repository,
  onEdit,
  onChanged,
  now = () => new Date()
}: DayEventListProps) {
  const visibleEvents = events
    .filter((event) => event.deleted !== true && getEventCalendarDate(event.eventTime) === date)
    .slice()
    .sort((left, right) => parseISO(left.eventTime).getTime() - parseISO(right.eventTime).getTime());

  async function deleteEvent(event: TrackerEvent) {
    await repository.markEventDeleted(event.id, now().toISOString());
    await onChanged();
  }

  return (
    <section className="day-event-list" aria-label="Chronologische Eintraege">
      {visibleEvents.length === 0 ? <p className="empty-day-text">Keine Eintraege fuer diesen Tag.</p> : null}
      {visibleEvents.map((event) => (
        <article className="day-event-card" aria-label={eventAccessibleName(event)} key={event.id}>
          <div className="day-event-card__main">
            <time dateTime={event.eventTime}>{format(parseISO(event.eventTime), 'HH:mm')}</time>
            <div>
              <h2>{eventTypeLabel(event)}</h2>
              <p>{eventSummary(event)}</p>
              {event.note ? <p className="day-event-card__note">{event.note}</p> : null}
            </div>
          </div>
          <div className="day-event-card__actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEdit(event)}
              aria-label={`${eventAccessibleName(event)} bearbeiten`}
            >
              Bearbeiten
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => void deleteEvent(event)}
              aria-label={`${eventAccessibleName(event)} loeschen`}
            >
              Loeschen
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function eventAccessibleName(event: TrackerEvent): string {
  return `${eventTypeLabel(event)} um ${format(parseISO(event.eventTime), 'HH:mm')}`;
}

function eventTypeLabel(event: TrackerEvent): string {
  const labels: Record<TrackerEvent['type'], string> = {
    seizure: 'Anfall',
    meal: 'Mahlzeit',
    stool: 'Kot',
    dose: 'Gabe',
    observation: 'Beobachtung'
  };

  return labels[event.type];
}

function eventSummary(event: TrackerEvent): string {
  switch (event.type) {
    case 'seizure':
      return `Schwere ${seizureSeverityLabel(event.severity)}, Dauer ${seizureDurationLabel(event.durationClass)}`;
    case 'meal':
      return event.foodComponents
        .map((component) => `${component.name} ${component.consumedAmount}${component.unit}`)
        .join(', ');
    case 'stool':
      return `Qualitaet ${stoolQualityLabel(event.quality)}${event.stoolFlags.length ? `, ${event.stoolFlags.join(', ')}` : ''}`;
    case 'dose':
      return `${event.name} ${event.administeredAmount}${event.unit}`;
    case 'observation':
      return event.observationTags.length ? event.observationTags.join(', ') : 'Ohne Schlagwort';
  }
}

function seizureSeverityLabel(severity: SeizureSeverity): string {
  return { light: 'leicht', medium: 'mittel', severe: 'schwer' }[severity];
}

function seizureDurationLabel(durationClass: SeizureDurationClass): string {
  return {
    'under-1-min': 'unter 1 Minute',
    '1-3-min': '1 bis 3 Minuten',
    '3-5-min': '3 bis 5 Minuten',
    'over-5-min': 'ueber 5 Minuten',
    unknown: 'unbekannt'
  }[durationClass];
}

function stoolQualityLabel(quality: StoolQuality): string {
  return {
    'firm-formed': 'fest geformt',
    normal: 'normal',
    soft: 'weich',
    mushy: 'breiig',
    diarrhea: 'Durchfall'
  }[quality];
}
