// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../domain/types';
import { PhasesScreen } from './PhasesScreen';

afterEach(() => {
  cleanup();
});

describe('PhasesScreen', () => {
  it('creates a phase with an optional end date', async () => {
    const user = userEvent.setup();
    const savePhase = vi.fn().mockResolvedValue(undefined);

    render(
      <PhasesScreen
        phases={[]}
        repository={{ savePhase }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        createId={() => 'phase-open-ended'}
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Medication pause');
    await user.type(screen.getByLabelText('Startdatum'), '2026-06-10');
    await user.click(screen.getByRole('button', { name: 'Phase speichern' }));

    expect(savePhase).toHaveBeenCalledWith({
      id: 'phase-open-ended',
      name: 'Medication pause',
      startDate: '2026-06-10'
    });
  });

  it('creates overlapping phases without blocking them', async () => {
    const user = userEvent.setup();
    const savePhase = vi.fn().mockResolvedValue(undefined);

    render(
      <PhasesScreen
        phases={[
          {
            id: 'phase-1',
            name: 'Diet trial',
            startDate: '2026-06-01',
            endDate: '2026-06-20'
          }
        ]}
        repository={{ savePhase }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        createId={() => 'phase-overlap'}
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Medication pause');
    await user.type(screen.getByLabelText('Startdatum'), '2026-06-10');
    await user.type(screen.getByLabelText('Enddatum optional'), '2026-06-18');

    expect(screen.getByText('Ueberschneidet sich mit: Diet trial')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Phase speichern' }));

    expect(savePhase).toHaveBeenCalledWith({
      id: 'phase-overlap',
      name: 'Medication pause',
      startDate: '2026-06-10',
      endDate: '2026-06-18'
    });
  });

  it('rejects an end date before the start date', async () => {
    const user = userEvent.setup();
    const savePhase = vi.fn().mockResolvedValue(undefined);

    render(
      <PhasesScreen
        phases={[]}
        repository={{ savePhase }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        createId={() => 'phase-invalid'}
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Invalid phase');
    await user.type(screen.getByLabelText('Startdatum'), '2026-06-10');
    await user.type(screen.getByLabelText('Enddatum optional'), '2026-06-09');
    await user.click(screen.getByRole('button', { name: 'Phase speichern' }));

    expect(savePhase).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enddatum darf nicht vor dem Startdatum liegen.');
  });

  it('displays phases in the relevant periods', () => {
    render(
      <PhasesScreen
        phases={[
          { id: 'phase-current', name: 'Diet trial', startDate: '2026-06-01', endDate: '2026-06-20' },
          { id: 'phase-future', name: 'Vacation', startDate: '2026-07-01' },
          { id: 'phase-past', name: 'Old food', startDate: '2026-05-01', endDate: '2026-05-15' }
        ]}
        repository={{ savePhase: vi.fn() }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
        today="2026-06-10"
      />
    );

    expect(within(screen.getByRole('region', { name: 'Aktive Phasen' })).getByText('Diet trial')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Geplante Phasen' })).getByText('Vacation')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Vergangene Phasen' })).getByText('Old food')).toBeInTheDocument();
  });
});
