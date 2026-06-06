import { FormEvent, useMemo, useState } from 'react';
import { learnKnownTerm } from '../../domain/knownTerms';
import {
  AppState,
  EventType,
  KnownTerm,
  KnownTermKind,
  ObservationEvent,
  SeizureDurationClass,
  SeizureEvent,
  SeizureSeverity,
  TherapyDogEvent,
  TherapyDogIntensity,
  TrackerEvent
} from '../../domain/types';
import { EventTimeField, NoteField, TermPills } from '../components/EventFormFields';

type CaptureRepository = {
  upsertEvent: (event: TrackerEvent) => Promise<void>;
  saveKnownTerm: (knownTerm: KnownTerm) => Promise<void>;
};

type CaptureScreensProps = {
  type: EventType;
  appState: AppState;
  repository: CaptureRepository;
  eventToEdit?: TrackerEvent;
  defaultDate?: string;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
  now?: () => Date;
  createId?: () => string;
};

const typeLabels: Record<EventType, string> = {
  seizure: 'Anfall erfassen',
  observation: 'Beobachtung erfassen',
  therapy_dog: 'Therapiehund-Termin erfassen'
};

const editTypeLabels: Record<EventType, string> = {
  seizure: 'Anfall bearbeiten',
  observation: 'Beobachtung bearbeiten',
  therapy_dog: 'Therapiehund-Termin bearbeiten'
};

export function CaptureScreens({
  type,
  appState,
  repository,
  eventToEdit,
  defaultDate,
  onDone,
  onCancel,
  now = () => new Date(),
  createId = () => crypto.randomUUID()
}: CaptureScreensProps) {
  const initialEventTime = useMemo(
    () => eventToEdit?.eventTime ?? defaultEventTimeFor(defaultDate, now),
    [eventToEdit, defaultDate, now]
  );
  const [eventTime, setEventTime] = useState(toDateTimeLocalValue(new Date(initialEventTime)));
  const [eventTimeError, setEventTimeError] = useState('');
  const [note, setNote] = useState(eventToEdit && 'note' in eventToEdit ? eventToEdit.note ?? '' : '');
  const [saving, setSaving] = useState(false);

  async function saveEvent(event: TrackerEvent, terms: Array<{ kind: KnownTermKind; value: string }>) {
    setSaving(true);
    await repository.upsertEvent(event);

    await Promise.all(
      terms.map(({ kind, value }) =>
        repository.saveKnownTerm(learnKnownTerm(appState.knownTerms, kind, value, event.eventTime, createId))
      )
    );

    await onDone();
  }

  function updateEventTime(value: string) {
    setEventTime(value);
    setEventTimeError('');
  }

  function readEventTimeIso() {
    const iso = localDateTimeToIso(eventTime);

    if (!iso) {
      setEventTimeError('Bitte einen gueltigen Zeitpunkt eingeben.');
      return null;
    }

    return iso;
  }

  const common = {
    appState,
    createId,
    eventToEdit,
    eventTime,
    eventTimeError,
    getEventTimeIso: readEventTimeIso,
    note,
    now,
    onCancel,
    onEventTimeChange: updateEventTime,
    onNoteChange: setNote,
    onSave: saveEvent,
    saving
  };

  return (
    <main className="app-shell capture-shell">
      <section className="capture-header" aria-labelledby="capture-title">
        <button className="text-button" type="button" onClick={onCancel}>
          Zurueck
        </button>
        <h1 id="capture-title">{eventToEdit ? editTypeLabels[type] : typeLabels[type]}</h1>
      </section>

      {type === 'seizure' ? <SeizureForm {...common} /> : null}
      {type === 'observation' ? <ObservationForm {...common} /> : null}
      {type === 'therapy_dog' ? <TherapyDogForm {...common} /> : null}
    </main>
  );
}

type FormProps = {
  appState: AppState;
  createId: () => string;
  eventToEdit?: TrackerEvent;
  eventTime: string;
  eventTimeError: string;
  getEventTimeIso: () => string | null;
  note: string;
  now: () => Date;
  onCancel: () => void;
  onEventTimeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: (event: TrackerEvent, terms: Array<{ kind: KnownTermKind; value: string }>) => Promise<void>;
  saving: boolean;
};

function SeizureForm({
  appState,
  createId,
  eventToEdit,
  eventTime,
  eventTimeError,
  getEventTimeIso,
  note,
  now,
  onEventTimeChange,
  onNoteChange,
  onSave,
  saving
}: FormProps) {
  const editEvent = eventToEdit?.type === 'seizure' ? eventToEdit : undefined;
  const [severity, setSeverity] = useState<SeizureSeverity>(editEvent?.severity ?? 'medium');
  const [durationClass, setDurationClass] = useState<SeizureDurationClass>(editEvent?.durationClass ?? 'under-1-min');
  const [exactDuration, setExactDuration] = useState(editEvent?.exactDuration ? String(editEvent.exactDuration.value) : '');
  const [triggers, setTriggers] = useState<string[]>(editEvent?.triggerTags ?? []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const changeTime = now().toISOString();
    const exactDurationValue = parseOptionalPositiveNumber(exactDuration);
    const seizure: SeizureEvent = {
      id: editEvent?.id ?? createId(),
      type: 'seizure',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      severity,
      durationClass,
      ...(exactDurationValue !== undefined
        ? { exactDuration: { value: exactDurationValue, unit: 'seconds' } }
        : {}),
      triggerTags: triggers,
      ...optionalNote(note)
    };

    void onSave(seizure, triggers.map((value) => ({ kind: 'trigger-tag', value })));
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <SelectField label="Schwere" value={severity} onChange={(value) => setSeverity(value as SeizureSeverity)}>
        <option value="light">leicht</option>
        <option value="medium">mittel</option>
        <option value="severe">schwer</option>
      </SelectField>
      <SelectField label="Dauerklasse" value={durationClass} onChange={(value) => setDurationClass(value as SeizureDurationClass)}>
        <option value="under-1-min">unter 1 Minute</option>
        <option value="1-3-min">1 bis 3 Minuten</option>
        <option value="3-5-min">3 bis 5 Minuten</option>
        <option value="over-5-min">ueber 5 Minuten</option>
        <option value="unknown">unbekannt</option>
      </SelectField>
      <label className="form-field">
        <span>Exakte Dauer in Sekunden</span>
        <input
          aria-label="Exakte Dauer in Sekunden"
          type="number"
          min="0"
          inputMode="numeric"
          value={exactDuration}
          onChange={(event) => setExactDuration(event.target.value)}
        />
      </label>
      <TermPills
        label="Ausloeser"
        terms={knownValues(appState, 'trigger-tag')}
        selected={triggers}
        onChange={setTriggers}
        inputLabel="Neuer Ausloeser"
      />
      <NoteField value={note} onChange={onNoteChange} />
      <FormActions saving={saving} />
    </form>
  );
}

function ObservationForm({
  appState,
  createId,
  eventToEdit,
  eventTime,
  eventTimeError,
  getEventTimeIso,
  note,
  now,
  onEventTimeChange,
  onNoteChange,
  onSave,
  saving
}: FormProps) {
  const editEvent = eventToEdit?.type === 'observation' ? eventToEdit : undefined;
  const [tags, setTags] = useState<string[]>(editEvent?.observationTags ?? []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const changeTime = now().toISOString();
    const observation: ObservationEvent = {
      id: editEvent?.id ?? createId(),
      type: 'observation',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      observationTags: tags,
      ...optionalNote(note)
    };

    void onSave(observation, tags.map((value) => ({ kind: 'observation-tag', value })));
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <TermPills label="Beobachtungen" terms={knownValues(appState, 'observation-tag')} selected={tags} onChange={setTags} />
      <NoteField value={note} onChange={onNoteChange} />
      <FormActions saving={saving} />
    </form>
  );
}

function TherapyDogForm({
  appState,
  createId,
  eventToEdit,
  eventTime,
  eventTimeError,
  getEventTimeIso,
  note,
  now,
  onEventTimeChange,
  onNoteChange,
  onSave,
  saving
}: FormProps) {
  const editEvent = eventToEdit?.type === 'therapy_dog' ? eventToEdit : undefined;
  const [intensity, setIntensity] = useState<TherapyDogIntensity>(editEvent?.intensity ?? 'medium');
  const [durationMinutes, setDurationMinutes] = useState(editEvent?.durationMinutes ? String(editEvent.durationMinutes) : '60');
  const [tags, setTags] = useState<string[]>(editEvent?.tags ?? []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const changeTime = now().toISOString();
    const durationValue = parseOptionalPositiveNumber(durationMinutes);
    const therapyDog: TherapyDogEvent = {
      id: editEvent?.id ?? createId(),
      type: 'therapy_dog',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      intensity,
      ...(durationValue !== undefined ? { durationMinutes: durationValue } : {}),
      tags,
      ...optionalNote(note)
    };

    void onSave(therapyDog, tags.map((value) => ({ kind: 'therapy-tag', value })));
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <SelectField label="Intensitaet" value={intensity} onChange={(value) => setIntensity(value as TherapyDogIntensity)}>
        <option value="light">leicht</option>
        <option value="medium">mittel</option>
        <option value="heavy">schwer</option>
      </SelectField>
      <label className="form-field">
        <span>Dauer in Minuten</span>
        <input
          aria-label="Dauer in Minuten"
          type="number"
          min="0"
          inputMode="numeric"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
        />
      </label>
      <TermPills
        label="Kategorie"
        terms={[...new Set([...knownValues(appState, 'therapy-tag'), 'Tagespflege', 'Station', 'Ausbildung'])]}
        selected={tags}
        onChange={setTags}
        inputLabel="Neue Kategorie"
      />
      <NoteField value={note} onChange={onNoteChange} />
      <FormActions saving={saving} />
    </form>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function FormActions({ saving }: { saving: boolean }) {
  return (
    <div className="form-actions">
      <button className="primary-button" type="submit" disabled={saving}>
        Speichern
      </button>
    </div>
  );
}

function knownValues(appState: AppState, kind: KnownTermKind): string[] {
  return appState.knownTerms.filter((term) => term.kind === kind).map((term) => term.value);
}

function optionalNote(note: string): { note?: string } {
  const trimmedNote = note.trim();

  return trimmedNote ? { note: trimmedNote } : {};
}

function defaultEventTimeFor(defaultDate: string | undefined, now: () => Date): string {
  const current = now();

  if (!defaultDate) {
    return current.toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(defaultDate);

  if (!match) {
    return current.toISOString();
  }

  const [, year, month, day] = match;
  const result = new Date(current);
  result.setFullYear(Number(year), Number(month) - 1, Number(day));

  return result.toISOString();
}

export function toDateTimeLocalValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function localDateTimeToIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseOptionalPositiveNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}
