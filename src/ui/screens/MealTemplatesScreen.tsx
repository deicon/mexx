import { FormEvent, useState } from 'react';
import { FoodComponent, FoodUnit, MealTemplate } from '../../domain/types';
import { AmountUnitFields, FOOD_UNITS } from '../components/EventFormFields';

type MealTemplatesRepository = {
  saveMealTemplate: (mealTemplate: MealTemplate) => Promise<void>;
};

type MealTemplatesScreenProps = {
  mealTemplates: MealTemplate[];
  repository: MealTemplatesRepository;
  onBack: () => void;
  onChanged: () => void | Promise<void>;
  createId?: () => string;
};

type Draft = {
  name: string;
  consumedAmount: string;
  unit: FoodUnit;
};

const emptyDraft: Draft = { name: '', consumedAmount: '0', unit: 'g' };

export function MealTemplatesScreen({
  mealTemplates,
  repository,
  onBack,
  onChanged,
  createId = () => crypto.randomUUID()
}: MealTemplatesScreenProps) {
  const [name, setName] = useState('');
  const [components, setComponents] = useState<Draft[]>([{ ...emptyDraft }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const foodComponents = components.map(toFoodComponent).filter((component): component is FoodComponent => component !== null);

    if (!trimmedName || foodComponents.length === 0) {
      setError('Name und mindestens ein Futter mit Name sind noetig.');
      return;
    }

    const [first, ...rest] = foodComponents;
    const template: MealTemplate = {
      id: createId(),
      name: trimmedName,
      foodComponents: [first, ...rest]
    };

    setSaving(true);
    try {
      await repository.saveMealTemplate(template);
      await onChanged();
      setName('');
      setComponents([{ ...emptyDraft }]);
      setError('');
    } finally {
      setSaving(false);
    }
  }

  function updateComponent(index: number, partial: Partial<Draft>) {
    setComponents((current) =>
      current.map((component, componentIndex) => (componentIndex === index ? { ...component, ...partial } : component))
    );
  }

  return (
    <main className="app-shell maintenance-shell">
      <section className="capture-header" aria-labelledby="meal-templates-title">
        <button className="text-button" type="button" onClick={onBack}>
          Zurueck
        </button>
        <div>
          <p className="eyebrow">Pflege</p>
          <h1 id="meal-templates-title">Futtervorlagen</h1>
        </div>
      </section>

      <form className="capture-form" noValidate onSubmit={(event) => void submit(event)}>
        <label className="form-field">
          <span>Vorlagenname</span>
          <input
            aria-label="Vorlagenname"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
        </label>
        <fieldset className="form-fieldset">
          <legend>Futter</legend>
          {components.map((component, index) => (
            <div className="component-row" key={index}>
              <label>
                <span>Name</span>
                <input
                  aria-label={`Futter ${index + 1} Name`}
                  value={component.name}
                  onChange={(event) => {
                    updateComponent(index, { name: event.target.value });
                    setError('');
                  }}
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
          <button
            className="secondary-button"
            type="button"
            onClick={() => setComponents([...components, { ...emptyDraft }])}
          >
            Futter hinzufuegen
          </button>
        </fieldset>
        {error ? (
          <span className="field-error" role="alert">
            {error}
          </span>
        ) : null}
        <button className="primary-button" type="submit" disabled={saving}>
          Vorlage speichern
        </button>
      </form>

      <section className="maintenance-section" aria-label="Gespeicherte Vorlagen">
        <h2>Gespeicherte Vorlagen</h2>
        {mealTemplates.length === 0 ? <p className="empty-day-text">Noch keine Vorlagen.</p> : null}
        <div className="maintenance-list">
          {mealTemplates.map((template) => (
            <article className="maintenance-card" key={template.id}>
              <h3>{template.name}</h3>
              <p>
                {template.foodComponents
                  .map((component) => `${component.name} ${component.consumedAmount}${component.unit}`)
                  .join(', ')}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function toFoodComponent(draft: Draft): FoodComponent | null {
  const trimmedName = draft.name.trim();

  if (!trimmedName) {
    return null;
  }

  const amount = Number(draft.consumedAmount);

  if (Number.isNaN(amount)) {
    return null;
  }

  return {
    name: trimmedName,
    consumedAmount: amount,
    unit: draft.unit
  };
}
