import { FormEvent, useMemo, useState } from 'react';
import { ISODate, Phase } from '../../domain/types';

type PhasesRepository = {
  savePhase: (phase: Phase) => Promise<void>;
};

type PhasesScreenProps = {
  phases: Phase[];
  repository: PhasesRepository;
  onBack: () => void;
  onChanged: () => void | Promise<void>;
  today?: ISODate;
  createId?: () => string;
};

export function PhasesScreen({
  phases,
  repository,
  onBack,
  onChanged,
  today = new Date().toISOString().slice(0, 10),
  createId = () => crypto.randomUUID()
}: PhasesScreenProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangeError, setDateRangeError] = useState('');
  const [saving, setSaving] = useState(false);
  const sortedPhases = useMemo(() => [...phases].sort(comparePhases), [phases]);
  const activePhases = sortedPhases.filter((phase) => phase.startDate <= today && (!phase.endDate || phase.endDate >= today));
  const futurePhases = sortedPhases.filter((phase) => phase.startDate > today);
  const pastPhases = sortedPhases.filter((phase) => phase.endDate && phase.endDate < today);
  const overlappingPhases = sortedPhases.filter((phase) => phasesOverlap({ startDate, endDate: endDate || undefined }, phase));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || !startDate) {
      return;
    }

    if (endDate && endDate < startDate) {
      setDateRangeError('Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }

    const phase: Phase = {
      id: createId(),
      name: trimmedName,
      startDate,
      ...(endDate ? { endDate } : {})
    };

    setSaving(true);
    await repository.savePhase(phase);
    await onChanged();
    setName('');
    setStartDate('');
    setEndDate('');
    setDateRangeError('');
    setSaving(false);
  }

  return (
    <main className="app-shell maintenance-shell">
      <section className="capture-header" aria-labelledby="phases-title">
        <button className="text-button" type="button" onClick={onBack}>
          Zurueck
        </button>
        <div>
          <p className="eyebrow">Pflege</p>
          <h1 id="phases-title">Phasen</h1>
        </div>
      </section>

      <form className="capture-form" noValidate onSubmit={(event) => void submit(event)}>
        <label className="form-field">
          <span>Name</span>
          <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="form-field">
          <span>Startdatum</span>
          <input
            aria-label="Startdatum"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setDateRangeError('');
            }}
          />
        </label>
        <label className="form-field">
          <span>Enddatum optional</span>
          <input
            aria-label="Enddatum optional"
            aria-describedby={dateRangeError ? 'phase-end-date-error' : undefined}
            type="date"
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setDateRangeError('');
            }}
          />
          {dateRangeError ? (
            <span className="field-error" id="phase-end-date-error" role="alert">
              {dateRangeError}
            </span>
          ) : null}
        </label>
        {overlappingPhases.length ? (
          <p className="form-hint">Ueberschneidet sich mit: {overlappingPhases.map((phase) => phase.name).join(', ')}</p>
        ) : null}
        <button className="primary-button" type="submit" disabled={saving}>
          Phase speichern
        </button>
      </form>

      <PhasePeriodSection title="Aktive Phasen" phases={activePhases} />
      <PhasePeriodSection title="Geplante Phasen" phases={futurePhases} />
      <PhasePeriodSection title="Vergangene Phasen" phases={pastPhases} />
    </main>
  );
}

function PhasePeriodSection({ title, phases }: { title: string; phases: Phase[] }) {
  return (
    <section className="maintenance-section" aria-label={title}>
      <h2>{title}</h2>
      {phases.length === 0 ? <p className="empty-day-text">Keine Phasen.</p> : null}
      <div className="maintenance-list">
        {phases.map((phase) => (
          <article className="maintenance-card" key={phase.id}>
            <h3>{phase.name}</h3>
            <p>{formatPhaseRange(phase)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function phasesOverlap(draft: Pick<Phase, 'startDate' | 'endDate'>, phase: Phase): boolean {
  if (!draft.startDate) {
    return false;
  }

  const draftEnd = draft.endDate ?? '9999-12-31';
  const phaseEnd = phase.endDate ?? '9999-12-31';

  return draft.startDate <= phaseEnd && phase.startDate <= draftEnd;
}

function comparePhases(left: Phase, right: Phase): number {
  return left.startDate.localeCompare(right.startDate) || left.name.localeCompare(right.name);
}

function formatPhaseRange(phase: Phase): string {
  return phase.endDate ? `${phase.startDate} bis ${phase.endDate}` : `Seit ${phase.startDate}`;
}
