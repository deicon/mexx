// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStateFixture } from '../../domain/fixtures';
import { AppState } from '../../domain/types';
import { KnownTermsScreen } from './KnownTermsScreen';

afterEach(() => {
  cleanup();
});

describe('KnownTermsScreen', () => {
  it('disables all merge buttons while a merge is saving', async () => {
    const user = userEvent.setup();
    const firstSave = deferred<void>();
    const replaceAppState = vi.fn().mockReturnValue(firstSave.promise);

    render(
      <KnownTermsScreen
        appState={appStateWithMergeSuggestions()}
        repository={{ replaceAppState }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    const mergeButtons = screen.getAllByRole('button', { name: 'Zusammenfuehren' });

    await user.click(mergeButtons[0]);

    expect(mergeButtons[0]).toBeDisabled();
    expect(mergeButtons[1]).toBeDisabled();
    expect(replaceAppState).toHaveBeenCalledTimes(1);
  });
});

function appStateWithMergeSuggestions(): AppState {
  return {
    ...appStateFixture,
    events: [],
    phases: [],
    knownTerms: [
      { id: 'term-therapy-tagespflege', kind: 'therapy-tag', value: 'Tagespflege', useCount: 2 },
      { id: 'term-therapy-tagespfleg', kind: 'therapy-tag', value: 'Tagespfleg', useCount: 1 },
      { id: 'term-trigger-stress', kind: 'trigger-tag', value: 'stress', useCount: 2 },
      { id: 'term-trigger-stres', kind: 'trigger-tag', value: 'stres', useCount: 1 }
    ]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}
