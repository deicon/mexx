import { FoodUnit, DoseUnit } from '../../domain/types';
import { TermPills } from './TermPills';

export const FOOD_UNITS: FoodUnit[] = ['g', 'ml', 'piece', 'tsp', 'tbsp'];
export const DOSE_UNITS: DoseUnit[] = ['g', 'mg', 'ml', 'drops', 'tablet', 'capsule', 'piece'];

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

type AmountUnitFieldsProps<TUnit extends string> = {
  amountLabel: string;
  amount: string;
  onAmountChange: (value: string) => void;
  unitLabel: string;
  unit: TUnit;
  units: TUnit[];
  onUnitChange: (value: TUnit) => void;
};

export function AmountUnitFields<TUnit extends string>({
  amountLabel,
  amount,
  onAmountChange,
  unitLabel,
  unit,
  units,
  onUnitChange
}: AmountUnitFieldsProps<TUnit>) {
  return (
    <div className="inline-fields inline-fields--even">
      <label>
        <span>{amountLabel}</span>
        <input
          aria-label={amountLabel}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      </label>
      <label>
        <span>{unitLabel}</span>
        <select aria-label={unitLabel} value={unit} onChange={(event) => onUnitChange(event.target.value as TUnit)}>
          {units.map((unitOption) => (
            <option value={unitOption} key={unitOption}>
              {unitOption}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { TermPills };
