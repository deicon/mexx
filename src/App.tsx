import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { calculateDayState, DayState } from './domain/dayState';
import { AppState, ISODate } from './domain/types';
import { trackerRepository } from './storage/repository';
import { DashboardScreen } from './ui/screens/DashboardScreen';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; state: AppState }
  | { status: 'error'; message: string };

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    let active = true;

    trackerRepository
      .loadAppState()
      .then((state) => {
        if (active) {
          setLoadState({ status: 'ready', state });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'App konnte nicht laden' });
        }
      });

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

  return (
    <DashboardScreen
      dayStates={calculateVisibleDayStates(loadState.state, today)}
      today={today}
      backupStatus={loadState.state.settings.backupStatus}
    />
  );
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
