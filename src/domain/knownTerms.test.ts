import { describe, expect, it } from 'vitest';
import { learnKnownTerm, mergeKnownTerms, suggestSimilarKnownTerms } from './knownTerms';
import { KnownTerm } from './types';

describe('known term helpers', () => {
  it('learns new terms and increments existing terms without changing identity', () => {
    const existing: KnownTerm = {
      id: 'term-therapy-krankenhaus',
      kind: 'therapy-tag',
      value: 'Krankenhaus',
      lastUsedTime: '2026-06-01T08:00:00.000Z',
      useCount: 2
    };

    expect(learnKnownTerm([existing], 'therapy-tag', 'Krankenhaus', '2026-06-02T08:00:00.000Z', () => 'unused')).toEqual({
      ...existing,
      lastUsedTime: '2026-06-02T08:00:00.000Z',
      useCount: 3
    });

    expect(learnKnownTerm([existing], 'therapy-tag', 'Pflegeheim', '2026-06-02T08:00:00.000Z', () => 'term-therapy-pflegeheim')).toEqual({
      id: 'term-therapy-pflegeheim',
      kind: 'therapy-tag',
      value: 'Pflegeheim',
      lastUsedTime: '2026-06-02T08:00:00.000Z',
      useCount: 1
    });
  });

  it('suggests similar terms by kind without automatic merging', () => {
    const terms: KnownTerm[] = [
      { id: 'term-1', kind: 'therapy-tag', value: 'Krankenhaus', useCount: 3 },
      { id: 'term-2', kind: 'therapy-tag', value: 'Krankenhausz', useCount: 1 },
      { id: 'term-3', kind: 'trigger-tag', value: 'Krankenhaus', useCount: 2 },
      { id: 'term-4', kind: 'therapy-tag', value: 'Station', useCount: 4 }
    ];

    expect(suggestSimilarKnownTerms(terms)).toEqual([
      {
        kind: 'therapy-tag',
        terms: [terms[0], terms[1]]
      }
    ]);
    expect(terms).toHaveLength(4);
  });

  it('merges terms manually by keeping the target identity and latest use time', () => {
    const target: KnownTerm = {
      id: 'term-target',
      kind: 'trigger-tag',
      value: 'stress',
      lastUsedTime: '2026-06-01T08:00:00.000Z',
      useCount: 2
    };
    const source: KnownTerm = {
      id: 'term-source',
      kind: 'trigger-tag',
      value: 'Stress',
      lastUsedTime: '2026-06-02T08:00:00.000Z',
      useCount: 4
    };

    expect(mergeKnownTerms(target, source)).toEqual({
      id: 'term-target',
      kind: 'trigger-tag',
      value: 'stress',
      lastUsedTime: '2026-06-02T08:00:00.000Z',
      useCount: 6
    });
  });
});
