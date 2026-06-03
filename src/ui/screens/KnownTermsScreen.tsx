import { useMemo, useState } from 'react';
import { mergeKnownTerms, suggestSimilarKnownTerms } from '../../domain/knownTerms';
import { AppState, KnownTerm, KnownTermKind } from '../../domain/types';

type KnownTermsRepository = {
  replaceAppState: (state: AppState) => Promise<void>;
};

type KnownTermsScreenProps = {
  appState: AppState;
  repository: KnownTermsRepository;
  onBack: () => void;
  onChanged: () => void | Promise<void>;
};

const kindLabels: Record<KnownTermKind, string> = {
  'food-name': 'Futter',
  'dose-name': 'Gaben',
  'trigger-tag': 'Ausloeser',
  'stool-flag': 'Kotmerkmale',
  'observation-tag': 'Beobachtungen'
};

const kindOrder: KnownTermKind[] = ['food-name', 'dose-name', 'trigger-tag', 'stool-flag', 'observation-tag'];

export function KnownTermsScreen({ appState, repository, onBack, onChanged }: KnownTermsScreenProps) {
  const [savingMerge, setSavingMerge] = useState(false);
  const suggestions = useMemo(() => suggestSimilarKnownTerms(appState.knownTerms), [appState.knownTerms]);

  async function mergeTerms(target: KnownTerm, source: KnownTerm) {
    if (savingMerge) {
      return;
    }

    const mergedTerm = mergeKnownTerms(target, source);
    const nextState: AppState = {
      ...appState,
      knownTerms: appState.knownTerms
        .filter((term) => term.id !== source.id)
        .map((term) => (term.id === target.id ? mergedTerm : term))
    };

    setSavingMerge(true);

    try {
      await repository.replaceAppState(nextState);
      await onChanged();
    } finally {
      setSavingMerge(false);
    }
  }

  return (
    <main className="app-shell maintenance-shell">
      <section className="capture-header" aria-labelledby="known-terms-title">
        <button className="text-button" type="button" onClick={onBack}>
          Zurueck
        </button>
        <div>
          <p className="eyebrow">Pflege</p>
          <h1 id="known-terms-title">Begriffe</h1>
        </div>
      </section>

      <section className="maintenance-section" aria-label="Merge-Vorschlaege">
        <h2>Merge-Vorschlaege</h2>
        {suggestions.length === 0 ? <p className="empty-day-text">Keine Vorschlaege.</p> : null}
        <div className="maintenance-list">
          {suggestions.map((suggestion) => {
            const [target, ...sources] = suggestion.terms;

            return sources.map((source) => {
              const mergeId = `${target.id}:${source.id}`;

              return (
                <article className="maintenance-card maintenance-card--action" key={mergeId}>
                  <div>
                    <h3>{kindLabels[suggestion.kind]}</h3>
                    <p>
                      {target.value} + {source.value}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={savingMerge}
                    onClick={() => void mergeTerms(target, source)}
                  >
                    Zusammenfuehren
                  </button>
                </article>
              );
            });
          })}
        </div>
      </section>

      {kindOrder.map((kind) => (
        <section className="maintenance-section" aria-label={kindLabels[kind]} key={kind}>
          <h2>{kindLabels[kind]}</h2>
          <div className="term-table">
            {appState.knownTerms
              .filter((term) => term.kind === kind)
              .map((term) => (
                <article className="term-row" key={term.id}>
                  <span>{term.value}</span>
                  <span>{term.useCount ?? 0}x</span>
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
