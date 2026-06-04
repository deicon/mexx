// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mealTemplateFixture } from '../../domain/fixtures';
import { MealTemplatesScreen } from './MealTemplatesScreen';

afterEach(() => {
  cleanup();
});

describe('MealTemplatesScreen', () => {
  it('creates a meal template with multiple food components', async () => {
    const user = userEvent.setup();
    const saveMealTemplate = vi.fn().mockResolvedValue(undefined);
    const onChanged = vi.fn();

    render(
      <MealTemplatesScreen
        mealTemplates={[]}
        repository={{ saveMealTemplate }}
        onBack={vi.fn()}
        onChanged={onChanged}
        createId={() => 'meal-template-new'}
      />
    );

    await user.type(screen.getByLabelText('Vorlagenname'), 'Abendessen');
    await user.type(screen.getByLabelText('Futter 1 Name'), 'Rind');
    await user.clear(screen.getByLabelText('Futter 1 Menge'));
    await user.type(screen.getByLabelText('Futter 1 Menge'), '150');

    await user.click(screen.getByRole('button', { name: 'Futter hinzufuegen' }));
    await user.type(screen.getByLabelText('Futter 2 Name'), 'Karotte');
    await user.clear(screen.getByLabelText('Futter 2 Menge'));
    await user.type(screen.getByLabelText('Futter 2 Menge'), '40');

    await user.click(screen.getByRole('button', { name: 'Vorlage speichern' }));

    expect(saveMealTemplate).toHaveBeenCalledWith({
      id: 'meal-template-new',
      name: 'Abendessen',
      foodComponents: [
        { name: 'Rind', consumedAmount: 150, unit: 'g' },
        { name: 'Karotte', consumedAmount: 40, unit: 'g' }
      ]
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('rejects saving without name or any named component', async () => {
    const user = userEvent.setup();
    const saveMealTemplate = vi.fn().mockResolvedValue(undefined);

    render(
      <MealTemplatesScreen
        mealTemplates={[]}
        repository={{ saveMealTemplate }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Vorlage speichern' }));

    expect(saveMealTemplate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Name und mindestens ein Futter/i);
  });

  it('lists existing templates with their component names', () => {
    render(
      <MealTemplatesScreen
        mealTemplates={[mealTemplateFixture]}
        repository={{ saveMealTemplate: vi.fn() }}
        onBack={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    expect(screen.getByText(mealTemplateFixture.name)).toBeInTheDocument();
    expect(screen.getByText(/Chicken/)).toBeInTheDocument();
    expect(screen.getByText(/Broth/)).toBeInTheDocument();
  });
});
