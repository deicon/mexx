# Mexx Tracker V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 offline-first iPhone PWA described in `docs/v1-scope.md`.

**Architecture:** Create a Vite + React + TypeScript PWA with domain logic kept separate from UI. Persist local state in IndexedDB through a small repository layer, validate all JSON import/export payloads with schemas, and keep reports/CSV generation as pure functions that can be tested without a browser.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Dexie for IndexedDB, Zod for schemas, vite-plugin-pwa, date-fns, jspdf or print-first HTML for clinical reports.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `vite.config.ts`: Vite, Vitest, and PWA configuration.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript configuration.
- `index.html`: PWA HTML shell.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: Top-level app routing/state shell.
- `src/domain/types.ts`: Domain types matching `CONTEXT.md`.
- `src/domain/fixtures.ts`: Test/demo data builders.
- `src/domain/dayState.ts`: Color score and day-state derivation.
- `src/domain/importExport.ts`: Backup/day import-export merge rules.
- `src/domain/reporting.ts`: Report period, correlation, CSV row derivation.
- `src/domain/knownTerms.ts`: Known term suggestions and manual merge behavior.
- `src/storage/db.ts`: Dexie database schema and migrations.
- `src/storage/repository.ts`: App-state read/write API.
- `src/ui/components/*`: Reusable mobile-first controls.
- `src/ui/screens/DashboardScreen.tsx`: Today status, quick actions, calendar.
- `src/ui/screens/DayDetailScreen.tsx`: Chronological day detail.
- `src/ui/screens/CaptureScreens.tsx`: Seizure, meal, stool, dose, observation forms.
- `src/ui/screens/ExportsScreen.tsx`: Backup/day export/import, CSV, report.
- `src/ui/screens/PhasesScreen.tsx`: Phase maintenance.
- `src/styles.css`: Global responsive styles.
- `src/**/*.test.ts` / `src/**/*.test.tsx`: Unit and component tests.

## Implementation Tasks

### Task 1: Scaffold The PWA Project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create project configuration**

Add Vite React TypeScript, Vitest, Testing Library, Dexie, Zod, date-fns, lucide-react, and PWA dependencies.

- [ ] **Step 2: Add minimal React shell**

Create a placeholder app with the title `Mexx Tracker`, four quick-action buttons, and an empty dashboard area.

- [ ] **Step 3: Run install**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 4: Verify scaffold**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html src
git commit -m "feat: scaffold mexx tracker pwa"
```

### Task 2: Define Domain Types And Fixtures

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/fixtures.ts`
- Create: `src/domain/types.test.ts`

- [ ] **Step 1: Write type-level fixture tests**

Create fixtures for seizure, meal, stool, dose, observation, phase, known term, backup export, and day export.

- [ ] **Step 2: Define canonical domain types**

Include event identity, event time, capture time, change time, deleted state, event variants, controlled units, color score, import/export payloads, and schema version.

- [ ] **Step 3: Run domain tests**

Run: `npm test -- src/domain/types.test.ts`

Expected: tests pass and fixtures compile.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/domain/fixtures.ts src/domain/types.test.ts
git commit -m "feat: define tracker domain model"
```

### Task 3: Implement Day State And Color Score

**Files:**
- Create: `src/domain/dayState.ts`
- Create: `src/domain/dayState.test.ts`

- [ ] **Step 1: Write failing color-score tests**

Cover green with no seizures, yellow with one light seizure, orange with multiple light seizures or one medium seizure, red with severe seizure, over-5-minute seizure, or repeated medium seizures. Add a test proving stool quality does not affect color score.

- [ ] **Step 2: Implement `calculateDayState(events)`**

Return date, color score, seizure counts, stool summary, and event counts. Exclude deleted events.

- [ ] **Step 3: Run tests**

Run: `npm test -- src/domain/dayState.test.ts`

Expected: all day-state tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/dayState.ts src/domain/dayState.test.ts
git commit -m "feat: calculate day state from events"
```

### Task 4: Implement JSON Schemas And Import Rules

**Files:**
- Create: `src/domain/importExport.ts`
- Create: `src/domain/importExport.test.ts`

- [ ] **Step 1: Write failing schema tests**

Cover valid backup export, valid day export, unknown newer schema rejection, day export excluding unrelated templates, and backup export including deleted events.

- [ ] **Step 2: Write failing merge tests**

Cover day import appending new events, preserving local events, newer change time winning for same identity, similar different identities remaining separate, and deleted events transferring as deleted.

- [ ] **Step 3: Implement Zod schemas**

Implement `parseBackupExport`, `parseDayExport`, `createBackupExport`, and `createDayExport`.

- [ ] **Step 4: Implement import functions**

Implement `applyBackupImport(localState, backup)` as full replacement and `applyDayImport(localState, dayExport)` as merge.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/importExport.test.ts`

Expected: all import/export tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/importExport.ts src/domain/importExport.test.ts
git commit -m "feat: implement json import export rules"
```

### Task 5: Implement IndexedDB Storage

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/repository.ts`
- Create: `src/storage/repository.test.ts`

- [ ] **Step 1: Write repository tests**

Use a fake or test IndexedDB setup. Cover save/load full state, upsert event, soft delete event, meal template persistence, known term persistence, phases, and backup status.

- [ ] **Step 2: Implement Dexie schema**

Create stores for events, meal templates, known terms, phases, settings, and backup metadata.

- [ ] **Step 3: Implement repository API**

Expose `loadAppState`, `replaceAppState`, `upsertEvent`, `markEventDeleted`, `saveMealTemplate`, `saveKnownTerm`, `savePhase`, and `saveBackupStatus`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/storage/repository.test.ts`

Expected: repository tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/storage/db.ts src/storage/repository.ts src/storage/repository.test.ts
git commit -m "feat: persist tracker state locally"
```

### Task 6: Build Mobile Dashboard And Calendar

**Files:**
- Create: `src/ui/screens/DashboardScreen.tsx`
- Create: `src/ui/components/CalendarMonth.tsx`
- Create: `src/ui/components/QuickActions.tsx`
- Create: `src/ui/screens/DashboardScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write component tests**

Cover quick-action labels, month calendar rendering, green/yellow/orange/red day classes, and day selection.

- [ ] **Step 2: Implement dashboard UI**

Show today's compact status, quick actions for seizure/meal/stool/dose, backup status hint, and monthly calendar.

- [ ] **Step 3: Wire app shell**

Load app state from repository and pass calculated day states to dashboard.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/ui/screens/DashboardScreen.test.tsx && npm run build`

Expected: tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/styles.css src/ui
git commit -m "feat: add mobile dashboard calendar"
```

### Task 7: Build Capture Forms

**Files:**
- Create: `src/ui/screens/CaptureScreens.tsx`
- Create: `src/ui/components/EventFormFields.tsx`
- Create: `src/ui/components/TermPills.tsx`
- Create: `src/ui/screens/CaptureScreens.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write form tests**

Cover seizure capture with default event time now, after-the-fact event time editing, trigger pill selection, new trigger creation, meal from template, stool quality, dose category, and optional notes.

- [ ] **Step 2: Implement reusable event fields**

Create controls for event time, note, controlled unit, amount, and known-term pills.

- [ ] **Step 3: Implement seizure, meal, stool, dose, and observation forms**

Keep forms mobile-first and fast. Save through repository using stable event identities.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/ui/screens/CaptureScreens.test.tsx`

Expected: capture tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/screens/CaptureScreens.tsx src/ui/components src/ui/screens/CaptureScreens.test.tsx
git commit -m "feat: add event capture forms"
```

### Task 8: Build Day Detail Editing

**Files:**
- Create: `src/ui/screens/DayDetailScreen.tsx`
- Create: `src/ui/screens/DayDetailScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write day-detail tests**

Cover chronological ordering by event time, summary counts, edit action, soft delete action, hidden deleted events, and after-the-fact corrections updating change time.

- [ ] **Step 2: Implement day detail**

Show compact summary and chronological cards for seizures, meals, stools, doses, and observations.

- [ ] **Step 3: Wire edit/delete behavior**

Reuse capture forms for editing. Mark events deleted instead of hard deleting.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/ui/screens/DayDetailScreen.test.tsx`

Expected: day-detail tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/screens/DayDetailScreen.tsx src/ui/screens/DayDetailScreen.test.tsx
git commit -m "feat: add chronological day detail"
```

### Task 9: Build Phases And Known-Term Cleanup

**Files:**
- Create: `src/ui/screens/PhasesScreen.tsx`
- Create: `src/ui/screens/KnownTermsScreen.tsx`
- Create: `src/domain/knownTerms.ts`
- Create: `src/domain/knownTerms.test.ts`
- Create: `src/ui/screens/PhasesScreen.test.tsx`

- [ ] **Step 1: Write known-term tests**

Cover learned terms, similar-term suggestions, and manual merge only.

- [ ] **Step 2: Implement known-term logic**

Provide suggestion and merge helpers without automatic merging.

- [ ] **Step 3: Write phase screen tests**

Cover create phase, optional end date, overlapping phases, and display in relevant periods.

- [ ] **Step 4: Implement screens**

Add phase maintenance and known-term cleanup screens.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/knownTerms.test.ts src/ui/screens/PhasesScreen.test.tsx`

Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/knownTerms.ts src/domain/knownTerms.test.ts src/ui/screens/PhasesScreen.tsx src/ui/screens/KnownTermsScreen.tsx src/ui/screens/PhasesScreen.test.tsx
git commit -m "feat: manage phases and known terms"
```

### Task 10: Build CSV And Clinical Report Generation

**Files:**
- Create: `src/domain/reporting.ts`
- Create: `src/domain/reporting.test.ts`
- Create: `src/ui/screens/ReportsScreen.tsx`
- Create: `src/ui/screens/ReportsScreen.test.tsx`

- [ ] **Step 1: Write reporting tests**

Cover report periods, correlation windows 0-6h/6-24h/24-72h before seizures, no diagnostic language, CSV file row generation, and phase inclusion.

- [ ] **Step 2: Implement reporting pure functions**

Create summary models for clinical report, CSV package rows, day states, and correlations.

- [ ] **Step 3: Implement report UI**

Provide period selection, print/PDF-oriented report view, and CSV download package.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/reporting.test.ts src/ui/screens/ReportsScreen.test.tsx`

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/reporting.ts src/domain/reporting.test.ts src/ui/screens/ReportsScreen.tsx src/ui/screens/ReportsScreen.test.tsx
git commit -m "feat: generate reports and csv exports"
```

### Task 11: Build Import Export UI

**Files:**
- Create: `src/ui/screens/ExportsScreen.tsx`
- Create: `src/ui/screens/ExportsScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write export screen tests**

Cover backup export, backup import preview, backup import replacement confirmation, day export for selected date, day import merge, backup recommendation before day import, and schema rejection message.

- [ ] **Step 2: Implement backup export/import**

Use domain import/export functions and repository replacement. Update backup status after successful backup export.

- [ ] **Step 3: Implement day export/import**

Use merge behavior. Show summary of added/updated/deleted events after import.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/ui/screens/ExportsScreen.test.tsx`

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/screens/ExportsScreen.tsx src/ui/screens/ExportsScreen.test.tsx
git commit -m "feat: add json import export workflows"
```

### Task 12: PWA, Accessibility, And iPhone Verification

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/styles.css`
- Create: `public/icons/*`
- Create: `src/appSmoke.test.tsx`

- [ ] **Step 1: Add PWA manifest and service worker config**

Configure offline caching for app shell assets. Do not cache import/export files.

- [ ] **Step 2: Add accessibility smoke tests**

Cover keyboard-reachable main actions, labelled form controls, and no missing accessible names for icon buttons.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 4: Run local app**

Run: `npm run dev -- --host 127.0.0.1`

Expected: dev server starts.

- [ ] **Step 5: Verify in browser**

Use browser automation or manual in-app browser checks at desktop and iPhone-sized viewport:

- Dashboard visible
- Calendar not overlapping
- Quick actions reachable
- Capture forms usable
- Day detail chronological
- Import/export screens readable
- Print report layout sane

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts src/styles.css public src/appSmoke.test.tsx
git commit -m "feat: finalize offline pwa behavior"
```

## Final Verification

Run:

```bash
npm test
npm run build
git status --short
```

Expected:

- All tests pass
- Production build succeeds
- Only intentional files are modified

## Notes For Implementers

- Keep domain logic pure and tested before UI work.
- Do not add cloud sync, accounts, multiple dogs, diagnostic claims, nutrition data, stool amount, or automatic term merging.
- Use `CONTEXT.md` for canonical terms and `docs/v1-scope.md` for V1 boundaries.
- Any change to import/export semantics should update `CONTEXT.md`; consider an ADR only for hard-to-reverse trade-offs.
