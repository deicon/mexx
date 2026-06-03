import { Table } from 'dexie';
import {
  AppSettings,
  AppState,
  BackupStatus,
  EventId,
  KnownTerm,
  MealTemplate,
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
  saveMealTemplate: (mealTemplate: MealTemplate) => Promise<void>;
  saveKnownTerm: (knownTerm: KnownTerm) => Promise<void>;
  savePhase: (phase: Phase) => Promise<void>;
  saveBackupStatus: (backupStatus: BackupStatus) => Promise<void>;
};

export const createTrackerRepository = (db: TrackerDatabase): TrackerRepository => ({
  async loadAppState() {
    const [events, mealTemplates, knownTerms, phases, settingsRecord, backupMetadataRecord] = await Promise.all([
      orderedValues(db.events),
      orderedValues(db.mealTemplates),
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
      mealTemplates,
      knownTerms,
      phases,
      settings
    };
  },

  async replaceAppState(state) {
    await db.transaction(
      'rw',
      [db.events, db.mealTemplates, db.knownTerms, db.phases, db.settings, db.backupMetadata],
      async () => {
        await Promise.all([
          db.events.clear(),
          db.mealTemplates.clear(),
          db.knownTerms.clear(),
          db.phases.clear(),
          db.settings.clear(),
          db.backupMetadata.clear()
        ]);

        await Promise.all([
          db.events.bulkPut(withStorageOrder(state.events)),
          db.mealTemplates.bulkPut(withStorageOrder(state.mealTemplates)),
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

  async saveMealTemplate(mealTemplate) {
    await putPreservingStorageOrder(db.mealTemplates, mealTemplate);
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
