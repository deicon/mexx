import { addMonths, format, parseISO } from 'date-fns';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { calculateDayState, DayState } from '../../domain/dayState';
import { AppState, BackupStatus, EventType, ISODate, TrackerEvent } from '../../domain/types';
import { BottomNav } from '../components/BottomNav';
import { CalendarMonth } from '../components/CalendarMonth';
import { DayEventList } from '../components/DayEventList';

type DashboardRepository = {
  markEventDeleted: (eventId: string, deletedTime: string) => Promise<void>;
};

type DashboardScreenProps = {
  appState: AppState;
  dayStates: Record<ISODate, DayState>;
  today: ISODate;
  repository: DashboardRepository;
  backupStatus?: BackupStatus;
  backupStatusLabel?: string;
  initialMonth?: ISODate;
  initialSelectedDate?: ISODate;
  onAction?: (type: EventType, selectedDate: ISODate) => void;
  onEditEvent?: (event: TrackerEvent) => void;
  onReload?: () => void | Promise<void>;
  onOpenPhases?: () => void;
  onOpenKnownTerms?: () => void;
  onOpenMealTemplates?: () => void;
  onOpenExports?: () => void;
  onOpenReports?: () => void;
};

export function DashboardScreen({
  appState,
  dayStates,
  today,
  repository,
  backupStatus,
  backupStatusLabel,
  initialMonth,
  initialSelectedDate,
  onAction,
  onEditEvent,
  onReload,
  onOpenPhases,
  onOpenKnownTerms,
  onOpenMealTemplates,
  onOpenExports,
  onOpenReports
}: DashboardScreenProps) {
  const [monthDate, setMonthDate] = useState<ISODate>(
    initialMonth ?? format(parseISO(today), 'yyyy-MM-01')
  );
  const [selectedDate, setSelectedDate] = useState<ISODate>(initialSelectedDate ?? today);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedDayState = dayStates[selectedDate] ?? calculateDayState(appState.events, selectedDate);
  const isToday = selectedDate === today;
  const dateLabel = isToday ? 'Heute' : formatWeekdayLongDate(parseISO(selectedDate));

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
    setSelectedDate(today);
  }

  function selectDay(date: ISODate) {
    setSelectedDate(date);
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
              <p className="eyebrow">{dateLabel}</p>
              <h1 id="app-title">Mexx</h1>
            </div>
          </div>
          <div
            className={`status-pill status-pill--${selectedDayState.colorScore}`}
            aria-label={`Tagesstatus ${selectedDayState.colorScore}`}
          >
            {statusLabel(selectedDayState.colorScore)}
          </div>
        </section>

        <section className="today-summary" aria-label="Tagesuebersicht">
          <StatusMetric label="Anfaelle" value={selectedDayState.seizureCounts.total} />
          <StatusMetric label="Eintraege" value={selectedDayState.eventCounts.total} />
          <StatusMetric label="Kot" value={selectedDayState.stoolSummary.total} />
        </section>

        <p className="backup-hint">{backupStatusLabel ?? formatBackupStatus(backupStatus)}</p>

        <CalendarMonth
          monthDate={monthDate}
          dayStates={dayStates}
          today={today}
          selectedDate={selectedDate}
          onSelectDay={selectDay}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          onJumpToToday={goToToday}
        />

        <DayEventList
          events={appState.events}
          date={selectedDate}
          repository={repository}
          onEdit={(event) => onEditEvent?.(event)}
          onChanged={async () => {
            await onReload?.();
          }}
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
            <button className="app-menu__item" type="button" onClick={() => runMenuAction(onOpenMealTemplates)}>
              Futtervorlagen
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
        onCapture={(type) => onAction?.(type, selectedDate)}
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

function formatWeekdayLongDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
