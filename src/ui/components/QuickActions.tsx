import { HeartHandshake, StickyNote, Zap } from 'lucide-react';
import { EventType } from '../../domain/types';

type QuickAction = {
  type: Extract<EventType, 'seizure' | 'observation' | 'therapy_dog'>;
  label: string;
  icon: typeof Zap;
};

const actions: QuickAction[] = [
  { type: 'seizure', label: 'Anfall', icon: Zap },
  { type: 'therapy_dog', label: 'Therapiehund', icon: HeartHandshake },
  { type: 'observation', label: 'Beobachtung', icon: StickyNote }
];

type QuickActionsProps = {
  onAction?: (type: QuickAction['type']) => void;
};

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <section className="quick-actions" aria-label="Schnell erfassen">
      {actions.map(({ type, label, icon: Icon }) => (
        <button className="quick-action" type="button" key={type} onClick={() => onAction?.(type)}>
          <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
          <span>{label}</span>
        </button>
      ))}
    </section>
  );
}
