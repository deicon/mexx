// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture } from './domain/fixtures';
import { AppState, TrackerEvent } from './domain/types';
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
  repositoryMock.loadAppState.mockReset();
  repositoryMock.upsertEvent.mockReset();
  repositoryMock.saveKnownTerm.mockReset();
  repositoryMock.upsertEvent.mockResolvedValue(undefined);
  repositoryMock.saveKnownTerm.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('App capture flow', () => {
  it('opens observation capture from the secondary dashboard action', async () => {
    const user = userEvent.setup();
    repositoryMock.loadAppState.mockResolvedValueOnce(emptyState());

    render(<App />);

    await screen.findByRole('heading', { name: 'Mexx' });
    await user.click(screen.getByRole('button', { name: /Erfassen oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Beobachtung' }));

    expect(screen.getByRole('heading', { name: 'Beobachtung erfassen' })).toBeInTheDocument();
  });

  it('keeps capture mode visible until saved events are reloaded for the dashboard', async () => {
    const user = userEvent.setup();
    const reloadedState = deferred<AppState>();
    repositoryMock.loadAppState
      .mockResolvedValueOnce(emptyState())
      .mockReturnValueOnce(reloadedState.promise);

    render(<App />);

    await screen.findByRole('heading', { name: 'Mexx' });
    await user.click(screen.getByRole('button', { name: /Erfassen oeffnen/i }));
    await user.click(screen.getByRole('button', { name: 'Anfall' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(repositoryMock.upsertEvent).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Anfall erfassen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mexx' })).not.toBeInTheDocument();

    reloadedState.resolve(
      emptyState([
        {
          id: 'saved-seizure',
          type: 'seizure',
          eventTime: '2026-06-03T08:05:00.000Z',
          captureTime: '2026-06-03T08:05:00.000Z',
          changeTime: '2026-06-03T08:05:00.000Z',
          severity: 'medium',
          durationClass: 'unknown',
          triggerTags: []
        }
      ])
    );

    await screen.findByRole('heading', { name: 'Mexx' });
    const summary = screen.getByRole('region', { name: 'Tagesuebersicht' });
    const anfaelle = within(summary).getByText('Anfaelle').parentElement!;
    expect(within(anfaelle).getByText('1')).toBeInTheDocument();
  });
});

function emptyState(events: TrackerEvent[] = []): AppState {
  return {
    ...appStateFixture,
    events,
    knownTerms: [],
    mealTemplates: [],
    phases: [],
    settings: {
      trackedDogName: 'Mexx'
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}
