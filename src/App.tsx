import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getEventCalendarDate } from './domain/dayState';
import { AppState, EventType, ISODate } from './domain/types';
import { trackerRepository } from './storage/repository';
import { CaptureScreens } from './ui/screens/CaptureScreens';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { ExportsScreen } from './ui/screens/ExportsScreen';
import { KnownTermsScreen } from './ui/screens/KnownTermsScreen';
import { PhasesScreen } from './ui/screens/PhasesScreen';
import { ReportsScreen } from './ui/screens/ReportsScreen';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; state: AppState }
  | { status: 'error'; message: string };

type CaptureRequest = {
  type: EventType;
  defaultDate: ISODate;
};

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [captureRequest, setCaptureRequest] = useState<CaptureRequest | null>(null);
  const [eventToEdit, setEventToEdit] = useState<AppState['events'][number] | null>(null);
  const [maintenanceScreen, setMaintenanceScreen] = useState<
    'phases' | 'knownTerms' | 'exports' | 'reports' | null
  >(null);
  const [dashboardFocusDate, setDashboardFocusDate] = useState<ISODate | null>(null);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const reloadTokenRef = useRef(0);

  useEffect(() => {
    void reloadAppState();
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
          await reloadAppState();
          setEventToEdit(null);
        }}
      />
    );
  }

  if (captureRequest) {
    return (
      <CaptureScreens
        type={captureRequest.type}
        appState={loadState.state}
        repository={trackerRepository}
        defaultDate={captureRequest.defaultDate}
        onCancel={() => setCaptureRequest(null)}
        onDone={async () => {
          await reloadAppState();
          setCaptureRequest(null);
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
          await reloadAppState();
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
          await reloadAppState();
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
          const refreshed = await reloadAppState();
          const focus = pickFocusDate(refreshed, today);

          if (focus) {
            setDashboardFocusDate(focus);
          }
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
        onCapture={(type) => {
          setMaintenanceScreen(null);
          setCaptureRequest({ type, defaultDate: today });
        }}
      />
    );
  }

  return (
    <DashboardScreen
      appState={loadState.state}
      today={today}
      repository={trackerRepository}
      backupStatus={loadState.state.settings.backupStatus}
      initialSelectedDate={dashboardFocusDate ?? undefined}
      initialMonth={dashboardFocusDate ? format(parseISO(dashboardFocusDate), 'yyyy-MM-01') : undefined}
      onAction={(type) => setCaptureRequest({ type, defaultDate: today })}
      onEditEvent={setEventToEdit}
      onReload={async () => {
        await reloadAppState();
      }}
      onOpenPhases={() => setMaintenanceScreen('phases')}
      onOpenKnownTerms={() => setMaintenanceScreen('knownTerms')}
      onOpenExports={() => setMaintenanceScreen('exports')}
      onOpenReports={() => setMaintenanceScreen('reports')}
    />
  );

  async function reloadAppState(): Promise<AppState | null> {
    const token = ++reloadTokenRef.current;

    try {
      const state = await trackerRepository.loadAppState();

      if (token !== reloadTokenRef.current) {
        return null;
      }

      setLoadState({ status: 'ready', state });

      return state;
    } catch (error: unknown) {
      if (token !== reloadTokenRef.current) {
        return null;
      }

      setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'App konnte nicht laden' });

      return null;
    }
  }
}

function pickFocusDate(state: AppState | null, today: ISODate): ISODate | null {
  if (!state) {
    return null;
  }

  const activeEventDates = state.events
    .filter((event) => event.deleted !== true)
    .map((event) => getEventCalendarDate(event.eventTime));

  if (activeEventDates.includes(today)) {
    return today;
  }

  return activeEventDates.sort().pop() ?? null;
}
