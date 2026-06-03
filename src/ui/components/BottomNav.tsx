import { Bone, FileText, Home, Pill, Plus, StickyNote, Utensils, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EventType } from '../../domain/types';

type BottomNavProps = {
  active: 'dashboard' | 'reports';
  onDashboard: () => void;
  onReports: () => void;
  onCapture: (type: EventType) => void;
};

type CaptureAction = {
  type: EventType;
  label: string;
  icon: typeof Zap;
};

const captureActions: CaptureAction[] = [
  { type: 'seizure', label: 'Anfall', icon: Zap },
  { type: 'meal', label: 'Mahlzeit', icon: Utensils },
  { type: 'stool', label: 'Kot', icon: Bone },
  { type: 'dose', label: 'Gabe', icon: Pill },
  { type: 'observation', label: 'Beobachtung', icon: StickyNote }
];

export function BottomNav({ active, onDashboard, onReports, onCapture }: BottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSheetOpen(false);
      }
    }

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [sheetOpen]);

  function handleCapture(type: EventType) {
    setSheetOpen(false);
    onCapture(type);
  }

  return (
    <>
      {sheetOpen ? (
        <div className="capture-sheet" role="dialog" aria-modal="true" aria-label="Schnell erfassen">
          <button
            type="button"
            className="capture-sheet__backdrop"
            aria-label="Schliessen"
            onClick={() => setSheetOpen(false)}
          />
          <div className="capture-sheet__panel">
            <p className="eyebrow capture-sheet__eyebrow">Erfassen</p>
            <div className="capture-sheet__grid">
              {captureActions.map(({ type, label, icon: Icon }) => (
                <button
                  type="button"
                  key={type}
                  className="capture-sheet__action"
                  onClick={() => handleCapture(type)}
                >
                  <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Hauptnavigation">
        <button
          type="button"
          className={`bottom-nav__tab${active === 'dashboard' ? ' bottom-nav__tab--active' : ''}`}
          aria-current={active === 'dashboard' ? 'page' : undefined}
          onClick={onDashboard}
        >
          <Home aria-hidden="true" size={22} strokeWidth={2.2} />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className="bottom-nav__fab"
          aria-label={sheetOpen ? 'Erfassen schliessen' : 'Erfassen oeffnen'}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((value) => !value)}
        >
          <Plus aria-hidden="true" size={28} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          className={`bottom-nav__tab${active === 'reports' ? ' bottom-nav__tab--active' : ''}`}
          aria-current={active === 'reports' ? 'page' : undefined}
          onClick={onReports}
        >
          <FileText aria-hidden="true" size={22} strokeWidth={2.2} />
          <span>Bericht</span>
        </button>
      </nav>
    </>
  );
}
