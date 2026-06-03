import { addMonths, format, parseISO } from 'date-fns';
import { useState } from 'react';
import { DayState } from '../../domain/dayState';
import { BackupStatus, EventType, ISODate } from '../../domain/types';
import { BottomNav } from '../components/BottomNav';
import { CalendarMonth } from '../components/CalendarMonth';

type DashboardScreenProps = {
  dayStates: Record<ISODate, DayState>;
  today: ISODate;
  backupStatus?: BackupStatus;
  backupStatusLabel?: string;
  initialMonth?: ISODate;
  onAction?: (type: EventType) => void;
  onOpenPhases?: () => void;
  onOpenKnownTerms?: () => void;
  onOpenExports?: () => void;
  onOpenReports?: () => void;
  onOpenDay?: (date: ISODate) => void;
};

export function DashboardScreen({
  dayStates,
  today,
  backupStatus,
  backupStatusLabel,
  initialMonth,
  onAction,
  onOpenPhases,
  onOpenKnownTerms,
  onOpenExports,
  onOpenReports,
  onOpenDay
}: DashboardScreenProps) {
  const [monthDate, setMonthDate] = useState<ISODate>(
    initialMonth ?? format(parseISO(today), 'yyyy-MM-01')
  );
  const todayState = dayStates[today];

  function shiftMonth(delta: number) {
    setMonthDate(format(addMonths(parseISO(monthDate), delta), 'yyyy-MM-01'));
  }

  return (
    <>
      <main className="app-shell app-shell--has-bottom-nav">
        <section className="today-status" aria-labelledby="app-title">
          <div>
            <p className="eyebrow">Heute</p>
            <h1 id="app-title">Mexx</h1>
          </div>
          <div
            className={`status-pill status-pill--${todayState.colorScore}`}
            aria-label={`Tagesstatus ${todayState.colorScore}`}
          >
            {statusLabel(todayState.colorScore)}
          </div>
        </section>

        <section className="today-summary" aria-label="Heutige Zusammenfassung">
          <StatusMetric label="Anfaelle" value={todayState.seizureCounts.total} />
          <StatusMetric label="Eintraege" value={todayState.eventCounts.total} />
          <StatusMetric label="Kot" value={todayState.stoolSummary.total} />
        </section>

        <p className="backup-hint">{backupStatusLabel ?? formatBackupStatus(backupStatus)}</p>

        <CalendarMonth
          monthDate={monthDate}
          dayStates={dayStates}
          today={today}
          onSelectDay={(date) => onOpenDay?.(date)}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
        />

        <div className="dashboard-maintenance-actions">
          <button className="secondary-dashboard-action" type="button" onClick={onOpenPhases}>
            Phasen
          </button>
          <button className="secondary-dashboard-action" type="button" onClick={onOpenKnownTerms}>
            Begriffe
          </button>
          <button className="secondary-dashboard-action" type="button" onClick={onOpenExports}>
            Daten
          </button>
        </div>
      </main>

      <BottomNav
        active="dashboard"
        onDashboard={() => undefined}
        onReports={() => onOpenReports?.()}
        onCapture={(type) => onAction?.(type)}
      />
    </>
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

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
