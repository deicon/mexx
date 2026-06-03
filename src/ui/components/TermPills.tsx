import { useState } from 'react';

type TermPillsProps = {
  label: string;
  terms: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  addLabel?: string;
  inputLabel?: string;
};

export function TermPills({
  label,
  terms,
  selected,
  onChange,
  addLabel = 'Hinzufuegen',
  inputLabel = 'Neuer Begriff'
}: TermPillsProps) {
  const [newTerm, setNewTerm] = useState('');
  const visibleTerms = unique([...terms, ...selected]);

  function toggle(term: string) {
    if (selected.includes(term)) {
      onChange(selected.filter((value) => value !== term));
      return;
    }

    onChange([...selected, term]);
  }

  function addTerm() {
    const value = newTerm.trim();

    if (!value) {
      return;
    }

    onChange(unique([...selected, value]));
    setNewTerm('');
  }

  return (
    <fieldset className="form-fieldset">
      <legend>{label}</legend>
      {visibleTerms.length > 0 ? (
        <div className="term-pills">
          {visibleTerms.map((term) => (
            <button
              className={`term-pill${selected.includes(term) ? ' term-pill--selected' : ''}`}
              type="button"
              key={term}
              aria-pressed={selected.includes(term)}
              onClick={() => toggle(term)}
            >
              {term}
            </button>
          ))}
        </div>
      ) : null}
      <div className="inline-fields">
        <label>
          <span>{inputLabel}</span>
          <input value={newTerm} onChange={(event) => setNewTerm(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={addTerm}>
          {addLabel}
        </button>
      </div>
    </fieldset>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}
