import { KnownTerm, KnownTermKind } from './types';

export type SimilarKnownTermSuggestion = {
  kind: KnownTermKind;
  terms: [KnownTerm, KnownTerm, ...KnownTerm[]];
};

export function learnKnownTerm(
  knownTerms: KnownTerm[],
  kind: KnownTermKind,
  value: string,
  lastUsedTime: string,
  createId: () => string
): KnownTerm {
  const trimmedValue = value.trim();
  const existing = knownTerms.find(
    (term) => term.kind === kind && normalizeKnownTermValue(term.value) === normalizeKnownTermValue(trimmedValue)
  );

  return {
    id: existing?.id ?? createId(),
    kind,
    value: existing?.value ?? trimmedValue,
    lastUsedTime,
    useCount: (existing?.useCount ?? 0) + 1
  };
}

export function suggestSimilarKnownTerms(knownTerms: KnownTerm[]): SimilarKnownTermSuggestion[] {
  const suggestions: SimilarKnownTermSuggestion[] = [];
  const termsByKind = new Map<KnownTermKind, KnownTerm[]>();

  for (const term of knownTerms) {
    termsByKind.set(term.kind, [...(termsByKind.get(term.kind) ?? []), term]);
  }

  for (const [kind, terms] of termsByKind) {
    const usedIds = new Set<string>();

    for (const term of terms) {
      if (usedIds.has(term.id)) {
        continue;
      }

      const similarTerms = terms.filter((candidate) => candidate.id !== term.id && areKnownTermValuesSimilar(term.value, candidate.value));

      if (similarTerms.length > 0) {
        const suggestionTerms: [KnownTerm, KnownTerm, ...KnownTerm[]] = [term, similarTerms[0], ...similarTerms.slice(1)];
        suggestionTerms.forEach((candidate) => usedIds.add(candidate.id));
        suggestions.push({ kind, terms: suggestionTerms });
      }
    }
  }

  return suggestions;
}

export function mergeKnownTerms(target: KnownTerm, source: KnownTerm): KnownTerm {
  if (target.kind !== source.kind) {
    throw new Error('Known terms can only be merged within the same kind.');
  }

  return {
    id: target.id,
    kind: target.kind,
    value: target.value,
    lastUsedTime: latestKnownTermUseTime(target.lastUsedTime, source.lastUsedTime),
    useCount: (target.useCount ?? 0) + (source.useCount ?? 0)
  };
}

function latestKnownTermUseTime(left?: string, right?: string): string | undefined {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime)) {
    return right;
  }

  if (Number.isNaN(rightTime)) {
    return left;
  }

  return rightTime > leftTime ? right : left;
}

function normalizeKnownTermValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function areKnownTermValuesSimilar(left: string, right: string): boolean {
  const normalizedLeft = normalizeKnownTermValue(left);
  const normalizedRight = normalizeKnownTermValue(right);

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (Math.min(normalizedLeft.length, normalizedRight.length) < 4) {
    return false;
  }

  return levenshteinDistance(normalizedLeft, normalizedRight) <= 2;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = previous.slice();

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}
