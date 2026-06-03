import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { calculateDayState, DayState } from './domain/dayState';
import { AppState, EventType, ISODate } from './domain/types';
import { trackerRepository } from './storage/repository';
import { CaptureScreens } from './ui/screens/CaptureScreens';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { DayDetailScreen } from './ui/screens/DayDetailScreen';
import { ExportsScreen } from './ui/screens/ExportsScreen';
import { KnownTermsScreen } from './ui/screens/KnownTermsScreen';
import { PhasesScreen } from './ui/screens/PhasesScreen';
import { ReportsScreen } from './ui/screens/ReportsScreen';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; state: AppState }
  | { status: 'error'; message: string };

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [captureType, setCaptureType] = useState<EventType | null>(null);
  const [selectedDayDetailDate, setSelectedDayDetailDate] = useState<ISODate | null>(null);
  const [eventToEdit, setEventToEdit] = useState<AppState['events'][number] | null>(null);
  const [maintenanceScreen, setMaintenanceScreen] = useState<
    'phases' | 'knownTerms' | 'exports' | 'reports' | null
  >(null);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    let active = true;

    void reloadAppState(() => active);

    return () => {
      active = false;
    };
  }, []);

  if (loadState.status === 'loading') {
    return (
      <main className="app-shell app-shell--centered">
        <p className="loading-text">Mexx Tracker laedt...</p>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="app-shell app-shell--centered" role="alert">
        <p className="loading-text">{loadState.message}</p>
      </main>
    );
  }

  if (eventToEdit) {
    return (
      <CaptureScreens
        type={eventToEdit.type}
        appState={loadState.state}
        repository={trackerRepository}
        eventToEdit={eventToEdit}
        onCancel={() => setEventToEdit(null)}
        onDone={async () => {
          await reloadAppState(() => true);
          setEventToEdit(null);
        }}
      />
    );
  }

  if (captureType) {
    return (
      <CaptureScreens
        type={captureType}
        appState={loadState.state}
        repository={trackerRepository}
        onCancel={() => setCaptureType(null)}
        onDone={async () => {
          await reloadAppState(() => true);
          setCaptureType(null);
        }}
      />
    );
  }

  if (selectedDayDetailDate) {
    return (
      <DayDetailScreen
        appState={loadState.state}
        date={selectedDayDetailDate}
        repository={trackerRepository}
        onBack={() => setSelectedDayDetailDate(null)}
        onEdit={setEventToEdit}
        onChanged={async () => {
          await reloadAppState(() => true);
        }}
      />
    );
  }

  if (maintenanceScreen === 'phases') {
    return (
      <PhasesScreen
        phases={loadState.state.phases}
        repository={trackerRepository}
        onBack={() => setMaintenanceScreen(null)}
        onChanged={async () => {
          await reloadAppState(() => true);
        }}
      />
    );
  }

  if (maintenanceScreen === 'knownTerms') {
    return (
      <KnownTermsScreen
        appState={loadState.state}
        repository={trackerRepository}
        onBack={() => setMaintenanceScreen(null)}
        onChanged={async () => {
          await reloadAppState(() => true);
        }}
      />
    );
  }

  if (maintenanceScreen === 'exports') {
    return (
      <ExportsScreen
        appState={loadState.state}
        repository={trackerRepository}
        onBack={() => setMaintenanceScreen(null)}
        onChanged={async () => {
          await reloadAppState(() => true);
        }}
      />
    );
  }

  if (maintenanceScreen === 'reports') {
    return (
      <ReportsScreen
        appState={loadState.state}
        onBack={() => setMaintenanceScreen(null)}
        today={today}
      />
    );
  }

  return (
    <DashboardScreen
      dayStates={calculateVisibleDayStates(loadState.state, today)}
      today={today}
      backupStatus={loadState.state.settings.backupStatus}
      onAction={setCaptureType}
      onOpenPhases={() => setMaintenanceScreen('phases')}
      onOpenKnownTerms={() => setMaintenanceScreen('knownTerms')}
      onOpenExports={() => setMaintenanceScreen('exports')}
      onOpenReports={() => setMaintenanceScreen('reports')}
      onOpenDay={setSelectedDayDetailDate}
    />
  );

  async function reloadAppState(isActive: () => boolean) {
    try {
      const state = await trackerRepository.loadAppState();

      if (isActive()) {
        setLoadState({ status: 'ready', state });
      }
    } catch (error: unknown) {
      if (isActive()) {
        setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'App konnte nicht laden' });
      }
    }
  }
}

function calculateVisibleDayStates(state: AppState, today: ISODate): Record<ISODate, DayState> {
  const monthStart = startOfMonth(parseISO(today));
  const monthEnd = endOfMonth(monthStart);

  return Object.fromEntries(
    eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
      const date = format(day, 'yyyy-MM-dd');

      return [date, calculateDayState(state.events, date)];
    })
  );
}
