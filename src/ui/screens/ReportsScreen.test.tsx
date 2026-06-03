// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture } from '../../domain/fixtures';
import { ReportsScreen } from './ReportsScreen';

afterEach(() => {
  cleanup();
});

describe('ReportsScreen', () => {
  it('renders the default last-7-day report with totals and disclaimer', () => {
    render(
      <ReportsScreen
        appState={appStateFixture}
        onBack={vi.fn()}
        today="2026-06-03"
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    expect(screen.getByRole('heading', { name: /Klinischer Bericht/i })).toBeInTheDocument();
    expect(screen.getByText(/Zeitraum: 2026-05-28 bis 2026-06-03/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Zusammenfassung/i })).toBeInTheDocument();
    expect(screen.getByText(/Nur Korrelation/i)).toBeInTheDocument();
  });

  it('updates the report when selecting a different period', async () => {
    const user = userEvent.setup();

    render(
      <ReportsScreen
        appState={appStateFixture}
        onBack={vi.fn()}
        today="2026-06-03"
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Letzte 30 Tage' }));

    expect(screen.getByText(/Zeitraum: 2026-05-05 bis 2026-06-03/)).toBeInTheDocument();
  });

  it('supports a custom date range', async () => {
    const user = userEvent.setup();

    render(
      <ReportsScreen
        appState={appStateFixture}
        onBack={vi.fn()}
        today="2026-06-03"
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Eigener Zeitraum' }));
    await user.type(screen.getByLabelText('Von'), '2026-06-01');
    await user.type(screen.getByLabelText('Bis'), '2026-06-02');

    expect(screen.getByText(/Zeitraum: 2026-06-01 bis 2026-06-02/)).toBeInTheDocument();
  });

  it('downloads a CSV package using the injected downloader', async () => {
    const user = userEvent.setup();
    const downloadFile = vi.fn();

    render(
      <ReportsScreen
        appState={appStateFixture}
        onBack={vi.fn()}
        today="2026-06-03"
        now={() => new Date('2026-06-03T20:00:00.000Z')}
        downloadFile={downloadFile}
      />
    );

    await user.click(screen.getByRole('button', { name: /CSV-Paket herunterladen/i }));

    const filenames = downloadFile.mock.calls.map((call) => call[0]);
    expect(filenames).toEqual(
      expect.arrayContaining(['events.csv', 'event-details.csv', 'day-states.csv', 'phases.csv'])
    );
    const [, eventsContent, eventsMime] = downloadFile.mock.calls.find((call) => call[0] === 'events.csv')!;
    expect(eventsContent).toMatch(/^id,type,eventTime,captureTime,changeTime,note/);
    expect(eventsMime).toBe('text/csv;charset=utf-8');
  });

  it('triggers the browser print dialog for the clinical report', async () => {
    const user = userEvent.setup();
    const print = vi.fn();

    render(
      <ReportsScreen
        appState={appStateFixture}
        onBack={vi.fn()}
        today="2026-06-03"
        now={() => new Date('2026-06-03T20:00:00.000Z')}
        print={print}
      />
    );

    await user.click(screen.getByRole('button', { name: /Bericht drucken/i }));

    expect(print).toHaveBeenCalled();
  });
});
