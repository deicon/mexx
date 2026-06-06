import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  buildClinicalReport,
  buildCsvPackage,
  ClinicalReport,
  CorrelationWindowKey,
  ReportPeriod,
  ReportPeriodKey,
  resolveReportPeriod,
  serializeCsvFile
} from '../../domain/reporting';
import { AppState, EventType, ISODate, SeizureSeverity, TrackerEvent } from '../../domain/types';
import { BottomNav } from '../components/BottomNav';

type ReportsScreenProps = {
  appState: AppState;
  onBack: () => void;
  today?: ISODate;
  now?: () => Date;
  downloadFile?: (filename: string, content: string, mimeType: string) => void;
  print?: () => void;
  onCapture?: (type: EventType) => void;
};

const PERIOD_LABELS: Record<ReportPeriodKey, string> = {
  'last-7': 'Letzte 7 Tage',
  'last-30': 'Letzte 30 Tage',
  'last-90': 'Letzte 90 Tage',
  custom: 'Eigener Zeitraum'
};

const WINDOW_LABELS: Record<CorrelationWindowKey, string> = {
  '0-6h': '0 bis 6 Stunden davor',
  '6-24h': '6 bis 24 Stunden davor',
  '24-72h': '24 bis 72 Stunden davor'
};

export function ReportsScreen({
  appState,
  onBack,
  today = new Date().toISOString().slice(0, 10),
  now = () => new Date(),
  downloadFile = defaultDownloadFile,
  print = defaultPrint,
  onCapture
}: ReportsScreenProps) {
  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>('last-7');
  const [customFrom, setCustomFrom] = useState<ISODate>('');
  const [customTo, setCustomTo] = useState<ISODate>('');

  const period = useMemo<ReportPeriod | null>(() => {
    try {
      if (periodKey === 'custom') {
        if (!customFrom || !customTo) {
          return null;
        }

        return resolveReportPeriod({ key: 'custom', today, from: customFrom, to: customTo });
      }

      return resolveReportPeriod({ key: periodKey, today });
    } catch {
      return null;
    }
  }, [periodKey, customFrom, customTo, today]);

  const report = useMemo<ClinicalReport | null>(() => {
    if (!period) {
      return null;
    }

    return buildClinicalReport(appState, {
      period,
      generatedAt: now().toISOString()
    });
  }, [appState, period, now]);

  function handleDownloadCsv() {
    if (!period) {
      return;
    }

    const csvPackage = buildCsvPackage(appState, period);

    for (const file of csvPackage.files) {
      downloadFile(file.name, serializeCsvFile(file), 'text/csv;charset=utf-8');
    }
  }

  return (
    <>
      <main className="app-shell reports-shell app-shell--has-bottom-nav">
      <section className="capture-header" aria-labelledby="reports-title">
        <button className="text-button" type="button" onClick={onBack}>
          Zurueck
        </button>
        <div>
          <p className="eyebrow">Bericht</p>
          <h1 id="reports-title">Klinischer Bericht</h1>
        </div>
      </section>

      <fieldset className="form-fieldset" aria-label="Berichtszeitraum">
        <legend>Zeitraum</legend>
        <div className="report-period-options" role="radiogroup" aria-label="Berichtszeitraum">
          {(Object.keys(PERIOD_LABELS) as ReportPeriodKey[]).map((key) => (
            <label className="report-period-option" key={key}>
              <input
                type="radio"
                name="report-period"
                value={key}
                checked={periodKey === key}
                onChange={() => setPeriodKey(key)}
              />
              <span>{PERIOD_LABELS[key]}</span>
            </label>
          ))}
        </div>
        {periodKey === 'custom' ? (
          <div className="inline-fields inline-fields--even">
            <label>
              <span>Von</span>
              <input
                aria-label="Von"
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </label>
            <label>
              <span>Bis</span>
              <input
                aria-label="Bis"
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      {report && period ? (
        <>
          <p className="report-period-summary">
            Zeitraum: {period.from} bis {period.to}
          </p>

          <section className="report-section" aria-labelledby="report-summary-title">
            <h2 id="report-summary-title">Zusammenfassung</h2>
            <ReportTotals report={report} />
          </section>

          <section className="report-section" aria-labelledby="report-day-states-title">
            <h2 id="report-day-states-title">Tagesfarben</h2>
            <ul className="report-day-list">
              {report.dayStates.map((dayState) => (
                <li key={dayState.date} className={`report-day report-day--${dayState.colorScore}`}>
                  <span>{dayState.date}</span>
                  <span>Anfaelle: {dayState.seizureCounts.total}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="report-section" aria-labelledby="report-correlations-title">
            <h2 id="report-correlations-title">Korrelationen</h2>
            <p className="report-disclaimer">{report.correlationDisclaimer}</p>
            {report.correlations.length === 0 ? (
              <p className="empty-day-text">Keine Anfaelle im Zeitraum.</p>
            ) : (
              report.correlations.map((entry) => (
                <article key={entry.seizureId} className="report-correlation">
                  <h3>Anfall am {format(parseISO(entry.seizureTime), 'dd.MM.yyyy HH:mm')}</h3>
                  {(Object.keys(WINDOW_LABELS) as CorrelationWindowKey[]).map((windowKey) => (
                    <div key={windowKey} className="report-correlation__window">
                      <h4>{WINDOW_LABELS[windowKey]}</h4>
                      {entry.precedingByWindow[windowKey].length === 0 ? (
                        <p className="empty-day-text">Keine Eintraege.</p>
                      ) : (
                        <ul>
                          {entry.precedingByWindow[windowKey].map((item) => (
                            <li key={`${item.event.id}-${windowKey}`}>
                              {formatHoursBefore(item.hoursBefore)} - {describeEventBrief(item.event)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </article>
              ))
            )}
          </section>

          <section className="report-section" aria-labelledby="report-phases-title">
            <h2 id="report-phases-title">Phasen</h2>
            {report.phases.length === 0 ? (
              <p className="empty-day-text">Keine Phasen im Zeitraum.</p>
            ) : (
              <ul className="report-phase-list">
                {report.phases.map((phase) => (
                  <li key={phase.id}>
                    {phase.name} - {phase.startDate} bis {phase.endDate ?? 'offen'}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="report-actions">
            <button className="secondary-button" type="button" onClick={handleDownloadCsv}>
              CSV-Paket herunterladen
            </button>
            <button className="primary-button" type="button" onClick={() => print()}>
              Bericht drucken
            </button>
          </div>
        </>
      ) : (
        <p className="form-hint">Bitte Zeitraum waehlen.</p>
      )}
      </main>

      <BottomNav
        active="reports"
        onDashboard={onBack}
        onReports={() => undefined}
        onCapture={(type) => onCapture?.(type)}
      />
    </>
  );
}

function ReportTotals({ report }: { report: ClinicalReport }) {
  const items: Array<[string, number]> = [
    ['Anfaelle', report.totals.seizures],
    ['Therapiehund', report.totals.therapyDogs],
    ['Beobachtungen', report.totals.observations]
  ];

  return (
    <div className="report-totals">
      {items.map(([label, value]) => (
        <div className="status-metric" key={label}>
          <span>{value}</span>
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}

function formatHoursBefore(hours: number): string {
  if (hours < 1) {
    return 'unter 1 Std davor';
  }

  return `${hours} Std davor`;
}

function describeEventBrief(event: TrackerEvent): string {
  switch (event.type) {
    case 'seizure':
      return `Anfall (${seizureSeverityLabel(event.severity)})`;
    case 'observation':
      return `Beobachtung${event.observationTags.length ? ` (${event.observationTags.join(', ')})` : ''}`;
    case 'therapy_dog':
      return `Therapiehund (${therapyDogIntensityLabel(event.intensity)})${event.durationMinutes ? ` ${event.durationMinutes}min` : ''}`;
  }
}

function seizureSeverityLabel(severity: SeizureSeverity): string {
  return { light: 'leicht', medium: 'mittel', severe: 'schwer' }[severity];
}

function therapyDogIntensityLabel(intensity: 'light' | 'medium' | 'heavy'): string {
  return { light: 'leicht', medium: 'mittel', heavy: 'schwer' }[intensity];
}

function defaultDownloadFile(filename: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function defaultPrint(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
