import { eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth } from 'date-fns';
import { useId } from 'react';
import { DayState } from '../../domain/dayState';
import { ISODate } from '../../domain/types';

type CalendarMonthProps = {
  monthDate: ISODate;
  dayStates: Record<ISODate, DayState>;
  selectedDate?: ISODate;
  today?: ISODate;
  onSelectDay: (date: ISODate) => void;
};

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function CalendarMonth({ monthDate, dayStates, selectedDate, today, onSelectDay }: CalendarMonthProps) {
  const headingId = useId();
  const monthStart = startOfMonth(parseISO(monthDate));
  const monthEnd = endOfMonth(monthStart);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingEmptyDays = (getDay(monthStart) + 6) % 7;
  const monthLabel = formatMonthLabel(monthStart);

  return (
    <section className="calendar-month" aria-labelledby={headingId}>
      <div className="section-heading">
        <p className="eyebrow">Monat</p>
        <h2 id={headingId}>{monthLabel}</h2>
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {weekdays.map((weekday) => (
          <div className="calendar-weekday" role="columnheader" key={weekday}>
            {weekday}
          </div>
        ))}
        {Array.from({ length: leadingEmptyDays }).map((_, index) => (
          <div className="calendar-empty" role="gridcell" key={`empty-${index}`} />
        ))}
        {monthDays.map((day) => {
          const date = format(day, 'yyyy-MM-dd');
          const dayState = dayStates[date] ?? emptyDayState(date);
          const isSelected = selectedDate === date;
          const isToday = today === date;

          return (
            <div className="calendar-cell" role="gridcell" key={date}>
              <button
                className={[
                  'calendar-day',
                  `calendar-day--${dayState.colorScore}`,
                  isSelected ? 'calendar-day--selected' : '',
                  isToday ? 'calendar-day--today' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                aria-label={`${formatLongDate(day)}, Status ${statusLabel(dayState.colorScore)}`}
                aria-pressed={isSelected}
                onClick={() => onSelectDay(date)}
              >
                <span>{format(day, 'd')}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function emptyDayState(date: ISODate): DayState {
  return {
    date,
    colorScore: 'green',
    seizureCounts: {
      total: 0,
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
    },
    stoolSummary: {
      total: 0,
      byQuality: {
        'firm-formed': 0,
        normal: 0,
        soft: 0,
        mushy: 0,
        diarrhea: 0
      }
    },
    eventCounts: {
      total: 0,
      byType: {
        seizure: 0,
        meal: 0,
        stool: 0,
        dose: 0,
        observation: 0
      }
    }
  };
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date);
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function statusLabel(score: DayState['colorScore']): string {
  const labels: Record<DayState['colorScore'], string> = {
    green: 'ruhig',
    yellow: 'leicht',
    orange: 'auffaellig',
    red: 'akut'
  };

  return labels[score];
}
