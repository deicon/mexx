import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { DayState } from '../../domain/dayState';
import { BackupStatus, EventType, ISODate } from '../../domain/types';
import { CalendarMonth } from '../components/CalendarMonth';
import { QuickActions } from '../components/QuickActions';

type DashboardScreenProps = {
  dayStates: Record<ISODate, DayState>;
  today: ISODate;
  backupStatus?: BackupStatus;
  backupStatusLabel?: string;
  onAction?: (type: EventType) => void;
  onOpenPhases?: () => void;
  onOpenKnownTerms?: () => void;
  onOpenExports?: () => void;
  onOpenReports?: () => void;
  onSelectDay?: (date: ISODate) => void;
  onOpenDay?: (date: ISODate) => void;
};

export function DashboardScreen({
  dayStates,
  today,
  backupStatus,
  backupStatusLabel,
  onAction,
  onOpenPhases,
  onOpenKnownTerms,
  onOpenExports,
  onOpenReports,
  onSelectDay,
  onOpenDay
}: DashboardScreenProps) {
  const [selectedDate, setSelectedDate] = useState<ISODate>(today);
  const todayState = dayStates[today];
  const selectedState = dayStates[selectedDate] ?? todayState;
  const monthDate = useMemo(() => format(parseISO(today), 'yyyy-MM-01'), [today]);

  function selectDay(date: ISODate) {
    setSelectedDate(date);
    onSelectDay?.(date);
  }

  return (
    <main className="app-shell">
      <section className="today-status" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Heute</p>
          <h1 id="app-title">Mexx</h1>
        </div>
        <div className={`status-pill status-pill--${todayState.colorScore}`} aria-label={`Tagesstatus ${todayState.colorScore}`}>
          {statusLabel(todayState.colorScore)}
        </div>
      </section>

      <section className="today-summary" aria-label="Heutige Zusammenfassung">
        <StatusMetric label="Anfaelle" value={todayState.seizureCounts.total} />
        <StatusMetric label="Eintraege" value={todayState.eventCounts.total} />
        <StatusMetric label="Kot" value={todayState.stoolSummary.total} />
      </section>

      <QuickActions onAction={onAction} />

      <button className="secondary-dashboard-action" type="button" onClick={() => onAction?.('observation')}>
        Beobachtung
      </button>

      <div className="dashboard-maintenance-actions">
        <button className="secondary-dashboard-action" type="button" onClick={onOpenPhases}>
          Phasen
        </button>
        <button className="secondary-dashboard-action" type="button" onClick={onOpenKnownTerms}>
          Begriffe
        </button>
        <button className="secondary-dashboard-action" type="button" onClick={onOpenReports}>
          Bericht
        </button>
        <button className="secondary-dashboard-action" type="button" onClick={onOpenExports}>
          Daten
        </button>
      </div>

      <p className="backup-hint">{backupStatusLabel ?? formatBackupStatus(backupStatus)}</p>

      <CalendarMonth
        monthDate={monthDate}
        dayStates={dayStates}
        selectedDate={selectedDate}
        today={today}
        onSelectDay={selectDay}
      />

      <section className="selected-day" aria-labelledby="selected-day-heading">
        <p className="eyebrow">Auswahl</p>
        <h2 id="selected-day-heading">{formatLongDate(parseISO(selectedDate))}</h2>
        <p>{summaryText(selectedState)}</p>
        <button className="secondary-button selected-day__open" type="button" onClick={() => onOpenDay?.(selectedDate)}>
          Tag oeffnen
        </button>
      </section>
    </main>
  );
}

function StatusMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="status-metric">
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}

function statusLabel(score: DayState['colorScore']): string {
  const labels: Record<DayState['colorScore'], string> = {
    green: 'Ruhig',
    yellow: 'Leicht',
    orange: 'Auffaellig',
    red: 'Akut'
  };

  return labels[score];
}

function formatBackupStatus(backupStatus?: BackupStatus): string {
  if (!backupStatus?.lastBackupTime) {
    return 'Backup offen';
  }

  return `Backup: ${formatLongDate(parseISO(backupStatus.lastBackupTime))}`;
}

function summaryText(dayState: DayState): string {
  const seizureText = `${dayState.seizureCounts.total} ${dayState.seizureCounts.total === 1 ? 'Anfall' : 'Anfaelle'}`;
  const eventText = `${dayState.eventCounts.total} ${dayState.eventCounts.total === 1 ? 'Eintrag' : 'Eintraege'}`;

  return `${seizureText}, ${eventText}`;
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
