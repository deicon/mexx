import { CalendarDays, ClipboardList, Moon, Plus } from 'lucide-react';

const quickActions = [
  { label: 'Log Entry', icon: Plus },
  { label: 'Plan Day', icon: CalendarDays },
  { label: 'Review', icon: ClipboardList },
  { label: 'Sleep', icon: Moon }
];

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Today</p>
          <h1 id="app-title">Mexx Tracker</h1>
        </div>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        {quickActions.map(({ label, icon: Icon }) => (
          <button className="quick-action" type="button" key={label}>
            <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
            <span>{label}</span>
          </button>
        ))}
      </section>

      <section className="dashboard" aria-label="Dashboard">
        <h2>Dashboard</h2>
        <div className="dashboard-empty" aria-label="Empty dashboard area" />
      </section>
    </main>
  );
}
