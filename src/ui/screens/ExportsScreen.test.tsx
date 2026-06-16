// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture, backupExportFixture, dayExportFixture, seizureFixture } from '../../domain/fixtures';
import { createBackupExport, createDayExport } from '../../domain/importExport';
import { AppState, BackupStatus, SCHEMA_VERSION } from '../../domain/types';
import { ExportsScreen, defaultDownloadFile, downloadBlob } from './ExportsScreen';

afterEach(() => {
  cleanup();
});

function makeRepository() {
  return {
    replaceAppState: vi.fn().mockResolvedValue(undefined),
    saveBackupStatus: vi.fn().mockResolvedValue(undefined)
  };
}

function jsonFile(name: string, payload: unknown): File {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' });
}

describe('ExportsScreen', () => {
  it('exports a backup and updates the backup status', async () => {
    const user = userEvent.setup();
    const repository = makeRepository();
    const downloadFile = vi.fn();

    render(
      <ExportsScreen
        appState={appStateFixture}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
        downloadFile={downloadFile}
      />
    );

    await user.click(screen.getByRole('button', { name: /Backup teilen/i }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = downloadFile.mock.calls[0];
    expect(filename).toMatch(/^mexx-backup-.+\.json$/);
    expect(mime).toBe('application/json');
    expect(JSON.parse(content)).toMatchObject({ exportType: 'backup', schemaVersion: SCHEMA_VERSION });
    expect(repository.saveBackupStatus).toHaveBeenCalledWith({
      lastBackupTime: '2026-06-03T20:00:00.000Z'
    });
  });

  it('previews a backup import before confirming replacement', async () => {
    const user = userEvent.setup();
    const repository = makeRepository();

    render(
      <ExportsScreen
        appState={appStateFixture}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    const backupInput = screen.getByLabelText(/Backup-Datei waehlen/i);
    await user.upload(backupInput, jsonFile('backup.json', backupExportFixture));

    expect(await screen.findByText(/Vorschau/i)).toBeInTheDocument();
    expect(screen.getByText(/Backup-Import ersetzt alle/i)).toBeInTheDocument();
    expect(repository.replaceAppState).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Backup-Import bestaetigen/i }));

    expect(repository.replaceAppState).toHaveBeenCalledWith(backupExportFixture.state);
  });

  it('rejects an export with an unsupported schema version', async () => {
    const user = userEvent.setup();
    const repository = makeRepository();

    render(
      <ExportsScreen
        appState={appStateFixture}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    const backupInput = screen.getByLabelText(/Backup-Datei waehlen/i);
    await user.upload(
      backupInput,
      jsonFile('backup.json', { ...backupExportFixture, schemaVersion: 99 })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported schema version/i);
    expect(repository.replaceAppState).not.toHaveBeenCalled();
  });

  it('exports a single day for the selected date', async () => {
    const user = userEvent.setup();
    const repository = makeRepository();
    const downloadFile = vi.fn();

    render(
      <ExportsScreen
        appState={appStateFixture}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
        downloadFile={downloadFile}
      />
    );

    await user.type(screen.getByLabelText(/Tag fuer Tagesexport/i), '2026-06-03');
    await user.click(screen.getByRole('button', { name: /Tag teilen/i }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, content] = downloadFile.mock.calls[0];
    expect(filename).toBe('mexx-day-2026-06-03.json');
    const payload = JSON.parse(content);
    expect(payload).toMatchObject({ exportType: 'day', date: '2026-06-03' });
    expect(payload.events.map((event: { id: string }) => event.id)).toEqual(
      expect.arrayContaining([seizureFixture.id])
    );
  });

  it('shows a backup recommendation when importing a day export', async () => {
    const localState: AppState = {
      ...appStateFixture,
      settings: {
        trackedDogName: 'Mexx',
        backupStatus: undefined
      }
    };
    const user = userEvent.setup();
    const repository = makeRepository();

    render(
      <ExportsScreen
        appState={localState}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    const dayInput = screen.getByLabelText(/Tagesexport-Datei waehlen/i);
    await user.upload(dayInput, jsonFile('day.json', dayExportFixture));

    expect(await screen.findByText(/Vor dem Tagesimport empfohlen/i)).toBeInTheDocument();
  });

  it('merges a day import and reports added, updated, and deleted counts', async () => {
    const localState: AppState = {
      schemaVersion: SCHEMA_VERSION,
      events: [seizureFixture],
      knownTerms: [],
      phases: [],
      settings: {
        trackedDogName: 'Mexx',
        backupStatus: { lastBackupTime: '2026-06-03T19:59:00.000Z' } as BackupStatus
      }
    };
    const dayExport = createDayExport(
      {
        ...localState,
        events: [
          {
            ...seizureFixture,
            note: 'Updated note from secondary device.',
            changeTime: '2026-06-03T08:30:00.000Z'
          },
          {
            ...seizureFixture,
            id: 'event-seizure-new',
            note: 'New seizure',
            changeTime: '2026-06-03T09:00:00.000Z',
            eventTime: '2026-06-03T08:45:00.000Z'
          }
        ]
      },
      '2026-06-03',
      '2026-06-03T20:00:00.000Z'
    );
    const user = userEvent.setup();
    const repository = makeRepository();
    const onChanged = vi.fn();

    render(
      <ExportsScreen
        appState={localState}
        repository={repository}
        onBack={vi.fn()}
        onChanged={onChanged}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    await user.upload(screen.getByLabelText(/Tagesexport-Datei waehlen/i), jsonFile('day.json', dayExport));
    await user.click(screen.getByRole('button', { name: /Tag importieren/i }));

    await waitFor(() => {
      expect(repository.replaceAppState).toHaveBeenCalled();
    });
    expect(screen.getByText(/Neu: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Aktualisiert: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Geloescht: 0/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows the current backup status hint', () => {
    const repository = makeRepository();

    render(
      <ExportsScreen
        appState={{
          ...appStateFixture,
          settings: {
            trackedDogName: 'Mexx',
            backupStatus: { lastBackupTime: '2026-06-02T10:00:00.000Z' }
          }
        }}
        repository={repository}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        now={() => new Date('2026-06-03T20:00:00.000Z')}
      />
    );

    expect(screen.getByText(/Letztes Backup/i)).toBeInTheDocument();
  });
});

// Smoke check the helper used by tests above to make sure it stays in sync with the domain function.
describe('createBackupExport (used by ExportsScreen)', () => {
  it('produces a valid backup payload', () => {
    const backup = createBackupExport(appStateFixture, '2026-06-03T20:00:00.000Z');

    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.exportType).toBe('backup');
  });
});

describe('defaultDownloadFile (iOS Web Share + fallback)', () => {
  it('calls navigator.share when canShare returns true', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    const canShareFn = vi.fn().mockReturnValue(true);

    Object.defineProperty(window.navigator, 'canShare', { value: canShareFn, configurable: true });
    Object.defineProperty(window.navigator, 'share', { value: shareFn, configurable: true });

    await defaultDownloadFile('test.json', '{}', 'application/json');

    expect(canShareFn).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    expect(shareFn).toHaveBeenCalled();
  });

  it('[iOS PWA fix] throws error when canShare fails and clipboard unavailable', async () => {
    const canShareFn = vi.fn().mockReturnValue(false);
    Object.defineProperty(window.navigator, 'canShare', { value: canShareFn, configurable: true });
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    delete (window.navigator as any).clipboard;

    await expect(defaultDownloadFile('test.json', '{}', 'application/json')).rejects.toThrow();
  });

  it('[iOS PWA fix] copies to clipboard when canShare fails on iOS PWA', async () => {
    const canShareFn = vi.fn().mockReturnValue(false);
    const writeTextFn = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, 'canShare', { value: canShareFn, configurable: true });
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    Object.defineProperty(window.navigator, 'clipboard',
      { value: { writeText: writeTextFn }, configurable: true });

    await expect(
      defaultDownloadFile('test.json', '{}', 'application/json')
    ).rejects.toThrow(/Zwischenablage kopiert/);

    expect(writeTextFn).toHaveBeenCalledWith('{}');
  });

  it('falls back to downloadBlob on non-iOS when canShare fails', async () => {
    const canShareFn = vi.fn().mockReturnValue(false);
    const linkClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    Object.defineProperty(window.navigator, 'canShare', { value: canShareFn, configurable: true });
    delete (window.navigator as any).standalone;

    await defaultDownloadFile('test.json', '{}', 'application/json');

    expect(linkClickSpy).toHaveBeenCalled();
  });
});
