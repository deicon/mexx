import { ChangeEvent, useState } from 'react';
import {
  applyBackupImport,
  applyDayImport,
  createBackupExport,
  createDayExport,
  parseBackupExport,
  parseDayExport
} from '../../domain/importExport';
import {
  AppState,
  BackupExportPayload,
  BackupStatus,
  DayExportPayload,
  ISODate,
  TrackerEvent
} from '../../domain/types';

type ExportsRepository = {
  replaceAppState: (state: AppState) => Promise<void>;
  saveBackupStatus: (status: BackupStatus) => Promise<void>;
};

type ExportsScreenProps = {
  appState: AppState;
  repository: ExportsRepository;
  onBack: () => void;
  onChanged: () => void | Promise<void>;
  now?: () => Date;
  downloadFile?: (filename: string, content: string, mimeType: string) => void | Promise<void>;
};

type BackupPreview = {
  payload: BackupExportPayload;
  eventCount: number;
};

type DayPreview = {
  payload: DayExportPayload;
};

type DayImportSummary = {
  added: number;
  updated: number;
  deleted: number;
};

type BackupImportSummary = {
  events: number;
  phases: number;
};

export function ExportsScreen({
  appState,
  repository,
  onBack,
  onChanged,
  now = () => new Date(),
  downloadFile = defaultDownloadFile
}: ExportsScreenProps) {
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [dayPreview, setDayPreview] = useState<DayPreview | null>(null);
  const [backupError, setBackupError] = useState<string>('');
  const [dayError, setDayError] = useState<string>('');
  const [backupExportError, setBackupExportError] = useState<string>('');
  const [dayExportError, setDayExportError] = useState<string>('');
  const [dayImportSummary, setDayImportSummary] = useState<DayImportSummary | null>(null);
  const [backupImportSummary, setBackupImportSummary] = useState<BackupImportSummary | null>(null);
  const [dayExportDate, setDayExportDate] = useState<ISODate>('');
  const [working, setWorking] = useState(false);

  async function handleBackupExport() {
    setWorking(true);
    setBackupExportError('');
    try {
      const exportedAt = now().toISOString();
      const backup = createBackupExport(appState, exportedAt);
      const filename = `mexx-backup-${exportedAt.slice(0, 19).replace(/[:.]/g, '-')}.json`;
      await Promise.resolve(downloadFile(filename, JSON.stringify(backup, null, 2), 'application/json'));
      await repository.saveBackupStatus({ lastBackupTime: exportedAt });
      await onChanged();
    } catch (error) {
      setBackupExportError(error instanceof Error ? error.message : 'Backup konnte nicht exportiert werden.');
    } finally {
      setWorking(false);
    }
  }

  async function handleBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackupError('');
    setBackupPreview(null);
    setBackupImportSummary(null);

    if (!file) {
      return;
    }

    try {
      const payload = parseBackupExport(JSON.parse(await file.text()));
      const activeEvents = payload.state.events.filter((candidate) => candidate.deleted !== true);
      setBackupPreview({ payload, eventCount: activeEvents.length });
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Backup-Datei konnte nicht gelesen werden.');
    } finally {
      event.target.value = '';
    }
  }

  async function confirmBackupImport() {
    if (!backupPreview) {
      return;
    }

    setWorking(true);
    try {
      const newState = applyBackupImport(appState, backupPreview.payload);
      await repository.replaceAppState(newState);
      await onChanged();
      setBackupImportSummary({
        events: newState.events.filter((event) => event.deleted !== true).length,
        phases: newState.phases.length
      });
      setBackupPreview(null);
    } finally {
      setWorking(false);
    }
  }

  async function handleDayExport() {
    if (!dayExportDate) {
      return;
    }

    setWorking(true);
    setDayExportError('');
    try {
      const exportedAt = now().toISOString();
      const payload = createDayExport(appState, dayExportDate, exportedAt);
      const filename = `mexx-day-${dayExportDate}.json`;
      await Promise.resolve(downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json'));
    } catch (error) {
      setDayExportError(error instanceof Error ? error.message : 'Tagesexport konnte nicht exportiert werden.');
    } finally {
      setWorking(false);
    }
  }

  async function handleDayFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDayError('');
    setDayPreview(null);
    setDayImportSummary(null);

    if (!file) {
      return;
    }

    try {
      const payload = parseDayExport(JSON.parse(await file.text()));
      setDayPreview({ payload });
    } catch (error) {
      setDayError(error instanceof Error ? error.message : 'Tagesexport konnte nicht gelesen werden.');
    } finally {
      event.target.value = '';
    }
  }

  async function confirmDayImport() {
    if (!dayPreview) {
      return;
    }

    setWorking(true);
    try {
      const newState = applyDayImport(appState, dayPreview.payload);
      const summary = summarizeDayImport(appState.events, dayPreview.payload.events, newState.events);
      await repository.replaceAppState(newState);
      await onChanged();
      setDayImportSummary(summary);
      setDayPreview(null);
    } finally {
      setWorking(false);
    }
  }

  const backupRecommendationNeeded = dayPreview ? backupIsStale(appState.settings.backupStatus, now()) : false;

  return (
    <main className="app-shell exports-shell">
      <section className="capture-header" aria-labelledby="exports-title">
        <button className="text-button" type="button" onClick={onBack}>
          Zurueck
        </button>
        <div>
          <p className="eyebrow">Daten</p>
          <h1 id="exports-title">Sichern und Uebertragen</h1>
        </div>
      </section>

      <section className="report-section" aria-labelledby="backup-status-title">
        <h2 id="backup-status-title">Backup-Status</h2>
        <p className="backup-hint">{backupStatusText(appState.settings.backupStatus)}</p>
      </section>

      <section className="report-section" aria-labelledby="backup-export-title">
        <h2 id="backup-export-title">Backup-Export</h2>
        <p className="form-hint">Oeffnet das Teilen-Menue mit der JSON-Datei.</p>
        <button className="primary-button" type="button" onClick={() => void handleBackupExport()} disabled={working}>
          Backup teilen
        </button>
        {backupExportError ? (
          <p role="alert" className="field-error">
            {backupExportError}
          </p>
        ) : null}
      </section>

      <section className="report-section" aria-labelledby="backup-import-title">
        <h2 id="backup-import-title">Backup-Import</h2>
        <p className="form-hint">Backup-Import ersetzt alle Daten auf diesem Geraet.</p>
        <label className="form-field">
          <span>Backup-Datei waehlen</span>
          <input
            aria-label="Backup-Datei waehlen"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleBackupFile(event)}
          />
        </label>
        {backupError ? (
          <p role="alert" className="field-error">
            {backupError}
          </p>
        ) : null}
        {backupPreview ? (
          <article className="import-preview" aria-label="Vorschau Backup-Import">
            <h3>Vorschau</h3>
            <p>
              Ereignisse: {backupPreview.eventCount}, Phasen: {backupPreview.payload.state.phases.length}
            </p>
            <p>Exportiert am {formatDateTime(backupPreview.payload.exportedAt)}</p>
            <button
              className="danger-button"
              type="button"
              onClick={() => void confirmBackupImport()}
              disabled={working}
            >
              Backup-Import bestaetigen
            </button>
          </article>
        ) : null}
        {backupImportSummary ? (
          <p className="import-success" role="status" aria-live="polite">
            Backup importiert: {backupImportSummary.events} Ereignisse,{' '}
            {backupImportSummary.phases} Phasen.
          </p>
        ) : null}
      </section>

      <section className="report-section" aria-labelledby="day-export-title">
        <h2 id="day-export-title">Tagesexport</h2>
        <label className="form-field">
          <span>Tag fuer Tagesexport</span>
          <input
            aria-label="Tag fuer Tagesexport"
            type="date"
            value={dayExportDate}
            onChange={(event) => setDayExportDate(event.target.value)}
          />
        </label>
        <button
          className="primary-button"
          type="button"
          onClick={() => void handleDayExport()}
          disabled={working || !dayExportDate}
        >
          Tag teilen
        </button>
        {dayExportError ? (
          <p role="alert" className="field-error">
            {dayExportError}
          </p>
        ) : null}
      </section>

      <section className="report-section" aria-labelledby="day-import-title">
        <h2 id="day-import-title">Tagesimport</h2>
        <p className="form-hint">Fuegt Ereignisse zusammen ohne vorhandene zu loeschen.</p>
        <label className="form-field">
          <span>Tagesexport-Datei waehlen</span>
          <input
            aria-label="Tagesexport-Datei waehlen"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleDayFile(event)}
          />
        </label>
        {dayError ? (
          <p role="alert" className="field-error">
            {dayError}
          </p>
        ) : null}
        {backupRecommendationNeeded ? (
          <p className="form-hint">Vor dem Tagesimport empfohlen: Backup exportieren.</p>
        ) : null}
        {dayPreview ? (
          <article className="import-preview" aria-label="Vorschau Tagesimport">
            <h3>Vorschau</h3>
            <p>
              Tag: {dayPreview.payload.date}, Ereignisse: {dayPreview.payload.events.length}
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => void confirmDayImport()}
              disabled={working}
            >
              Tag importieren
            </button>
          </article>
        ) : null}
        {dayImportSummary ? (
          <p className="form-hint" aria-live="polite">
            Neu: {dayImportSummary.added}, Aktualisiert: {dayImportSummary.updated}, Geloescht: {dayImportSummary.deleted}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function summarizeDayImport(
  localEvents: TrackerEvent[],
  importedEvents: TrackerEvent[],
  mergedEvents: TrackerEvent[]
): DayImportSummary {
  const localById = new Map(localEvents.map((event) => [event.id, event]));
  const mergedById = new Map(mergedEvents.map((event) => [event.id, event]));
  let added = 0;
  let updated = 0;
  let deleted = 0;

  for (const imported of importedEvents) {
    const local = localById.get(imported.id);
    const merged = mergedById.get(imported.id);

    if (!local) {
      added += 1;
      if (imported.deleted === true) {
        deleted += 1;
      }
      continue;
    }

    if (merged && merged.changeTime !== local.changeTime) {
      updated += 1;

      if (merged.deleted === true && local.deleted !== true) {
        deleted += 1;
      }
    }
  }

  return { added, updated, deleted };
}

function backupStatusText(status: BackupStatus | undefined): string {
  if (!status?.lastBackupTime) {
    return 'Noch kein Backup auf diesem Geraet.';
  }

  return `Letztes Backup: ${formatDateTime(status.lastBackupTime)}`;
}

function backupIsStale(status: BackupStatus | undefined, now: Date): boolean {
  if (!status?.lastBackupTime) {
    return true;
  }

  const lastInstant = Date.parse(status.lastBackupTime);

  if (Number.isNaN(lastInstant)) {
    return true;
  }

  const hoursSinceBackup = (now.getTime() - lastInstant) / (60 * 60 * 1000);

  return hoursSinceBackup > 24;
}

function formatDateTime(isoTime: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoTime));
}

export async function defaultDownloadFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const file = new File([content], filename, { type: mimeType });
  const shareData = { files: [file], title: filename } satisfies ShareData;
  const shareNavigator = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  const isIosPWA = typeof (navigator as any).standalone === 'boolean' && (navigator as any).standalone === true;

  if (shareNavigator.canShare?.(shareData) && shareNavigator.share) {
    try {
      await shareNavigator.share(shareData);
      return;
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        return;
      }
      if (isIosPWA) {
        return copyToClipboard(content, filename);
      }
      downloadBlob(file, filename);
    }
  }

  if (isIosPWA) {
    return copyToClipboard(content, filename);
  }

  downloadBlob(file, filename);
}

async function copyToClipboard(content: string, filename: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error(
      'Backup-Teilen ist auf diesem Gerät nicht verfügbar. ' +
      'Bitte verwenden Sie ein aktuelles iOS (13.2+) oder versuchen Sie einen anderen Browser.'
    );
  }

  try {
    await navigator.clipboard.writeText(content);
    throw new Error(
      `Backup wurde in die Zwischenablage kopiert (${filename}). ` +
      'Öffnen Sie eine andere App und fügen Sie es ein, um es zu speichern (z.B. Mail, Notes, Files).'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Zwischenablage kopiert')) {
      throw error;
    }
    throw new Error(
      'Backup konnte nicht in die Zwischenablage kopiert werden. ' +
      'Bitte versuchen Sie es später.'
    );
  }
}

export function downloadBlob(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
