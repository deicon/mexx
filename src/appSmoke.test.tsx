// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture } from './domain/fixtures';
import { AppState } from './domain/types';
import { App } from './App';

const repositoryMock = vi.hoisted(() => ({
  loadAppState: vi.fn(),
  replaceAppState: vi.fn(),
  upsertEvent: vi.fn(),
  markEventDeleted: vi.fn(),
  saveMealTemplate: vi.fn(),
  saveKnownTerm: vi.fn(),
  savePhase: vi.fn(),
  saveBackupStatus: vi.fn()
}));

vi.mock('./storage/repository', () => ({
  trackerRepository: repositoryMock
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-03T10:05:00+02:00'));
  for (const fn of Object.values(repositoryMock)) {
    fn.mockReset();
    fn.mockResolvedValue(undefined);
  }
  repositoryMock.loadAppState.mockResolvedValue(emptyState());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('App accessibility smoke', () => {
  it('exposes the dashboard heading and primary quick actions on load', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Mexx' });

    for (const label of ['Anfall', 'Mahlzeit', 'Kot', 'Gabe', 'Beobachtung']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('makes the primary quick action focusable via the keyboard', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);
    await screen.findByRole('heading', { name: 'Mexx' });

    const seizureButton = screen.getByRole('button', { name: 'Anfall' });
    seizureButton.focus();

    expect(seizureButton).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Anfall erfassen' })).toBeInTheDocument();
  });

  it('labels every form control on the capture screen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);
    await screen.findByRole('heading', { name: 'Mexx' });

    await user.click(screen.getByRole('button', { name: 'Mahlzeit' }));

    const heading = await screen.findByRole('heading', { name: 'Mahlzeit erfassen' });
    const form = heading.closest('main')!;
    const formScope = within(form);
    const controls = [
      ...formScope.queryAllByRole('textbox'),
      ...formScope.queryAllByRole('combobox'),
      ...formScope.queryAllByRole('spinbutton')
    ];

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control).toHaveAccessibleName();
    }
  });

  it('reaches the exports screen and labels its file inputs', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);
    await screen.findByRole('heading', { name: 'Mexx' });

    await user.click(screen.getByRole('button', { name: 'Daten' }));

    await screen.findByRole('heading', { name: 'Sichern und Uebertragen' });
    expect(screen.getByLabelText('Backup-Datei waehlen')).toBeInTheDocument();
    expect(screen.getByLabelText('Tagesexport-Datei waehlen')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag fuer Tagesexport')).toBeInTheDocument();
  });

  it('reaches the reports screen with the disclaimer visible', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);
    await screen.findByRole('heading', { name: 'Mexx' });

    await user.click(screen.getByRole('button', { name: 'Bericht' }));

    expect(await screen.findByRole('heading', { name: /Klinischer Bericht/i })).toBeInTheDocument();
    expect(screen.getByText(/Correlation only/i)).toBeInTheDocument();
  });
});

function emptyState(): AppState {
  return {
    ...appStateFixture,
    events: [],
    knownTerms: [],
    mealTemplates: [],
    phases: [],
    settings: {
      trackedDogName: 'Mexx'
    }
  };
}
