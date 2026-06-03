// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateDayState, DayState } from '../../domain/dayState';
import { TrackerEvent } from '../../domain/types';
import { CalendarMonth } from '../components/CalendarMonth';
import { DashboardScreen } from './DashboardScreen';

afterEach(() => {
  cleanup();
});

describe('DashboardScreen', () => {
  it('reveals quick-capture actions when the FAB is opened', async () => {
    const user = userEvent.setup();

    render(<DashboardScreen dayStates={dayStates} today="2026-06-03" backupStatusLabel="Backup offen" />);

    expect(screen.queryByRole('button', { name: 'Anfall' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Erfassen oeffnen/i }));

    expect(screen.getByRole('button', { name: 'Anfall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mahlzeit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gabe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beobachtung' })).toBeInTheDocument();
  });

  it('opens the day detail directly when a calendar day is tapped', async () => {
    const user = userEvent.setup();
    const onOpenDay = vi.fn();

    render(
      <DashboardScreen
        dayStates={dayStates}
        today="2026-06-03"
        backupStatusLabel="Backup offen"
        onOpenDay={onOpenDay}
      />
    );

    await user.click(screen.getByRole('button', { name: '5. Juni 2026, Status akut' }));

    expect(onOpenDay).toHaveBeenCalledWith('2026-06-05');
  });

  it('lets the user page through months via the calendar header', async () => {
    const user = userEvent.setup();

    render(<DashboardScreen dayStates={dayStates} today="2026-06-03" backupStatusLabel="Backup offen" />);

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

function dayButton(label: string) {
  return within(screen.getByRole('grid', { name: 'Juni 2026' })).getByRole('button', { name: label });
}

const dayStates: Record<string, DayState> = {
  '2026-06-01': calculateDayState([], '2026-06-01'),
  '2026-06-02': calculateDayState([seizure('2026-06-02', 'light')]),
  '2026-06-03': calculateDayState([
    seizure('2026-06-03', 'light', 'light-1'),
    seizure('2026-06-03', 'light', 'light-2')
  ]),
  '2026-06-04': calculateDayState([seizure('2026-06-04', 'severe')]),
  '2026-06-05': calculateDayState([
    seizure('2026-06-05', 'medium', 'medium-1'),
    seizure('2026-06-05', 'medium', 'medium-2')
  ])
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
