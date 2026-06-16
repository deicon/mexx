import { Table } from 'dexie';
import {
  AppSettings,
  AppState,
  BackupStatus,
  EventId,
  KnownTerm,
  Phase,
  SCHEMA_VERSION,
  TrackerEvent
} from '../domain/types';
import {
  BackupMetadataRecord,
  OrderedRecord,
  SettingsRecord,
  TrackerDatabase,
  trackerDatabase
} from './db';

const APP_SETTINGS_KEY: SettingsRecord['key'] = 'app';
const BACKUP_STATUS_KEY: BackupMetadataRecord['key'] = 'backupStatus';

export type TrackerRepository = {
  loadAppState: () => Promise<AppState>;
  replaceAppState: (state: AppState) => Promise<void>;
  upsertEvent: (event: TrackerEvent) => Promise<void>;
  markEventDeleted: (eventId: EventId, deletedTime: string) => Promise<void>;
  saveKnownTerm: (knownTerm: KnownTerm) => Promise<void>;
  savePhase: (phase: Phase) => Promise<void>;
  saveBackupStatus: (backupStatus: BackupStatus) => Promise<void>;
  checkNeedsMigration: () => Promise<boolean>;
  exportRawState: () => Promise<unknown>;
  runMigration: () => Promise<AppState>;
};

export const createTrackerRepository = (db: TrackerDatabase): TrackerRepository => ({
  async loadAppState() {
    const [events, knownTerms, phases, settingsRecord, backupMetadataRecord] = await Promise.all([
      orderedValues(db.events),
      orderedValues(db.knownTerms),
      orderedValues(db.phases),
      db.settings.get(APP_SETTINGS_KEY),
      db.backupMetadata.get(BACKUP_STATUS_KEY)
    ]);

    const settings: AppSettings = {
      trackedDogName: settingsRecord?.value.trackedDogName ?? 'Mexx',
      ...(backupMetadataRecord?.value ? { backupStatus: backupMetadataRecord.value } : {})
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      events,
      knownTerms,
      phases,
      settings
    };
  },

  async replaceAppState(state) {
    await db.transaction(
      'rw',
      [db.events, db.knownTerms, db.phases, db.settings, db.backupMetadata],
      async () => {
        await Promise.all([
          db.events.clear(),
          db.knownTerms.clear(),
          db.phases.clear(),
          db.settings.clear(),
          db.backupMetadata.clear()
        ]);

        await Promise.all([
          db.events.bulkPut(withStorageOrder(state.events)),
          db.knownTerms.bulkPut(withStorageOrder(state.knownTerms)),
          db.phases.bulkPut(withStorageOrder(state.phases)),
          db.settings.put({
            key: APP_SETTINGS_KEY,
            value: {
              trackedDogName: state.settings.trackedDogName
            }
          }),
          state.settings.backupStatus
            ? db.backupMetadata.put({
                key: BACKUP_STATUS_KEY,
                value: state.settings.backupStatus
              })
            : Promise.resolve()
        ]);
      }
    );
  },

  async upsertEvent(event) {
    await putPreservingStorageOrder(db.events, event);
  },

  async markEventDeleted(eventId, deletedTime) {
    await db.transaction('rw', db.events, async () => {
      const event = await db.events.get(eventId);

      if (!event) {
        return;
      }

      await db.events.put({
        ...event,
        changeTime: deletedTime,
        deleted: true,
        deletedTime
      });
    });
  },

  async saveKnownTerm(knownTerm) {
    await putPreservingStorageOrder(db.knownTerms, knownTerm);
  },

  async savePhase(phase) {
    await putPreservingStorageOrder(db.phases, phase);
  },

  async saveBackupStatus(backupStatus) {
    await db.backupMetadata.put({
      key: BACKUP_STATUS_KEY,
      value: backupStatus
    });
  },

  async checkNeedsMigration() {
    const [events, knownTerms] = await Promise.all([
      db.events.toArray(),
      db.knownTerms.toArray()
    ]);
    const validEventTypes = new Set(['seizure', 'observation', 'therapy_dog']);
    const validTermKinds = new Set(['trigger-tag', 'observation-tag', 'therapy-tag']);
    return (
      events.some((e) => !validEventTypes.has((e as unknown as Record<string, string>).type)) ||
      knownTerms.some((t) => !validTermKinds.has((t as unknown as Record<string, string>).kind))
    );
  },

  async exportRawState() {
    const [events, knownTerms, phases, settingsRecord, backupMetadataRecord] = await Promise.all([
      db.events.toArray(),
      db.knownTerms.toArray(),
      db.phases.toArray(),
      db.settings.get(APP_SETTINGS_KEY),
      db.backupMetadata.get(BACKUP_STATUS_KEY)
    ]);
    return {
      exportType: 'raw-migration-backup',
      exportedAt: new Date().toISOString(),
      events: events.map(({ storageOrder: _so, ...e }) => e),
      knownTerms: knownTerms.map(({ storageOrder: _so, ...t }) => t),
      phases: phases.map(({ storageOrder: _so, ...p }) => p),
      settings: settingsRecord?.value ?? null,
      backupStatus: backupMetadataRecord?.value ?? null
    };
  },

  async runMigration() {
    const state = await this.loadAppState();
    const validEventTypes = new Set<string>(['seizure', 'observation', 'therapy_dog']);
    const validTermKinds = new Set<string>(['trigger-tag', 'observation-tag', 'therapy-tag']);
    const migrated: AppState = {
      ...state,
      events: state.events.filter((e) => validEventTypes.has((e as unknown as Record<string, string>).type)),
      knownTerms: state.knownTerms.filter((t) => validTermKinds.has((t as unknown as Record<string, string>).kind))
    };
    await this.replaceAppState(migrated);
    return migrated;
  }
});

export const trackerRepository = createTrackerRepository(trackerDatabase);

async function orderedValues<T extends { id: string }>(table: Table<OrderedRecord<T>, string>): Promise<T[]> {
  const records = await table.orderBy('storageOrder').toArray();

  return records.map(({ storageOrder: _storageOrder, ...value }) => value as unknown as T);
}

function withStorageOrder<T extends { id: string }>(values: T[]): OrderedRecord<T>[] {
  return values.map((value, storageOrder) => ({
    ...value,
    storageOrder
  }));
}

async function putPreservingStorageOrder<T extends { id: string }>(
  table: Table<OrderedRecord<T>, string>,
  value: T
): Promise<void> {
  const existing = await table.get(value.id);
  const storageOrder = existing?.storageOrder ?? (await nextStorageOrder(table));

  await table.put({
    ...value,
    storageOrder
  });
}

async function nextStorageOrder<T extends { id: string }>(table: Table<OrderedRecord<T>, string>): Promise<number> {
  const lastRecord = await table.orderBy('storageOrder').last();

  return lastRecord ? lastRecord.storageOrder + 1 : 0;
}
