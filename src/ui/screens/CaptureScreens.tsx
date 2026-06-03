import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { learnKnownTerm } from '../../domain/knownTerms';
import {
  AppState,
  ConsumptionStatus,
  DoseCategory,
  DoseEvent,
  DoseUnit,
  EventType,
  FoodComponent,
  FoodUnit,
  KnownTerm,
  KnownTermKind,
  MealEvent,
  ObservationEvent,
  SeizureDurationClass,
  SeizureEvent,
  SeizureSeverity,
  StoolEvent,
  StoolQuality,
  TrackerEvent
} from '../../domain/types';
import {
  AmountUnitFields,
  DOSE_UNITS,
  EventTimeField,
  FOOD_UNITS,
  NoteField,
  TermPills
} from '../components/EventFormFields';

type CaptureRepository = {
  upsertEvent: (event: TrackerEvent) => Promise<void>;
  saveKnownTerm: (knownTerm: KnownTerm) => Promise<void>;
};

type CaptureScreensProps = {
  type: EventType;
  appState: AppState;
  repository: CaptureRepository;
  eventToEdit?: TrackerEvent;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
  now?: () => Date;
  createId?: () => string;
};

const typeLabels: Record<EventType, string> = {
  seizure: 'Anfall erfassen',
  meal: 'Mahlzeit erfassen',
  stool: 'Kot erfassen',
  dose: 'Gabe erfassen',
  observation: 'Beobachtung erfassen'
};

const editTypeLabels: Record<EventType, string> = {
  seizure: 'Anfall bearbeiten',
  meal: 'Mahlzeit bearbeiten',
  stool: 'Kot bearbeiten',
  dose: 'Gabe bearbeiten',
  observation: 'Beobachtung bearbeiten'
};

export function CaptureScreens({
  type,
  appState,
  repository,
  eventToEdit,
  onDone,
  onCancel,
  now = () => new Date(),
  createId = () => crypto.randomUUID()
}: CaptureScreensProps) {
  const initialEventTime = useMemo(() => eventToEdit?.eventTime ?? now().toISOString(), [eventToEdit, now]);
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
      {type === 'meal' ? <MealForm {...common} /> : null}
      {type === 'stool' ? <StoolForm {...common} /> : null}
      {type === 'dose' ? <DoseForm {...common} /> : null}
      {type === 'observation' ? <ObservationForm {...common} /> : null}
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
    const seizure: SeizureEvent = {
      id: editEvent?.id ?? createId(),
      type: 'seizure',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      severity,
      durationClass,
      ...(exactDuration.trim() ? { exactDuration: { value: Number(exactDuration), unit: 'seconds' } } : {}),
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

function MealForm({
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
  const editEvent = eventToEdit?.type === 'meal' ? eventToEdit : undefined;
  const [templateId, setTemplateId] = useState(editEvent?.mealTemplateId ?? '');
  const [components, setComponents] = useState<FoodComponentDraft[]>(
    editEvent?.foodComponents.map((component) => ({ ...component, consumedAmount: String(component.consumedAmount) })) ?? [
      { name: '', consumedAmount: '0', unit: 'g' }
    ]
  );
  const [consumptionStatus, setConsumptionStatus] = useState<ConsumptionStatus>(editEvent?.consumptionStatus ?? 'eaten');

  function applyTemplate(value: string) {
    setTemplateId(value);
    const template = appState.mealTemplates.find((candidate) => candidate.id === value);

    if (template) {
      setComponents(template.foodComponents.map((component) => ({ ...component, consumedAmount: String(component.consumedAmount) })));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const foodComponents = components
      .map(toFoodComponent)
      .filter((component): component is FoodComponent => component !== null);

    if (foodComponents.length === 0) {
      return;
    }

    const changeTime = now().toISOString();
    const meal: MealEvent = {
      id: editEvent?.id ?? createId(),
      type: 'meal',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      foodComponents: foodComponents as [FoodComponent, ...FoodComponent[]],
      consumptionStatus,
      ...(templateId ? { mealTemplateId: templateId } : {}),
      ...optionalNote(note)
    };

    void onSave(meal, foodComponents.map((component) => ({ kind: 'food-name', value: component.name })));
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <SelectField label="Vorlage" value={templateId} onChange={applyTemplate}>
        <option value="">Keine Vorlage</option>
        {appState.mealTemplates.map((template) => (
          <option value={template.id} key={template.id}>
            {template.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Fressstatus"
        value={consumptionStatus}
        onChange={(value) => setConsumptionStatus(value as ConsumptionStatus)}
      >
        <option value="eaten">gefressen</option>
        <option value="partially-eaten">teilweise</option>
        <option value="refused">verweigert</option>
        <option value="unknown">unbekannt</option>
      </SelectField>
      <fieldset className="form-fieldset">
        <legend>Futter</legend>
        {components.map((component, index) => (
          <div className="component-row" key={index}>
            <label>
              <span>Name</span>
              <input
                aria-label={`Futter ${index + 1} Name`}
                value={component.name}
                onChange={(event) => updateComponent(index, { name: event.target.value })}
                list="food-known-terms"
              />
            </label>
            <AmountUnitFields
              amountLabel={`Futter ${index + 1} Menge`}
              amount={component.consumedAmount}
              onAmountChange={(value) => updateComponent(index, { consumedAmount: value })}
              unitLabel={`Futter ${index + 1} Einheit`}
              unit={component.unit}
              units={FOOD_UNITS}
              onUnitChange={(value) => updateComponent(index, { unit: value })}
            />
          </div>
        ))}
        <datalist id="food-known-terms">
          {knownValues(appState, 'food-name').map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
        <button className="secondary-button" type="button" onClick={() => setComponents([...components, { name: '', consumedAmount: '0', unit: 'g' }])}>
          Futter hinzufuegen
        </button>
      </fieldset>
      <NoteField value={note} onChange={onNoteChange} />
      <FormActions saving={saving} />
    </form>
  );

  function updateComponent(index: number, partial: Partial<FoodComponentDraft>) {
    setComponents(components.map((component, componentIndex) => (componentIndex === index ? { ...component, ...partial } : component)));
  }
}

function StoolForm({
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
  const editEvent = eventToEdit?.type === 'stool' ? eventToEdit : undefined;
  const [quality, setQuality] = useState<StoolQuality>(editEvent?.quality ?? 'normal');
  const [flags, setFlags] = useState<string[]>(editEvent?.stoolFlags ?? []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const changeTime = now().toISOString();
    const stool: StoolEvent = {
      id: editEvent?.id ?? createId(),
      type: 'stool',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      quality,
      stoolFlags: flags,
      ...optionalNote(note)
    };

    void onSave(stool, flags.map((value) => ({ kind: 'stool-flag', value })));
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <SelectField label="Kotqualitaet" value={quality} onChange={(value) => setQuality(value as StoolQuality)}>
        <option value="firm-formed">fest geformt</option>
        <option value="normal">normal</option>
        <option value="soft">weich</option>
        <option value="mushy">breiig</option>
        <option value="diarrhea">Durchfall</option>
      </SelectField>
      <TermPills label="Kotmerkmale" terms={knownValues(appState, 'stool-flag')} selected={flags} onChange={setFlags} />
      <NoteField value={note} onChange={onNoteChange} />
      <FormActions saving={saving} />
    </form>
  );
}

function DoseForm({
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
  const editEvent = eventToEdit?.type === 'dose' ? eventToEdit : undefined;
  const [category, setCategory] = useState<DoseCategory>(editEvent?.category ?? 'supplement');
  const [name, setName] = useState(editEvent?.name ?? '');
  const [amount, setAmount] = useState(editEvent ? String(editEvent.administeredAmount) : '0');
  const [unit, setUnit] = useState<DoseUnit>(editEvent?.unit ?? 'mg');
  const [associatedMealId, setAssociatedMealId] = useState(editEvent?.associatedMealId ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEventTime = getEventTimeIso();

    if (!parsedEventTime) {
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    const changeTime = now().toISOString();
    const dose: DoseEvent = {
      id: editEvent?.id ?? createId(),
      type: 'dose',
      eventTime: parsedEventTime,
      captureTime: editEvent?.captureTime ?? changeTime,
      changeTime,
      category,
      name: trimmedName,
      administeredAmount: Number(amount),
      unit,
      ...(associatedMealId ? { associatedMealId } : {}),
      ...optionalNote(note)
    };

    void onSave(dose, [{ kind: 'dose-name', value: trimmedName }]);
  }

  return (
    <form className="capture-form" onSubmit={submit}>
      <EventTimeField value={eventTime} error={eventTimeError} onChange={onEventTimeChange} />
      <SelectField label="Kategorie" value={category} onChange={(value) => setCategory(value as DoseCategory)}>
        <option value="supplement">Supplement</option>
        <option value="medication">Medikament</option>
        <option value="other">Andere</option>
      </SelectField>
      <label className="form-field">
        <span>Name</span>
        <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} list="dose-known-terms" />
      </label>
      <datalist id="dose-known-terms">
        {knownValues(appState, 'dose-name').map((value) => (
          <option value={value} key={value} />
        ))}
      </datalist>
      <AmountUnitFields
        amountLabel="Menge"
        amount={amount}
        onAmountChange={setAmount}
        unitLabel="Einheit"
        unit={unit}
        units={DOSE_UNITS}
        onUnitChange={setUnit}
      />
      <SelectField label="Zugehoerige Mahlzeit" value={associatedMealId} onChange={setAssociatedMealId}>
        <option value="">Keine</option>
        {appState.events
          .filter((event): event is MealEvent => event.type === 'meal' && !event.deleted)
          .map((meal) => (
            <option value={meal.id} key={meal.id}>
              {meal.foodComponents.map((component) => component.name).join(', ')}
            </option>
          ))}
      </SelectField>
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

function SelectField({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
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

type FoodComponentDraft = Omit<FoodComponent, 'consumedAmount'> & {
  consumedAmount: string;
};

function toFoodComponent(component: FoodComponentDraft): FoodComponent | null {
  const name = component.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    consumedAmount: Number(component.consumedAmount),
    unit: component.unit
  };
}

function knownValues(appState: AppState, kind: KnownTermKind): string[] {
  return appState.knownTerms.filter((term) => term.kind === kind).map((term) => term.value);
}

function optionalNote(note: string): { note?: string } {
  const trimmedNote = note.trim();

  return trimmedNote ? { note: trimmedNote } : {};
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
