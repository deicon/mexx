// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateDayState, DayState } from '../../domain/dayState';
import { AppState, SCHEMA_VERSION, TrackerEvent } from '../../domain/types';
import { CalendarMonth } from '../components/CalendarMonth';
import { DashboardScreen } from './DashboardScreen';

afterEach(() => {
  cleanup();
});

describe('DashboardScreen', () => {
  it('reveals quick-capture actions when the FAB is opened', async () => {
    const user = userEvent.setup();

    renderDashboard();

    expect(screen.queryByRole('button', { name: 'Anfall' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Erfassen oeffnen/i }));

    expect(screen.getByRole('button', { name: 'Anfall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Therapiehund' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beobachtung' })).toBeInTheDocument();
  });

  it('updates the top summary and event list when a calendar day is tapped', async () => {
    const user = userEvent.setup();

    renderDashboard();

    expect(screen.getByText('Heute')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '5. Juni 2026, Status akut' }));

    expect(screen.getByText(/5\. Juni 2026/)).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Tagesuebersicht' });
    expect(metricValue(summary, 'Anfaelle')).toHaveTextContent('2');

    const list = screen.getByRole('region', { name: 'Chronologische Eintraege' });
    expect(within(list).getAllByRole('article')).toHaveLength(2);
  });

  it('forwards capture taps with the currently selected date', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    renderDashboard({ onAction });

    await user.click(screen.getByRole('button', { name: '5. Juni 2026, Status akut' }));
    await user.click(screen.getByRole('button', { name: /Erfassen oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Anfall' }));

    expect(onAction).toHaveBeenCalledWith('seizure', '2026-06-05');
  });

  it('exposes maintenance actions behind the header menu', async () => {
    const user = userEvent.setup();
    const onOpenPhases = vi.fn();
    const onOpenKnownTerms = vi.fn();
    const onOpenExports = vi.fn();

    renderDashboard({ onOpenPhases, onOpenKnownTerms, onOpenExports });

    expect(screen.queryByRole('button', { name: 'Phasen' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Menue oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Phasen' }));
    expect(onOpenPhases).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Menue oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Begriffe' }));
    expect(onOpenKnownTerms).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Menue oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Daten' }));
    expect(onOpenExports).toHaveBeenCalled();
  });

  it('runs the refresh action when the Aktualisieren menu item is tapped', async () => {
    const user = userEvent.setup();
    const onRefreshApp = vi.fn().mockResolvedValue(undefined);

    renderDashboard({ onRefreshApp });

    await user.click(screen.getByRole('button', { name: /Menue oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    expect(onRefreshApp).toHaveBeenCalledTimes(1);
  });

  it('lets the user page through months via the calendar header', async () => {
    const user = userEvent.setup();

    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Juni 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Naechster Monat' }));
    expect(screen.getByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    expect(screen.getByRole('heading', { name: 'Mai 2026' })).toBeInTheDocument();
  });
});

describe('CalendarMonth', () => {
  it('renders a month calendar with score classes for green, yellow, orange, and red days', () => {
    render(
      <CalendarMonth
        monthDate="2026-06-01"
        dayStates={dayStates}
        selectedDate="2026-06-03"
        onSelectDay={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Juni 2026' })).toBeInTheDocument();

    expect(dayButton('1. Juni 2026, Status ruhig')).toHaveClass('calendar-day--green');
    expect(dayButton('2. Juni 2026, Status leicht')).toHaveClass('calendar-day--yellow');
    expect(dayButton('3. Juni 2026, Status auffaellig')).toHaveClass('calendar-day--orange');
    expect(dayButton('4. Juni 2026, Status akut')).toHaveClass('calendar-day--red');
  });

  it('calls the selection callback when a day is clicked', async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();

    render(
      <CalendarMonth
        monthDate="2026-06-01"
        dayStates={dayStates}
        selectedDate="2026-06-03"
        onSelectDay={onSelectDay}
      />
    );

    await user.click(dayButton('5. Juni 2026, Status akut'));

    expect(onSelectDay).toHaveBeenCalledWith('2026-06-05');
  });
});

function renderDashboard(overrides: Partial<Parameters<typeof DashboardScreen>[0]> = {}) {
  const repository = overrides.repository ?? {
    markEventDeleted: vi.fn<(id: string, deletedTime: string) => Promise<void>>().mockResolvedValue(undefined)
  };

  return render(
    <DashboardScreen
      appState={appState}
      today="2026-06-03"
      repository={repository}
      backupStatusLabel="Backup offen"
      {...overrides}
    />
  );
}

function dayButton(label: string) {
  return within(screen.getByRole('grid', { name: 'Juni 2026' })).getByRole('button', { name: label });
}

function metricValue(summary: HTMLElement, label: string) {
  return within(summary).getByText(label).previousSibling as HTMLElement;
}

const seizures = [
  seizure('2026-06-02', 'light'),
  seizure('2026-06-03', 'light', 'light-1'),
  seizure('2026-06-03', 'light', 'light-2'),
  seizure('2026-06-04', 'severe'),
  seizure('2026-06-05', 'medium', 'medium-1'),
  seizure('2026-06-05', 'medium', 'medium-2')
];

const appState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  events: seizures,
  knownTerms: [],
  phases: [],
  settings: { trackedDogName: 'Mexx' }
};

const dayStates: Record<string, DayState> = {
  '2026-06-01': calculateDayState(seizures, '2026-06-01'),
  '2026-06-02': calculateDayState(seizures, '2026-06-02'),
  '2026-06-03': calculateDayState(seizures, '2026-06-03'),
  '2026-06-04': calculateDayState(seizures, '2026-06-04'),
  '2026-06-05': calculateDayState(seizures, '2026-06-05')
};

function seizure(date: string, severity: 'light' | 'medium' | 'severe', id = `${date}-${severity}`): TrackerEvent {
  return {
    id,
    type: 'seizure',
    eventTime: `${date}T08:00:00.000Z`,
    captureTime: `${date}T08:01:00.000Z`,
    changeTime: `${date}T08:01:00.000Z`,
    severity,
    durationClass: '1-3-min',
    triggerTags: []
  };
}
