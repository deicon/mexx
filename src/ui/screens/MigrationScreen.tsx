import { useState } from 'react';
import { TrackerRepository } from '../../storage/repository';
import { defaultDownloadFile } from './ExportsScreen';

type MigrationScreenProps = {
  repository: TrackerRepository;
  onDone: () => void;
};

type MigrationState = 'idle' | 'exporting' | 'migrating' | 'error';

export function MigrationScreen({ repository, onDone }: MigrationScreenProps) {
  const [state, setState] = useState<MigrationState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleExportAndMigrate() {
    setState('exporting');
    setErrorMessage('');

    try {
      const raw = await repository.exportRawState();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `mexx-raw-backup-${timestamp}.json`;
      await Promise.resolve(defaultDownloadFile(filename, JSON.stringify(raw, null, 2), 'application/json'));
    } catch (error) {
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Export fehlgeschlagen. Bitte versuchen Sie es erneut.'
      );
      return;
    }

    setState('migrating');

    try {
      await repository.runMigration();
      onDone();
    } catch (error) {
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Migration fehlgeschlagen. Bitte versuchen Sie es erneut.'
      );
    }
  }

  const isWorking = state === 'exporting' || state === 'migrating';

  return (
    <main className="app-shell app-shell--centered">
      <section className="capture-header" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <p className="eyebrow">Datenbank</p>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Migration erforderlich</h1>
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary, #666)' }}>
          Ihre gespeicherten Daten enthalten veraltete Einträge (z.B. alte Ereignistypen oder
          Schlagwort-Kategorien), die nicht mehr unterstützt werden.
        </p>
        <p style={{ marginBottom: '2rem', color: 'var(--color-text-secondary, #666)' }}>
          Beim Klicken auf den Button werden zuerst <strong>alle Ihre Daten als Sicherung exportiert</strong>,
          danach werden veraltete Einträge entfernt.
        </p>

        {state === 'exporting' && (
          <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Daten werden exportiert…</p>
        )}
        {state === 'migrating' && (
          <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Migration läuft…</p>
        )}
        {state === 'error' && (
          <p role="alert" className="field-error" style={{ marginBottom: '1rem' }}>
            {errorMessage}
          </p>
        )}

        <button
          className="primary-button"
          type="button"
          onClick={() => void handleExportAndMigrate()}
          disabled={isWorking}
        >
          {isWorking ? 'Bitte warten…' : 'Daten sichern und migrieren'}
        </button>
      </section>
    </main>
  );
}
