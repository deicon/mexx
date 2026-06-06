import { TermPills } from './TermPills';

type EventTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function EventTimeField({ value, onChange, error }: EventTimeFieldProps) {
  return (
    <label className="form-field">
      <span>Zeitpunkt</span>
      <input
        aria-label="Zeitpunkt"
        type="datetime-local"
        required
        value={value}
        aria-describedby={error ? 'event-time-error' : undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="field-error" id="event-time-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type NoteFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NoteField({ value, onChange }: NoteFieldProps) {
  return (
    <label className="form-field">
      <span>Notiz</span>
      <textarea aria-label="Notiz" value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}

export { TermPills };
