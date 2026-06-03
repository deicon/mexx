import { addMonths, format, parseISO } from 'date-fns';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const todayState = dayStates[today];

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  function shiftMonth(delta: number) {
    setMonthDate(format(addMonths(parseISO(monthDate), delta), 'yyyy-MM-01'));
  }

  function goToToday() {
    setMonthDate(format(parseISO(today), 'yyyy-MM-01'));
  }

  function runMenuAction(action?: () => void) {
    setMenuOpen(false);
    action?.();
  }

  return (
    <>
      <main className="app-shell app-shell--has-bottom-nav">
        <section className="today-status" aria-labelledby="app-title">
          <div className="today-status__left">
            <button
              type="button"
              className="header-menu-button"
              aria-label="Menue oeffnen"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu aria-hidden="true" size={22} strokeWidth={2.2} />
            </button>
            <div>
              <p className="eyebrow">Heute</p>
              <h1 id="app-title">Mexx</h1>
            </div>
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
          onJumpToToday={goToToday}
        />

      </main>

      {menuOpen ? (
        <div className="app-menu" role="dialog" aria-modal="true" aria-label="Menue">
          <button
            type="button"
            className="app-menu__backdrop"
            aria-label="Menue schliessen"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="app-menu__panel" aria-label="Wartung">
            <p className="eyebrow app-menu__eyebrow">Pflege</p>
            <button className="app-menu__item" type="button" onClick={() => runMenuAction(onOpenPhases)}>
              Phasen
            </button>
            <button className="app-menu__item" type="button" onClick={() => runMenuAction(onOpenKnownTerms)}>
              Begriffe
            </button>
            <button className="app-menu__item" type="button" onClick={() => runMenuAction(onOpenExports)}>
              Daten
            </button>
          </nav>
        </div>
      ) : null}

      <BottomNav
        active="dashboard"
        onDashboard={goToToday}
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
