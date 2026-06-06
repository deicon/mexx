# Agent Instructions

## Data Compatibility

All changes must remain compatible with existing user data. The IndexedDB (`mexx-tracker`) may contain legacy event types (e.g. `meal`, `stool`, `dose`) and old schemas from previous app versions. These old records must not cause crashes, data loss or import failures.

Rules:

1. **Never silently drop old data** — if a legacy event type is no longer supported by the UI, it must still be handled gracefully (e.g. filtered out during load, shown as "Unbekannt", or migrated).
2. **Schema changes require migration** — when the `TrackerEvent` union, `AppState` shape or Zod schemas change, provide a migration path so that existing backups and day-exports remain importable.
3. **Zod schemas must stay permissive for old data** — or a migration step must upgrade old payloads before validation.
4. **Dexie schema version bumps** — if the DB schema changes (table names, indexes), bump the Dexie version and provide an `upgrade` transaction.
5. **Test with legacy fixtures** — keep at least one test that loads/round-trips data containing the old event types to ensure backwards compatibility.
